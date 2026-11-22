// Round-by-round MMA and boxing simulator with finishes and judges' scorecards.
import { MINUTE } from '@/lib/format';
import { createRng } from '@/lib/random';

import type { EntryState, EventMeta, EventState, StatsSection } from '../../types';
import {
  cachedScript, disruptedState, mmss, nameOf, playsUpTo, preMatchNote, progressAt, shortOf, sortTimeline,
  statusAt, strengthOf, type TimedPlay,
} from './common';

export type Method = 'KO/TKO' | 'Submission' | 'Decision';

interface CombatScript {
  rounds: number;
  roundMin: number;
  roundStarts: number[];
  winner: 0 | 1;
  method: Method;
  finishRound: number; // 1-based
  finishTime: number; // minutes into the round
  judges: [number, number][];
  decisionKind: string;
  strikes: [number, number];
  takedowns: [number, number];
  knockdowns: [number, number];
  endsAt: number;
  timeline: TimedPlay[];
}

const MMA_ACTION = [
  '{a} lands a stiff jab and circles away.', 'Big leg kick from {a}!', '{a} shoots for a takedown… and gets it!',
  '{a} threatens a guillotine but {b} pops out.', 'Clinch against the cage, {a} working knees to the body.',
  '{a} rocks {b} with a counter right!', '{b} is cut above the eye.', 'Spinning back kick attempt from {a}!',
];
const BOX_ACTION = [
  '{a} doubles up the jab beautifully.', 'Huge right hand lands for {a}!', '{a} digs a left hook to the body.',
  '{b} on the ropes, {a} letting the hands go!', 'Clean counter from {a}.', '{a} is boxing smartly on the back foot.',
];

function buildScript(meta: EventMeta): CombatScript {
  const rng = createRng(`combat:${meta.id}`);
  const ids = meta.competitorIds;
  const mma = meta.sportId === 'mma';
  const isMain = meta.durationMs >= (mma ? 25 : 55) * MINUTE;
  const rounds = mma ? (isMain ? 5 : 3) : isMain ? 12 : 10;
  const roundMin = mma ? 5 : 3;
  const breakMin = 1;
  const s = [strengthOf(ids[0]), strengthOf(ids[1])];
  const pA = Math.min(0.9, Math.max(0.1, 0.5 + (s[0] - s[1]) * 0.9));
  const winner: 0 | 1 = rng.chance(pA) ? 0 : 1;
  const finished = rng.chance(mma ? 0.55 : 0.42);
  const method: Method = !finished ? 'Decision' : mma && rng.chance(0.42) ? 'Submission' : 'KO/TKO';
  const finishRound = finished ? rng.int(1, rounds) : rounds;
  const finishTime = finished ? rng.float(0.3, roundMin - 0.1) : roundMin;
  const walkout = 4 * MINUTE;
  const roundStarts = Array.from({ length: rounds }, (_, i) => meta.startsAt + walkout + i * (roundMin + breakMin) * MINUTE);
  const endsAt = roundStarts[finishRound - 1] + finishTime * MINUTE + 3 * MINUTE;

  // Judges score each round 10-9 to the fighter who edged it.
  const judges: [number, number][] = [[0, 0], [0, 0], [0, 0]];
  for (let r = 0; r < rounds; r++) {
    const roundWinner = rng.chance(winner === 0 ? 0.62 : 0.38) ? 0 : 1;
    judges.forEach((j) => {
      const w = rng.chance(0.85) ? roundWinner : 1 - roundWinner;
      j[w] += 10;
      j[1 - w] += 9;
    });
  }
  // Make the cards agree with the winner.
  judges.forEach((j) => { if (j[winner] <= j[1 - winner]) { const d = j[1 - winner] - j[winner] + 1; j[winner] += d; } });
  const agreeing = judges.filter((j) => j[winner] > j[1 - winner]).length;
  const decisionKind = agreeing === 3 ? 'unanimous decision' : 'split decision';

  const tl: TimedPlay[] = [];
  const name = (p: number) => nameOf(ids[p]);
  tl.push({ at: meta.startsAt, clock: 'Walkouts', importance: 1, tag: 'START', competitorId: null,
    description: `${name(0)} and ${name(1)} make their walks. ${rounds} rounds scheduled.`, scoreAfter: null });
  const knockdowns: [number, number] = [0, 0];
  for (let r = 1; r <= finishRound; r++) {
    const start = roundStarts[r - 1];
    tl.push({ at: start, clock: `R${r} ${mmss(roundMin)}`, importance: 1, tag: 'ROUND', competitorId: null,
      description: `Round ${r} begins.`, scoreAfter: null });
    const limit = r === finishRound ? finishTime : roundMin;
    const actions = rng.int(1, 3);
    for (let k = 0; k < actions; k++) {
      const into = rng.float(0.2, Math.max(0.3, limit - 0.2));
      const a = rng.chance(winner === 0 ? 0.6 : 0.4) ? 0 : 1;
      tl.push({ at: start + into * MINUTE, clock: `R${r} ${mmss(roundMin - into)}`, importance: 1, tag: 'ACTION', competitorId: ids[a],
        description: rng.pick(mma ? MMA_ACTION : BOX_ACTION).replace('{a}', name(a)).replace('{b}', name(1 - a)), scoreAfter: null });
    }
    if (rng.chance(mma ? 0.12 : 0.18) || (r === finishRound && finished && method === 'KO/TKO' && rng.chance(0.5))) {
      const a = r === finishRound && finished ? winner : rng.chance(0.55) ? winner : 1 - winner;
      const into = Math.min(limit - 0.15, rng.float(0.2, limit));
      knockdowns[a]++;
      tl.push({ at: start + Math.max(0.1, into) * MINUTE, clock: `R${r} ${mmss(roundMin - into)}`, importance: 3, tag: 'KNOCKDOWN', competitorId: ids[a],
        description: `KNOCKDOWN! ${name(a)} drops ${name(1 - a)}!`, scoreAfter: null });
    }
    if (r < finishRound) {
      tl.push({ at: start + roundMin * MINUTE, clock: `End R${r}`, importance: 1, tag: 'ROUND_END', competitorId: null,
        description: `End of round ${r}.`, scoreAfter: null });
    }
  }
  const finishAt = roundStarts[finishRound - 1] + finishTime * MINUTE;
  tl.push({
    at: finished ? finishAt : finishAt + 2 * MINUTE, clock: finished ? `R${finishRound} ${mmss(roundMin - finishTime)}` : 'Decision',
    importance: 3, tag: 'FINAL', competitorId: ids[winner],
    description: finished
      ? `${name(winner)} wins by ${method === 'Submission' ? rng.pick(['rear-naked choke', 'guillotine', 'armbar', 'triangle']) + ' submission' : 'KO/TKO'} at ${mmss(finishTime)} of round ${finishRound}!`
      : `${name(winner)} wins by ${decisionKind} (${judges.map((j) => `${j[winner]}-${j[1 - winner]}`).join(', ')}).`,
    scoreAfter: null,
  });
  const fightMin = (finishRound - 1) * roundMin + finishTime;
  return {
    rounds, roundMin, roundStarts, winner, method, finishRound, finishTime, judges, decisionKind,
    strikes: [Math.round(fightMin * (mma ? 4 : 7) * (0.8 + s[0] * 0.4)), Math.round(fightMin * (mma ? 4 : 7) * (0.8 + s[1] * 0.4))],
    takedowns: mma ? [rng.int(0, finishRound + 1), rng.int(0, finishRound)] : [0, 0],
    knockdowns, endsAt, timeline: sortTimeline(tl),
  };
}

export function simulateCombat(meta: EventMeta, now: number): EventState {
  if (meta.disruption) return disruptedState(meta);
  const s = cachedScript(`combat:${meta.id}`, () => buildScript(meta));
  const status = statusAt(meta, s.endsAt, now);
  const progress = progressAt(meta, s.endsAt, now);
  const ids = meta.competitorIds;
  const finished = status === 'finished';
  const mma = meta.sportId === 'mma';
  const short = s.method === 'Decision' ? (s.decisionKind.startsWith('split') ? 'SD' : 'UD') : s.method === 'Submission' ? `SUB R${s.finishRound}` : `KO R${s.finishRound}`;

  const entries: EntryState[] = ids.map((id, p) => ({
    competitorId: id, role: p === 0 ? 'home' : 'away', score: null,
    scoreText: finished ? (p === s.winner ? `W · ${short}` : 'L') : null,
    position: null, isWinner: finished ? p === s.winner : null, note: null,
  }));

  let periodLabel: string | null = null;
  if (status === 'live') {
    const r = s.roundStarts.findIndex((start) => now >= start && now < start + s.roundMin * MINUTE);
    if (now < s.roundStarts[0]) periodLabel = 'Walkouts';
    else if (r >= 0) periodLabel = `R${r + 1} ${mmss(s.roundMin - (now - s.roundStarts[r]) / MINUTE)}`;
    else periodLabel = now > s.roundStarts[s.finishRound - 1] ? 'Decision pending' : 'Between rounds';
  }

  const stats: StatsSection[] = progress <= 0 ? [preMatchNote(meta)] : [
    { type: 'compare', title: 'Fight stats', items: [
      { label: mma ? 'Significant strikes' : 'Punches landed', home: Math.round(s.strikes[0] * progress), away: Math.round(s.strikes[1] * progress) },
      ...(mma ? [{ label: 'Takedowns', home: Math.round(s.takedowns[0] * progress), away: Math.round(s.takedowns[1] * progress) }] : []),
      { label: 'Knockdowns', home: playsUpTo(meta, s.timeline, now).filter((p) => p.tag === 'KNOCKDOWN' && p.competitorId === ids[0]).length,
        away: playsUpTo(meta, s.timeline, now).filter((p) => p.tag === 'KNOCKDOWN' && p.competitorId === ids[1]).length },
    ] },
  ];
  if (finished && s.method === 'Decision') {
    stats.push({ type: 'table', title: 'Judges’ scorecards', columns: ['Judge', shortOf(ids[0]), shortOf(ids[1])],
      rows: s.judges.map((j, i) => ({ key: `j${i}`, cells: [`Judge ${i + 1}`, String(j[0]), String(j[1])] })) });
  }
  stats.push({ type: 'note', title: 'Bout', text: `${s.rounds} × ${s.roundMin}-minute rounds` });

  return {
    meta, status, periodLabel, progress, entries, stats,
    plays: playsUpTo(meta, s.timeline, now),
    resultText: finished ? `${nameOf(ids[s.winner])} won by ${s.method === 'Decision' ? s.decisionKind : s.method}` : null,
    facts: { winner: s.winner === 0 ? 'home' : 'away', method: s.method, distance: s.method === 'Decision' },
    endsAt: s.endsAt,
  };
}
