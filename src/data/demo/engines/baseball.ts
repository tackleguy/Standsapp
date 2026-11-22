// Inning-by-inning baseball simulator with a full line score and walk-offs.
import { MINUTE, ordinal } from '@/lib/format';
import { createRng } from '@/lib/random';

import type { EntryState, EventMeta, EventState, StatsSection } from '../../types';
import { squadFor } from '../world';
import {
  cachedScript, disruptedState, nameOf, playsUpTo, preMatchNote, progressAt, shortOf, sortTimeline, statusAt,
  strengthOf, type TimedPlay,
} from './common';

const HALF_MS = 9.5 * MINUTE;
const MID_MS = 2 * MINUTE;

interface Half { inning: number; top: boolean; start: number; end: number; runs: number; hits: number; errors: number; runTimes: number[]; hr: number }

interface BaseballScript {
  halves: Half[];
  endsAt: number;
  walkOff: boolean;
  timeline: TimedPlay[];
  strikeouts: [number, number];
}

const RUN_PLAYS = [
  { w: 0.3, hr: true, make: (p: string, n: number) => n === 4 ? `GRAND SLAM! ${p} clears the bases!` : `HOME RUN! ${p} goes deep — a ${n === 1 ? 'solo' : `${n}-run`} shot!` },
  { w: 0.3, hr: false, make: (p: string, n: number) => `${p} lines an RBI single${n > 1 ? ` and ${n} runs score` : ''}.` },
  { w: 0.25, hr: false, make: (p: string, n: number) => `${p} doubles into the gap — ${n} run${n > 1 ? 's' : ''} in.` },
  { w: 0.15, hr: false, make: (p: string) => `Sacrifice fly from ${p} brings the run home.` },
];

function buildScript(meta: EventMeta): BaseballScript {
  const rng = createRng(`baseball:${meta.id}`);
  const ids = meta.competitorIds; // [home, away]; away bats first (top)
  const s = [strengthOf(ids[0]) + 0.04, strengthOf(ids[1])];
  const rel = s[0] / (s[0] + s[1]);
  const factor = [0.5 + rel, 1.5 - rel];
  const squads = [squadFor(ids[0], 13), squadFor(ids[1], 13)];
  const halves: Half[] = [];
  const tl: TimedPlay[] = [];
  const score = [0, 0];
  let t = meta.startsAt + 3 * MINUTE;
  let walkOff = false;
  tl.push({ at: meta.startsAt, clock: 'First pitch', importance: 1, tag: 'START', competitorId: null,
    description: `Play ball! ${nameOf(ids[1])} lead off against ${nameOf(ids[0])}.`, scoreAfter: '0-0' });

  for (let inning = 1; inning <= 15; inning++) {
    for (const top of [true, false]) {
      const side = top ? 1 : 0;
      if (!top && inning >= 9 && score[0] > score[1]) { inning = 99; break; }
      const start = t;
      const end = start + HALF_MS * rng.float(0.8, 1.25);
      let runs = Math.min(8, rng.poisson(0.5 * factor[side]));
      if (inning === 15 && !top && score[0] + runs === score[1]) runs += 1; // no endless games
      const hits = runs + rng.poisson(0.55);
      const errors = rng.chance(0.07) ? 1 : 0;
      const runTimes: number[] = [];
      let hr = 0;
      let scoredSoFar = 0;
      while (scoredSoFar < runs) {
        const left = runs - scoredSoFar;
        const n = Math.min(left, rng.chance(0.55) ? 1 : rng.int(1, Math.min(4, left)));
        const at = start + ((scoredSoFar + 1) / (runs + 1)) * (end - start);
        let roll = rng.next();
        let kind = RUN_PLAYS[0];
        for (const k of RUN_PLAYS) { if (roll < k.w) { kind = k; break; } roll -= k.w; }
        if (kind.hr) hr++;
        scoredSoFar += n;
        for (let i = 0; i < n; i++) runTimes.push(at);
        const prevScore = [...score];
        score[side] += n;
        const isWalkOff = !top && inning >= 9 && score[0] > score[1] && prevScore[0] <= prevScore[1];
        tl.push({ at, clock: `${top ? 'Top' : 'Bot'} ${ordinal(inning)}`, importance: isWalkOff ? 3 : kind.hr ? 3 : 2,
          tag: isWalkOff ? 'WALKOFF' : kind.hr ? 'HR' : 'RUN', competitorId: ids[side],
          description: `${isWalkOff ? 'WALK-OFF! ' : ''}${kind.make(rng.pick(squads[side].slice(0, 9)), n)}`,
          scoreAfter: `${score[0]}-${score[1]}` });
        if (isWalkOff) { walkOff = true; runs = scoredSoFar; break; }
      }
      if (rng.chance(0.1)) {
        tl.push({ at: start + (end - start) * 0.5, clock: `${top ? 'Top' : 'Bot'} ${ordinal(inning)}`, importance: 2, tag: 'K',
          competitorId: ids[1 - side], description: `${rng.pick(squads[1 - side].slice(9))} strikes out the side!`, scoreAfter: null });
      } else if (rng.chance(0.12)) {
        tl.push({ at: start + (end - start) * 0.6, clock: `${top ? 'Top' : 'Bot'} ${ordinal(inning)}`, importance: 1, tag: 'DP',
          competitorId: ids[1 - side], description: `Inning-ending double play turned by ${nameOf(ids[1 - side])}.`, scoreAfter: null });
      }
      const halfEnd = walkOff ? (runTimes[runTimes.length - 1] ?? end) : end;
      halves.push({ inning, top, start, end: halfEnd, runs, hits, errors, runTimes, hr });
      if (walkOff) break;
      tl.push({ at: halfEnd, clock: `${top ? 'Mid' : 'End'} ${ordinal(inning)}`, importance: 1, tag: 'HALF', competitorId: null,
        description: `${top ? 'Middle' : 'End'} of the ${ordinal(inning)}: ${shortOf(ids[1])} ${score[1]}, ${shortOf(ids[0])} ${score[0]}.`,
        scoreAfter: `${score[0]}-${score[1]}` });
      t = halfEnd + MID_MS;
    }
    if (walkOff || inning >= 99) break;
    if (inning >= 9 && score[0] !== score[1]) break;
  }
  const last = halves[halves.length - 1];
  const endsAt = last.end + 2 * MINUTE;
  const w = score[0] > score[1] ? 0 : 1;
  tl.push({ at: endsAt - 1, clock: 'Final', importance: 3, tag: 'FINAL', competitorId: ids[w],
    description: `Final: ${nameOf(ids[w])} win ${Math.max(...score)}-${Math.min(...score)}${last.inning > 9 ? ` in ${last.inning} innings` : ''}.`,
    scoreAfter: `${score[0]}-${score[1]}` });
  return { halves, endsAt, walkOff, timeline: sortTimeline(tl), strikeouts: [rng.int(5, 13), rng.int(5, 13)] };
}

export function simulateBaseball(meta: EventMeta, now: number): EventState {
  if (meta.disruption) return disruptedState(meta);
  const s = cachedScript(`baseball:${meta.id}`, () => buildScript(meta));
  const status = statusAt(meta, s.endsAt, now);
  const progress = progressAt(meta, s.endsAt, now);
  const ids = meta.competitorIds;
  const runsFor = (side: number, until: number) => s.halves.filter((h) => h.top === (side === 1))
    .reduce((a, h) => a + h.runTimes.filter((rt) => rt <= until).length, 0);
  const score = [runsFor(0, now), runsFor(1, now)];
  const finished = status === 'finished';
  const final = [runsFor(0, Infinity), runsFor(1, Infinity)];
  const winner = final[0] > final[1] ? 0 : 1;

  const entries: EntryState[] = ids.map((id, side) => ({
    competitorId: id, role: side === 0 ? 'home' : 'away',
    score: status === 'scheduled' ? null : score[side], scoreText: null, position: null,
    isWinner: finished ? winner === side : null, note: null,
  }));

  let periodLabel: string | null = null;
  if (status === 'live') {
    const cur = s.halves.find((h) => now >= h.start && now < h.end);
    if (cur) periodLabel = `${cur.top ? 'Top' : 'Bot'} ${ordinal(cur.inning)}`;
    else {
      const prev = [...s.halves].reverse().find((h) => h.end <= now);
      periodLabel = prev ? `${prev.top ? 'Mid' : 'End'} ${ordinal(prev.inning)}` : 'First pitch';
    }
  }

  const innings = Math.max(9, ...s.halves.map((h) => h.inning));
  const line = (side: number) => {
    const cells: string[] = [];
    for (let i = 1; i <= innings; i++) {
      const h = s.halves.find((x) => x.inning === i && x.top === (side === 1));
      if (!h) cells.push(i >= 9 && side === 0 && finished ? 'X' : '–');
      else if (now < h.start) cells.push('–');
      else cells.push(String(h.runTimes.filter((rt) => rt <= now).length));
    }
    const started = s.halves.filter((h) => h.top === (side === 1) && h.start <= now);
    const hits = started.reduce((a, h) => a + (h.end <= now ? h.hits : Math.round(h.hits * Math.min(1, (now - h.start) / (h.end - h.start)))), 0);
    const errors = s.halves.filter((h) => h.top !== (side === 1) && h.end <= now).reduce((a, h) => a + h.errors, 0);
    return { cells, hits, errors, hr: started.filter((h) => h.end <= now).reduce((a, h) => a + h.hr, 0) };
  };
  const away = line(1);
  const home = line(0);
  const stats: StatsSection[] = progress <= 0 ? [preMatchNote(meta)] : [
    { type: 'table', title: 'Line score', columns: ['Team', ...Array.from({ length: innings }, (_, i) => String(i + 1)), 'R', 'H', 'E'],
      rows: [
        { key: 'away', competitorId: ids[1], emphasis: true, cells: [shortOf(ids[1]), ...away.cells, String(score[1]), String(away.hits), String(away.errors)] },
        { key: 'home', competitorId: ids[0], emphasis: true, cells: [shortOf(ids[0]), ...home.cells, String(score[0]), String(home.hits), String(home.errors)] },
      ] },
    { type: 'compare', title: 'Team stats', items: [
      { label: 'Hits', home: home.hits, away: away.hits },
      { label: 'Home runs', home: home.hr, away: away.hr },
      { label: 'Strikeouts (pitching)', home: Math.round(s.strikeouts[0] * progress), away: Math.round(s.strikeouts[1] * progress) },
      { label: 'Errors', home: home.errors, away: away.errors },
    ] },
  ];

  return {
    meta, status, periodLabel, progress, entries, stats,
    plays: playsUpTo(meta, s.timeline, now),
    resultText: finished ? `${nameOf(ids[winner])} won ${Math.max(...final)}-${Math.min(...final)}${s.walkOff ? ' (walk-off)' : ''}` : null,
    facts: { homeScore: final[0], awayScore: final[1], total: final[0] + final[1], winner: winner === 0 ? 'home' : 'away', expectedTotal: 9 },
    endsAt: s.endsAt,
  };
}
