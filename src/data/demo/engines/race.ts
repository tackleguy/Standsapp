// Lap-by-lap motor racing simulator (Formula 1, MotoGP, IndyCar).
import { formatGap, formatLapTime, MINUTE } from '@/lib/format';
import { createRng } from '@/lib/random';

import type { EntryState, EventMeta, EventState, StatsSection } from '../../types';
import type { GameStats } from '../players/types';
import { competitorById } from '../world';
import {
  cachedScript, disruptedState, nameOf, playsUpTo, preMatchNote, progressAt, sortTimeline, statusAt,
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
}

type OrderInput = Pick<RaceScript, 'ids' | 'grid' | 'cum' | 'dnfLap'>;

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
  const script: RaceScript = { spec, laps, isSprint, ids, grid, cum, pits, pitCount, dnfLap, scLaps, fastest, lapEndAt, endsAt, timeline: [] };

  const name = (d: number) => nameOf(ids[d]);
  const tl: TimedPlay[] = [];
  tl.push({ at: raceStart, clock: 'Lap 1', importance: 2, tag: 'START', competitorId: ids[grid[0]],
    description: `Lights out and away we go! ${name(grid[0])} leads into turn 1 from pole.`, scoreAfter: null });
  let prev = orderAt(script, 0);
  let bestSoFar = Infinity;
  for (let lap = 1; lap <= laps; lap++) {
    const at = lapEndAt[lap];
    const order = orderAt(script, lap);
    const clock = `Lap ${lap}/${laps}`;
    if (order[0] !== prev[0]) {
      tl.push({ at, clock, importance: 3, tag: 'LEAD', competitorId: ids[order[0]],
        description: `${name(order[0])} takes the lead from ${name(prev[0])}!`, scoreAfter: null });
    }
    let overtakes = 0;
    for (let p = 1; p < Math.min(8, order.length) && overtakes < 2; p++) {
      const d = order[p];
      const was = prev.indexOf(d);
      if (was > p && !pits.has(`${prev[p]}:${lap}`) && cum[d][lap] !== Infinity) {
        tl.push({ at: at - 5000, clock, importance: p <= 3 ? 2 : 1, tag: 'OVERTAKE', competitorId: ids[d],
          description: `${name(d)} passes ${name(prev[p])} for P${p + 1}.`, scoreAfter: null });
        overtakes++;
      }
    }
    for (let d = 0; d < ids.length; d++) {
      if (pits.has(`${d}:${lap}`)) {
        tl.push({ at: at - 20_000, clock, importance: 1, tag: 'PIT', competitorId: ids[d],
          description: `${name(d)} pits from P${prev.indexOf(d) + 1} — ${rng.pick(TYRES)} tyres fitted.`, scoreAfter: null });
      }
      if (dnfLap[d] === lap) {
        tl.push({ at: at - 30_000, clock, importance: 3, tag: 'DNF', competitorId: ids[d],
          description: `${name(d)} is out! ${rng.pick(DNF_REASONS)}`, scoreAfter: null });
      }
    }
    if (scLaps.has(lap) && !scLaps.has(lap - 1)) {
      tl.push({ at: lapEndAt[lap - 1] + 15_000, clock, importance: 3, tag: 'SC', competitorId: null,
        description: 'SAFETY CAR deployed! The field bunches up.', scoreAfter: null });
    }
    if (!scLaps.has(lap) && scLaps.has(lap - 1)) {
      tl.push({ at: lapEndAt[lap - 1] + 5_000, clock, importance: 2, tag: 'RESTART', competitorId: ids[order[0]],
        description: `Safety car in. ${name(order[0])} controls the restart.`, scoreAfter: null });
    }
    const lapBest = ids.map((_, d) => (cum[d][lap] === Infinity || pits.has(`${d}:${lap}`) ? Infinity : cum[d][lap] - cum[d][lap - 1]));
    const minIdx = lapBest.indexOf(Math.min(...lapBest));
    if (lap > 2 && !scLaps.has(lap) && lapBest[minIdx] < bestSoFar && order.indexOf(minIdx) < 6) {
      bestSoFar = lapBest[minIdx];
      tl.push({ at: at - 2_000, clock, importance: 1, tag: 'FASTEST', competitorId: ids[minIdx],
        description: `Fastest lap: ${name(minIdx)} with a ${formatLapTime(lapBest[minIdx])}.`, scoreAfter: null });
    }
    if (lap === laps - 1) {
      const gap = cum[order[1]][lap] - cum[order[0]][lap];
      tl.push({ at: at + 1000, clock: `Lap ${laps}/${laps}`, importance: 2, tag: 'FINAL_LAP', competitorId: ids[order[0]],
        description: `Final lap! ${name(order[0])} leads ${name(order[1])} by ${gap.toFixed(1)}s.`, scoreAfter: null });
    }
    prev = order;
  }
  const finalOrder = orderAt(script, laps);
  tl.push({ at: lapEndAt[laps], clock: 'Finish', importance: 3, tag: 'FINAL', competitorId: ids[finalOrder[0]],
    description: `CHEQUERED FLAG! ${name(finalOrder[0])} wins the ${meta.title}!`, scoreAfter: null });
  tl.push({ at: lapEndAt[laps] + 30_000, clock: 'Podium', importance: 2, tag: 'PODIUM', competitorId: null,
    description: `Podium: 1. ${name(finalOrder[0])}  2. ${name(finalOrder[1])}  3. ${name(finalOrder[2])}`, scoreAfter: null });
  script.timeline = sortTimeline(tl);
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
 * Per-player stats for one event (the whole game; readers cut it at "now").
 * TODO(players): attribute every stat to roster players. Until then nobody scores.
 */
export function raceGameStats(meta: EventMeta): GameStats {
  return emptyGameStats(meta);
}
