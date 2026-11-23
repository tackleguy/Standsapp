// Lap-by-lap motor racing simulator (Formula 1, MotoGP, IndyCar).
import { formatGap, formatLapTime, MINUTE } from '@/lib/format';
import { createRng } from '@/lib/random';

import type { EntryState, EventMeta, EventState, StatsSection } from '../../types';
import type { GameStats, StatEvent, StatLine } from '../players/types';
import { competitorById } from '../world';
import {
  cachedScript, disruptedState, impactOf, nameOf, playsUpTo, preMatchNote, progressAt, sortTimeline, statusAt,
  strengthOf, type TimedPlay, emptyGameStats,
} from './common';

interface RaceSpec { laps: number; sprintLaps: number; baseLap: number; points: number[]; sprintPoints: number[]; pitLoss: number; word: string }

const SPECS: Record<string, RaceSpec> = {
  f1: { laps: 57, sprintLaps: 19, baseLap: 91.2, pitLoss: 21.5, word: 'car',
    points: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1], sprintPoints: [8, 7, 6, 5, 4, 3, 2, 1] },
  motogp: { laps: 24, sprintLaps: 12, baseLap: 99.8, pitLoss: 0, word: 'bike',
    points: [25, 20, 16, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1], sprintPoints: [12, 9, 7, 6, 5, 4, 3, 2, 1] },
  indycar: { laps: 85, sprintLaps: 40, baseLap: 76.4, pitLoss: 28, word: 'car',
    points: [50, 40, 35, 32, 30, 28, 26, 24, 22, 20, 19, 18, 17, 16, 15], sprintPoints: [10, 8, 6, 5, 4, 3, 2, 1] },
};

const TYRES = ['soft', 'medium', 'hard'] as const;
const DNF_REASONS = ['Engine failure!', 'Contact at turn 1 ends the race.', 'Hydraulics problem — retires to the pits.',
  'Spins into the gravel. Race over.', 'Gearbox issue. Heartbreak.', 'Puncture and damage — retired.'];

interface RaceScript {
  spec: RaceSpec;
  laps: number;
  isSprint: boolean;
  ids: string[];
  grid: number[]; // driver indexes in grid order
  cum: number[][]; // cum[d][lap] = race time after lap (lap 0 = start offset); Infinity once retired
  pits: Set<string>; // `${d}:${lap}`
  pitCount: number[][]; // pitCount[d][lap]
  dnfLap: (number | null)[];
  scLaps: Set<number>;
  fastest: { d: number; lap: number; time: number } | null;
  lapEndAt: number[]; // real time each lap completes
  endsAt: number;
  timeline: TimedPlay[];
  /** What each driver did, lap by lap (the athletes are the players). */
  stats: GameStats;
}

type OrderInput = Pick<RaceScript, 'ids' | 'grid' | 'cum' | 'dnfLap'>;

/** Lap numbers that split a race into four stints: [0, 14, 28, 42, 57] for 57 laps. */
function stintBounds(laps: number): number[] {
  return [0, 1, 2, 3, 4].map((k) => Math.floor((k * laps) / 4));
}

/** Which stint a lap belongs to (the start counts as the first stint). */
function stintOf(bounds: number[], lap: number): number {
  let k = 0;
  while (k < bounds.length - 2 && lap > bounds[k + 1]) k++;
  return k;
}

/** Running order after `lap` laps: runners by race time, then retirements. */
function orderAt(s: OrderInput, lap: number): number[] {
  if (lap <= 0) return [...s.grid];
  const running: number[] = [];
  const out: number[] = [];
  s.ids.forEach((_, d) => {
    const dnf = s.dnfLap[d];
    (dnf !== null && dnf <= lap ? out : running).push(d);
  });
  running.sort((a, b) => s.cum[a][lap] - s.cum[b][lap]);
  out.sort((a, b) => (s.dnfLap[b] ?? 0) - (s.dnfLap[a] ?? 0));
  return [...running, ...out];
}

function buildScript(meta: EventMeta): RaceScript {
  const spec = SPECS[meta.sportId] ?? SPECS.f1;
  const rng = createRng(`race:${meta.id}`);
  const isSprint = meta.title.includes('Sprint');
  const laps = isSprint ? spec.sprintLaps : spec.laps;
  const ids = meta.competitorIds;
  const n = ids.length;
  const strengths = ids.map((id) => strengthOf(id));
  const grid = ids.map((_, i) => i).sort((a, b) => (strengths[b] + rng.normal(0, 0.12)) - (strengths[a] + rng.normal(0, 0.12)));
  const cum: number[][] = ids.map(() => new Array(laps + 1).fill(0));
  grid.forEach((d, pos) => { cum[d][0] = pos * 0.28; });
  const pitLaps: number[][] = ids.map(() => {
    if (isSprint || spec.pitLoss === 0) return [];
    const stops = rng.chance(0.55) ? 1 : 2;
    return stops === 1 ? [Math.round(laps * rng.float(0.35, 0.55))]
      : [Math.round(laps * rng.float(0.25, 0.38)), Math.round(laps * rng.float(0.6, 0.75))];
  });
  const dnfLap = ids.map(() => (rng.chance(isSprint ? 0.025 : 0.05) ? rng.int(1, laps - 1) : null));
  const scLaps = new Set<number>();
  if (!isSprint && rng.chance(0.4)) {
    const at = rng.int(6, Math.max(7, laps - 8));
    for (let l = at; l < at + 3; l++) scLaps.add(l);
  }
  const pits = new Set<string>();
  const pitCount: number[][] = ids.map(() => new Array(laps + 1).fill(0));
  let fastest: RaceScript['fastest'] = null;

  for (let lap = 1; lap <= laps; lap++) {
    const sc = scLaps.has(lap);
    for (let d = 0; d < n; d++) {
      pitCount[d][lap] = pitCount[d][lap - 1];
      if (dnfLap[d] !== null && lap > (dnfLap[d] as number)) { cum[d][lap] = Infinity; continue; }
      const stint = lap - Math.max(0, ...pitLaps[d].filter((p) => p < lap));
      let t = spec.baseLap - strengths[d] * 1.7 + rng.normal(0, 0.45) + stint * 0.035;
      if (lap === 1) t += 3 + grid.indexOf(d) * 0.15;
      if (pitLaps[d].includes(lap)) { t += spec.pitLoss; pits.add(`${d}:${lap}`); pitCount[d][lap]++; }
      if (sc) t = spec.baseLap + 28 + rng.float(0, 0.3);
      cum[d][lap] = cum[d][lap - 1] + t;
      if (!sc && lap > 2 && !pitLaps[d].includes(lap) && (!fastest || t < fastest.time)) fastest = { d, lap, time: t };
    }
    // Safety car bunches the field up behind the leader.
    if (sc && !scLaps.has(lap + 1)) {
      const order = orderAt({ ids, grid, cum, dnfLap }, lap).filter((d) => cum[d][lap] !== Infinity);
      const lead = cum[order[0]][lap];
      order.forEach((d, i) => { cum[d][lap] = lead + i * 0.7; });
    }
  }

  const lapMs = (meta.durationMs - 4 * MINUTE) / laps;
  const raceStart = meta.startsAt + 2 * MINUTE;
  const lapEndAt = new Array(laps + 1).fill(0).map((_, l) => Math.round(raceStart + l * lapMs));
  const endsAt = lapEndAt[laps] + 2 * MINUTE;
  const script: RaceScript = { spec, laps, isSprint, ids, grid, cum, pits, pitCount, dnfLap, scLaps, fastest, lapEndAt, endsAt, timeline: [],
    stats: { periods: [], lineups: [], events: [] } };

  // Player stats are written alongside the commentary, from the same lap data,
  // so the feed, the classification and every driver's stat line agree.
  // (No random numbers are drawn for them: the race itself is unchanged.)
  const bounds = stintBounds(laps);
  const stint = (lap: number) => stintOf(bounds, lap);
  const events: StatEvent[] = [];
  const credit = (at: number, lap: number, d: number, stats: StatLine) => {
    events.push({ at, period: stint(lap), playerId: ids[d], stats });
  };
  const who = (...ds: number[]) => ds.map((d) => ids[d]);
  const running = (d: number, lap: number) => dnfLap[d] === null || (dnfLap[d] as number) > lap;

  const name = (d: number) => nameOf(ids[d]);
  const tl: TimedPlay[] = [];
  tl.push({ at: raceStart, clock: 'Lap 1', importance: 2, tag: 'START', competitorId: ids[grid[0]],
    description: `Lights out and away we go! ${name(grid[0])} leads into turn 1 from pole.`, scoreAfter: null,
    playerIds: who(grid[0]), playerRoles: ['pole'], headline: 'Leads from pole', impact: impactOf(3), period: 0 });
  grid.forEach((d, i) => credit(raceStart, 0, d, { grid: i + 1 }));
  let prev = orderAt(script, 0);
  let bestSoFar = Infinity;
  for (let lap = 1; lap <= laps; lap++) {
    const at = lapEndAt[lap];
    const order = orderAt(script, lap);
    const clock = `Lap ${lap}/${laps}`;
    const period = stint(lap);
    if (order[0] !== prev[0]) {
      tl.push({ at, clock, importance: 3, tag: 'LEAD', competitorId: ids[order[0]],
        description: `${name(order[0])} takes the lead from ${name(prev[0])}!`, scoreAfter: null,
        playerIds: who(order[0], prev[0]), playerRoles: ['lead', 'passed'], headline: 'Takes the lead',
        impact: impactOf(6 + (2.5 * lap) / laps), period });
    }
    let overtakes = 0;
    const calledPass = new Set<number>();
    for (let p = 1; p < Math.min(8, order.length) && overtakes < 2; p++) {
      const d = order[p];
      const was = prev.indexOf(d);
      if (was > p && !pits.has(`${prev[p]}:${lap}`) && cum[d][lap] !== Infinity) {
        tl.push({ at: at - 5000, clock, importance: p <= 3 ? 2 : 1, tag: 'OVERTAKE', competitorId: ids[d],
          description: `${name(d)} passes ${name(prev[p])} for P${p + 1}.`, scoreAfter: null,
          playerIds: who(d, prev[p]), playerRoles: ['ot', 'passed'], headline: `Overtake for P${p + 1}`,
          impact: impactOf(5.6 - p * 0.45), period });
        calledPass.add(d);
        overtakes++;
      }
    }
    // Overtakes for the whole field: every running car that ended the lap ahead of
    // a car it was behind, when that car neither pitted nor retired this lap. A pass
    // the commentary called always counts, so the feed and the stats agree.
    const posNow = new Array<number>(ids.length);
    order.forEach((d, i) => { posNow[d] = i; });
    for (const d of order) {
      let passed = 0;
      if (running(d, lap) && !pits.has(`${d}:${lap}`)) {
        const wasAt = prev.indexOf(d);
        for (let q = 0; q < wasAt; q++) {
          const b = prev[q];
          if (posNow[b] > posNow[d] && running(b, lap) && !pits.has(`${b}:${lap}`)) passed++;
        }
      }
      const ot = Math.max(passed, calledPass.has(d) ? 1 : 0);
      if (ot > 0) credit(at - 5000, lap, d, { ot });
    }
    for (let d = 0; d < ids.length; d++) {
      if (pits.has(`${d}:${lap}`)) {
        tl.push({ at: at - 20_000, clock, importance: 1, tag: 'PIT', competitorId: ids[d],
          description: `${name(d)} pits from P${prev.indexOf(d) + 1} — ${rng.pick(TYRES)} tyres fitted.`, scoreAfter: null,
          playerIds: who(d), playerRoles: ['pit'], headline: 'Pit stop', impact: impactOf(1.5), period });
        credit(at - 20_000, lap, d, { pit: 1 });
      }
      if (dnfLap[d] === lap) {
        tl.push({ at: at - 30_000, clock, importance: 3, tag: 'DNF', competitorId: ids[d],
          description: `${name(d)} is out! ${rng.pick(DNF_REASONS)}`, scoreAfter: null,
          playerIds: who(d), playerRoles: ['dnf'], headline: 'Retires', impact: impactOf(7 - prev.indexOf(d) * 0.25), period });
        credit(at - 30_000, lap, d, { dnf: 1 });
      }
    }
    if (scLaps.has(lap) && !scLaps.has(lap - 1)) {
      tl.push({ at: lapEndAt[lap - 1] + 15_000, clock, importance: 3, tag: 'SC', competitorId: null,
        description: 'SAFETY CAR deployed! The field bunches up.', scoreAfter: null, period });
    }
    if (!scLaps.has(lap) && scLaps.has(lap - 1)) {
      tl.push({ at: lapEndAt[lap - 1] + 5_000, clock, importance: 2, tag: 'RESTART', competitorId: ids[order[0]],
        description: `Safety car in. ${name(order[0])} controls the restart.`, scoreAfter: null,
        playerIds: who(order[0]), playerRoles: ['lead'], headline: 'Leads the restart', impact: impactOf(3), period });
    }
    const lapBest = ids.map((_, d) => (cum[d][lap] === Infinity || pits.has(`${d}:${lap}`) ? Infinity : cum[d][lap] - cum[d][lap - 1]));
    const minIdx = lapBest.indexOf(Math.min(...lapBest));
    if (lap > 2 && !scLaps.has(lap) && lapBest[minIdx] < bestSoFar && order.indexOf(minIdx) < 6) {
      bestSoFar = lapBest[minIdx];
      tl.push({ at: at - 2_000, clock, importance: 1, tag: 'FASTEST', competitorId: ids[minIdx],
        description: `Fastest lap: ${name(minIdx)} with a ${formatLapTime(lapBest[minIdx])}.`, scoreAfter: null,
        playerIds: who(minIdx), playerRoles: ['fl'], headline: 'Fastest lap', impact: impactOf(2.5), period });
    }
    if (lap === laps - 1) {
      const gap = cum[order[1]][lap] - cum[order[0]][lap];
      tl.push({ at: at + 1000, clock: `Lap ${laps}/${laps}`, importance: 2, tag: 'FINAL_LAP', competitorId: ids[order[0]],
        description: `Final lap! ${name(order[0])} leads ${name(order[1])} by ${gap.toFixed(1)}s.`, scoreAfter: null,
        playerIds: who(order[0], order[1]), playerRoles: ['lead', 'chase'], headline: 'Final lap', impact: impactOf(4),
        period: stint(laps) });
    }
    if (running(order[0], lap)) credit(at, lap, order[0], { led: 1 });
    prev = order;
  }
  const finalOrder = orderAt(script, laps);
  const lastStint = stint(laps);
  tl.push({ at: lapEndAt[laps], clock: 'Finish', importance: 3, tag: 'FINAL', competitorId: ids[finalOrder[0]],
    description: `CHEQUERED FLAG! ${name(finalOrder[0])} wins the ${meta.title}!`, scoreAfter: null,
    playerIds: who(finalOrder[0]), playerRoles: ['win'], headline: isSprint ? 'Wins the sprint' : 'Wins the race',
    impact: impactOf(9.5), period: lastStint });
  tl.push({ at: lapEndAt[laps] + 30_000, clock: 'Podium', importance: 2, tag: 'PODIUM', competitorId: null,
    description: `Podium: 1. ${name(finalOrder[0])}  2. ${name(finalOrder[1])}  3. ${name(finalOrder[2])}`, scoreAfter: null,
    playerIds: who(...finalOrder.slice(0, 3)), playerRoles: ['p1', 'p2', 'p3'], headline: 'Podium', impact: impactOf(6),
    period: lastStint });
  script.timeline = sortTimeline(tl);

  // The classification at the flag: position, places gained from the grid and
  // championship points (the same table the results use). Retired drivers have
  // already been credited with their DNF, so they get no position or points.
  const points = isSprint ? spec.sprintPoints : spec.points;
  finalOrder.forEach((d, i) => {
    const fl: StatLine | null = script.fastest?.d === d ? { fl: 1 } : null;
    if (!running(d, laps)) {
      if (fl) credit(lapEndAt[laps], laps, d, fl);
      return;
    }
    credit(lapEndAt[laps], laps, d, { pos: i + 1, gained: grid.indexOf(d) - i, ...(points[i] ? { pts: points[i] } : null), ...fl });
  });
  script.stats = {
    periods: bounds.slice(0, -1).map((b, k) => `L${b + 1}–${bounds[k + 1]}`),
    lineups: ids.map((id) => ({ competitorId: id, playerIds: [id] })),
    events: events.sort((a, b) => a.at - b.at),
  };
  return script;
}

function completedLapsAt(s: RaceScript, now: number): number {
  let lap = 0;
  while (lap < s.laps && s.lapEndAt[lap + 1] <= now) lap++;
  return lap;
}

function gapText(s: RaceScript, d: number, leader: number, lap: number): string {
  if (s.dnfLap[d] !== null && (s.dnfLap[d] as number) <= lap) return 'DNF';
  const gap = s.cum[d][lap] - s.cum[leader][lap];
  const avgLap = s.cum[leader][lap] / Math.max(1, lap);
  if (lap > 0 && gap > avgLap) return `+${Math.floor(gap / avgLap)} lap${gap / avgLap >= 2 ? 's' : ''}`;
  return formatGap(gap);
}

export function simulateRace(meta: EventMeta, now: number): EventState {
  if (meta.disruption) return disruptedState(meta);
  const s = cachedScript(`race:${meta.id}`, () => buildScript(meta));
  const status = statusAt(meta, s.endsAt, now);
  const progress = progressAt(meta, s.endsAt, now);
  const lap = status === 'scheduled' ? 0 : completedLapsAt(s, now);
  const order = orderAt(s, lap);
  const finished = status === 'finished';
  const leader = order[0];
  const points = s.isSprint ? s.spec.sprintPoints : s.spec.points;

  const entries: EntryState[] = order.map((d, i) => {
    const retired = s.dnfLap[d] !== null && (s.dnfLap[d] as number) <= lap;
    let scoreText: string | null = null;
    if (status !== 'scheduled') {
      if (i === 0) scoreText = finished ? formatRaceTime(s.cum[d][lap]) : `Lap ${Math.min(lap + 1, s.laps)}/${s.laps}`;
      else scoreText = gapText(s, d, leader, lap);
    }
    const pittedNow = lap > 0 && s.pits.has(`${d}:${lap}`) && status === 'live';
    return {
      competitorId: s.ids[d],
      role: 'entrant',
      score: finished && !retired ? (points[i] ?? 0) : null,
      scoreText: status === 'scheduled' ? `Grid P${s.grid.indexOf(d) + 1}` : scoreText,
      position: status === 'scheduled' ? s.grid.indexOf(d) + 1 : i + 1,
      isWinner: finished ? i === 0 : null,
      note: retired ? 'DNF' : pittedNow ? 'Pit' : finished && s.fastest?.d === d ? 'Fastest lap' : null,
    };
  });
  if (status === 'scheduled') entries.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  let periodLabel: string | null = null;
  if (status === 'live') {
    if (now < s.lapEndAt[0]) periodLabel = 'Formation lap';
    else if (lap >= s.laps) periodLabel = 'Chequered flag';
    else periodLabel = `Lap ${lap + 1}/${s.laps}${s.scLaps.has(lap + 1) ? ' · Safety car' : ''}`;
  }

  const stats: StatsSection[] = [];
  if (progress <= 0) {
    stats.push(preMatchNote(meta));
    stats.push({ type: 'table', title: 'Starting grid', columns: ['Pos', 'Driver', 'Team'],
      rows: s.grid.map((d, i) => ({ key: s.ids[d], competitorId: s.ids[d],
        cells: [String(i + 1), nameOf(s.ids[d]), competitorById(competitorById(s.ids[d])?.parentId)?.shortName ?? ''] })) });
  } else {
    stats.push({
      type: 'table', title: finished ? 'Classification' : `Running order · lap ${lap}/${s.laps}`,
      columns: ['Pos', 'Driver', 'Team', finished ? 'Time/Gap' : 'Gap', 'Pits'],
      rows: order.map((d, i) => ({
        key: s.ids[d], competitorId: s.ids[d], emphasis: i < 3,
        cells: [String(i + 1), nameOf(s.ids[d]), competitorById(competitorById(s.ids[d])?.parentId)?.shortName ?? '',
          i === 0 ? (finished ? formatRaceTime(s.cum[d][lap]) : 'Leader') : gapText(s, d, leader, lap), String(s.pitCount[d][lap] ?? 0)],
      })),
    });
    const movers = order.map((d, i) => ({ d, gained: s.grid.indexOf(d) - i }))
      .filter((m) => s.dnfLap[m.d] === null || (s.dnfLap[m.d] as number) > lap)
      .sort((a, b) => b.gained - a.gained).slice(0, 5);
    stats.push({ type: 'table', title: 'Biggest movers', columns: ['Driver', 'Grid', 'Now', '+/-'],
      rows: movers.map((m) => ({ key: `mv${m.d}`, competitorId: s.ids[m.d],
        cells: [nameOf(s.ids[m.d]), `P${s.grid.indexOf(m.d) + 1}`, `P${order.indexOf(m.d) + 1}`, m.gained > 0 ? `+${m.gained}` : String(m.gained)] })) });
    if (finished && s.fastest) {
      stats.push({ type: 'note', title: 'Fastest lap',
        text: `${nameOf(s.ids[s.fastest.d])} · ${formatLapTime(s.fastest.time)} on lap ${s.fastest.lap}` });
    }
  }

  const finalOrder = orderAt(s, s.laps);
  return {
    meta, status, periodLabel, progress, entries,
    plays: playsUpTo(meta, s.timeline, now),
    stats,
    resultText: finished ? `${nameOf(s.ids[finalOrder[0]])} won` : null,
    facts: {
      winnerId: s.ids[finalOrder[0]],
      podium: finalOrder.slice(0, 3).map((d) => s.ids[d]).join(','),
      top6: finalOrder.slice(0, 6).map((d) => s.ids[d]).join(','),
      safetyCar: s.scLaps.size > 0,
      fastestLapId: s.fastest ? s.ids[s.fastest.d] : '',
    },
    endsAt: s.endsAt,
  };
}

function formatRaceTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const sec = (seconds % 60).toFixed(3).padStart(6, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

export interface CarOnTrack {
  competitorId: string;
  position: number;
  /** Laps completed including the fraction of the current lap (e.g. 12.37). */
  lapFloat: number;
  inPit: boolean;
  retired: boolean;
  gap: string;
}

export interface RaceSnapshot {
  laps: number;
  currentLap: number;
  phase: 'grid' | 'formation' | 'racing' | 'finished';
  safetyCar: boolean;
  cars: CarOnTrack[];
}

/**
 * Where every car is right now, for the live track map. Converts real time into
 * race time, then finds each car's position along its own lap-time history, so
 * real gaps show up as real distance on the track.
 */
export function raceSnapshot(meta: EventMeta, now: number): RaceSnapshot {
  const s = cachedScript(`race:${meta.id}`, () => buildScript(meta));
  const lap = completedLapsAt(s, Math.min(now, s.lapEndAt[s.laps]));
  const order = orderAt(s, lap);
  const leader = order[0];
  const raceStart = s.lapEndAt[0];
  const lapMs = (s.lapEndAt[s.laps] - raceStart) / s.laps;
  const finishOrder = orderAt(s, s.laps);
  const winnerTime = s.cum[finishOrder[0]][s.laps];
  const avgLap = winnerTime / s.laps;
  const phase: RaceSnapshot['phase'] = now < meta.startsAt ? 'grid' : now < raceStart ? 'formation'
    : now >= s.lapEndAt[s.laps] ? 'finished' : 'racing';
  const raceClock = phase === 'racing' ? ((now - raceStart) / lapMs) * avgLap : phase === 'finished' ? Infinity : 0;

  const cars: CarOnTrack[] = order.map((d, i) => {
    const retired = s.dnfLap[d] !== null && (s.dnfLap[d] as number) <= lap;
    let lapFloat = 0;
    if (phase === 'grid' || phase === 'formation') {
      lapFloat = -0.004 * (s.grid.indexOf(d) + 1);
    } else if (phase === 'finished') {
      lapFloat = s.laps - 0.004 * i;
    } else {
      const limit = s.dnfLap[d] ?? s.laps;
      let l = 0;
      while (l < limit && s.cum[d][l + 1] <= raceClock) l++;
      if (l >= limit) lapFloat = limit;
      else {
        const span = s.cum[d][l + 1] - s.cum[d][l];
        lapFloat = l + Math.max(0, Math.min(0.999, (raceClock - s.cum[d][l]) / span));
      }
    }
    const nextLap = Math.floor(lapFloat) + 1;
    const inPit = phase === 'racing' && s.pits.has(`${d}:${nextLap}`) && lapFloat % 1 > 0.82;
    return {
      competitorId: s.ids[d],
      position: phase === 'grid' || phase === 'formation' ? s.grid.indexOf(d) + 1 : i + 1,
      lapFloat,
      inPit,
      retired,
      gap: i === 0 ? 'Leader' : gapText(s, d, leader, lap),
    };
  });
  if (phase === 'grid' || phase === 'formation') cars.sort((a, b) => a.position - b.position);
  return {
    laps: s.laps,
    currentLap: Math.min(s.laps, lap + 1),
    phase,
    safetyCar: phase === 'racing' && s.scLaps.has(lap + 1),
    cars,
  };
}

/** Current order of a live race as competitor ids (for in-play pricing). */
export function raceOrderNow(meta: EventMeta, now: number): string[] {
  const s = cachedScript(`race:${meta.id}`, () => buildScript(meta));
  const lap = completedLapsAt(s, now);
  return orderAt(s, lap).map((d) => s.ids[d]);
}

/**
 * Per-driver stats for one race (the whole race; readers cut it at "now"). The
 * drivers are the players: grid slot, overtakes, laps led, pit stops, retirements,
 * then the finishing position, places gained, championship points and fastest lap.
 */
export function raceGameStats(meta: EventMeta): GameStats {
  if (meta.disruption) return emptyGameStats(meta);
  return cachedScript(`race:${meta.id}`, () => buildScript(meta)).stats;
}
