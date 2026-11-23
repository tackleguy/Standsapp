// Round-by-round MMA and boxing simulator with finishes and judges' scorecards.
import { MINUTE } from '@/lib/format';
import { createRng, type Rng } from '@/lib/random';

import type { EntryState, EventMeta, EventState, StatsSection } from '../../types';
import type { GameStats, StatLine } from '../players/types';
import {
  cachedScript, disruptedState, impactOf, mmss, nameOf, playsUpTo, preMatchNote, progressAt, shortOf, sortTimeline,
  statusAt, strengthOf, type TimedPlay,
} from './common';

export type Method = 'KO/TKO' | 'Submission' | 'Decision';

/** One fighter's stat increments at one moment. `side` is 0 or 1 (meta.competitorIds order). */
interface Feat { at: number; round: number; side: 0 | 1; stats: StatLine }

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
  /** Every fighter stat (strikes, knockdowns, takedowns, submission attempts, the win), oldest first. */
  feats: Feat[];
}

/** A feed line, what it means for the fighter `{a}`, and how it shows on a play card. */
interface Action { text: string; headline: string; impact: number; stat?: 'ss' | 'td' | 'sa' }

const MMA_ACTION: Action[] = [
  { text: '{a} lands a stiff jab and circles away.', headline: 'Stiff jab', impact: 2.2, stat: 'ss' },
  { text: 'Big leg kick from {a}!', headline: 'Leg kick', impact: 2.8, stat: 'ss' },
  { text: '{a} shoots for a takedown… and gets it!', headline: 'Takedown', impact: 4.2, stat: 'td' },
  { text: '{a} threatens a guillotine but {b} pops out.', headline: 'Submission attempt', impact: 4, stat: 'sa' },
  { text: 'Clinch against the cage, {a} working knees to the body.', headline: 'Clinch work', impact: 2.6, stat: 'ss' },
  { text: '{a} rocks {b} with a counter right!', headline: 'Rocked!', impact: 5.6, stat: 'ss' },
  { text: '{b} is cut above the eye.', headline: 'Cut opened', impact: 3.6, stat: 'ss' },
  { text: 'Spinning back kick attempt from {a}!', headline: 'Spinning kick', impact: 2.4 },
];
const BOX_ACTION: Action[] = [
  { text: '{a} doubles up the jab beautifully.', headline: 'Double jab', impact: 2.2, stat: 'ss' },
  { text: 'Huge right hand lands for {a}!', headline: 'Big right hand', impact: 4.6, stat: 'ss' },
  { text: '{a} digs a left hook to the body.', headline: 'Body shot', impact: 3.2, stat: 'ss' },
  { text: '{b} on the ropes, {a} letting the hands go!', headline: 'On the ropes', impact: 4.2, stat: 'ss' },
  { text: 'Clean counter from {a}.', headline: 'Counter', impact: 2.8, stat: 'ss' },
  { text: '{a} is boxing smartly on the back foot.', headline: 'Boxing smart', impact: 1.6 },
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
  const roundWinners: (0 | 1)[] = [];
  for (let r = 0; r < rounds; r++) {
    const roundWinner = rng.chance(winner === 0 ? 0.62 : 0.38) ? 0 : 1;
    roundWinners.push(roundWinner);
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
  // Stats the feed itself shows (a takedown, a knockdown...), credited at that moment.
  const shown: Feat[] = [];
  const name = (p: number) => nameOf(ids[p]);
  const pair = (p: number) => [ids[p], ids[1 - p]];
  tl.push({ at: meta.startsAt, clock: 'Walkouts', importance: 1, tag: 'START', competitorId: null,
    description: `${name(0)} and ${name(1)} make their walks. ${rounds} rounds scheduled.`, scoreAfter: null,
    playerIds: [ids[0], ids[1]], playerRoles: ['fighter', 'fighter'], headline: 'Walkouts', impact: impactOf(0.5), period: 0 });
  const knockdowns: [number, number] = [0, 0];
  for (let r = 1; r <= finishRound; r++) {
    const start = roundStarts[r - 1];
    tl.push({ at: start, clock: `R${r} ${mmss(roundMin)}`, importance: 1, tag: 'ROUND', competitorId: null,
      description: `Round ${r} begins.`, scoreAfter: null, period: r - 1 });
    const limit = r === finishRound ? finishTime : roundMin;
    const actions = rng.int(1, 3);
    for (let k = 0; k < actions; k++) {
      const into = rng.float(0.2, Math.max(0.3, limit - 0.2));
      const a = rng.chance(winner === 0 ? 0.6 : 0.4) ? 0 : 1;
      const action = rng.pick(mma ? MMA_ACTION : BOX_ACTION);
      const at = start + into * MINUTE;
      tl.push({ at, clock: `R${r} ${mmss(roundMin - into)}`, importance: 1, tag: 'ACTION', competitorId: ids[a],
        description: action.text.replace('{a}', name(a)).replace('{b}', name(1 - a)), scoreAfter: null,
        playerIds: pair(a), playerRoles: ['attack', 'defend'], headline: action.headline,
        impact: impactOf(action.impact + (r === finishRound && finished ? 0.4 : 0)), period: r - 1 });
      if (action.stat) shown.push({ at, round: r, side: a, stats: { [action.stat]: 1 } });
    }
    if (rng.chance(mma ? 0.12 : 0.18) || (r === finishRound && finished && method === 'KO/TKO' && rng.chance(0.5))) {
      const a = r === finishRound && finished ? winner : rng.chance(0.55) ? winner : 1 - winner;
      const into = Math.min(limit - 0.15, rng.float(0.2, limit));
      const at = start + Math.max(0.1, into) * MINUTE;
      knockdowns[a]++;
      tl.push({ at, clock: `R${r} ${mmss(roundMin - into)}`, importance: 3, tag: 'KNOCKDOWN', competitorId: ids[a],
        description: `KNOCKDOWN! ${name(a)} drops ${name(1 - a)}!`, scoreAfter: null,
        playerIds: pair(a), playerRoles: ['attack', 'down'], headline: 'Knockdown!',
        impact: impactOf(7.8 + (r === finishRound && finished ? 0.6 : 0)), period: r - 1 });
      // The punch or kick that dropped them is a landed strike too.
      shown.push({ at, round: r, side: a as 0 | 1, stats: { ss: 1, kd: 1 } });
    }
    if (r < finishRound) {
      tl.push({ at: start + roundMin * MINUTE, clock: `End R${r}`, importance: 1, tag: 'ROUND_END', competitorId: null,
        description: `End of round ${r}.`, scoreAfter: null, period: r - 1 });
    }
  }
  const finishAt = roundStarts[finishRound - 1] + finishTime * MINUTE;
  const finalAt = finished ? finishAt : finishAt + 2 * MINUTE;
  tl.push({
    at: finalAt, clock: finished ? `R${finishRound} ${mmss(roundMin - finishTime)}` : 'Decision',
    importance: 3, tag: 'FINAL', competitorId: ids[winner],
    description: finished
      ? `${name(winner)} wins by ${method === 'Submission' ? rng.pick(['rear-naked choke', 'guillotine', 'armbar', 'triangle']) + ' submission' : 'KO/TKO'} at ${mmss(finishTime)} of round ${finishRound}!`
      : `${name(winner)} wins by ${decisionKind} (${judges.map((j) => `${j[winner]}-${j[1 - winner]}`).join(', ')}).`,
    scoreAfter: null,
    playerIds: pair(winner), playerRoles: ['won', 'lost'],
    headline: method === 'KO/TKO' ? 'Wins by KO/TKO' : method === 'Submission' ? 'Wins by submission'
      : decisionKind.startsWith('split') ? 'Wins by split decision' : 'Wins by decision',
    impact: impactOf(!finished ? (decisionKind.startsWith('split') ? 7.8 : 8.2) : finishRound === 1 ? 9.9 : 9.5),
    period: finishRound - 1,
  });
  // The finishing blow lands, or the finishing hold is a submission attempt that works.
  if (method === 'KO/TKO') shown.push({ at: finishAt, round: finishRound, side: winner, stats: { ss: 1 } });
  if (method === 'Submission') shown.push({ at: finishAt, round: finishRound, side: winner, stats: { sa: 1 } });
  shown.push({ at: finalAt, round: finishRound, side: winner,
    stats: finished ? { win: 1, fin: 1, ...(finishRound === 1 ? { r1: 1 } : null) } : { win: 1 } });

  const fightMin = (finishRound - 1) * roundMin + finishTime;
  const strikes: [number, number] = [Math.round(fightMin * (mma ? 4 : 7) * (0.8 + s[0] * 0.4)), Math.round(fightMin * (mma ? 4 : 7) * (0.8 + s[1] * 0.4))];
  const takedowns: [number, number] = mma ? [rng.int(0, finishRound + 1), rng.int(0, finishRound)] : [0, 0];
  const bout: Bout = { roundStarts, roundMin, finishRound, finishTime, finished, roundWinners, mma };
  // Everything the feed does not show comes from its own seed, after every result is settled.
  const feats = [...shown, ...unseenFeats(bout, strikes, takedowns, shown, createRng(`players:${meta.id}`))]
    .sort((a, b) => a.at - b.at);
  return {
    rounds, roundMin, roundStarts, winner, method, finishRound, finishTime, judges, decisionKind,
    strikes, takedowns, knockdowns, endsAt, timeline: sortTimeline(tl), feats,
  };
}

interface Bout {
  roundStarts: number[];
  roundMin: number;
  finishRound: number;
  finishTime: number;
  finished: boolean;
  roundWinners: (0 | 1)[];
  mma: boolean;
}

/** Splits a whole number into parts in proportion to the weights (largest remainder first). */
function split(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (total <= 0 || sum <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const out = raw.map(Math.floor);
  const order = raw.map((v, i) => ({ i, rest: v - out[i] })).sort((a, b) => b.rest - a.rest || a.i - b.i);
  let left = total - out.reduce((a, b) => a + b, 0);
  for (let k = 0; left > 0; k++, left--) out[order[k % order.length].i]++;
  return out;
}

/**
 * Strikes landed round by round (adding up to the fight totals the Stats tab has
 * always shown), plus takedowns and submission attempts the feed did not
 * mention. Strikes arrive minute by minute, so a fighter's line grows during a
 * round, and the fighter who edged a round on the cards tends to land more in it.
 */
function unseenFeats(b: Bout, strikes: [number, number], takedowns: [number, number], shown: Feat[], rng: Rng): Feat[] {
  const out: Feat[] = [];
  const rounds = Array.from({ length: b.finishRound }, (_, i) => {
    const r = i + 1;
    const start = b.roundStarts[i];
    const limit = r === b.finishRound ? b.finishTime : b.roundMin;
    // A fight that is stopped ends a second after the last of these.
    const end = start + limit * MINUTE - (b.finished && r === b.finishRound ? 1000 : 0);
    return { r, start, limit, end };
  });
  const count = (side: 0 | 1, key: string, r?: number) =>
    shown.filter((f) => f.side === side && (r === undefined || f.round === r)).reduce((a, f) => a + (f.stats[key] ?? 0), 0);
  /** A moment inside the action of a round. */
  const momentIn = (round: (typeof rounds)[number]) =>
    Math.round(round.start + rng.float(0.1, Math.max(0.15, round.limit - 0.05)) * MINUTE);
  /** A round, picked in proportion to how long it lasted. */
  const pickRound = () => {
    let x = rng.next() * rounds.reduce((a, rd) => a + rd.limit, 0);
    for (const rd of rounds) { x -= rd.limit; if (x < 0) return rd; }
    return rounds[rounds.length - 1];
  };

  for (const side of [0, 1] as const) {
    // Strikes: what the feed shows stays where it is; the rest are spread by round.
    const anchored = rounds.map((rd) => count(side, 'ss', rd.r));
    const free = Math.max(0, strikes[side] - anchored.reduce((a, v) => a + v, 0));
    const perRound = split(free, rounds.map((rd) =>
      rd.limit * rng.float(0.75, 1.25) * (b.roundWinners[rd.r - 1] === side ? 1.15 : 0.88)));
    rounds.forEach((rd, i) => {
      // One chunk per minute of the round (the last one may be shorter).
      const marks: number[] = [];
      for (let m = 1; rd.start + m * MINUTE < rd.end; m++) marks.push(rd.start + m * MINUTE);
      marks.push(rd.end);
      const lengths = marks.map((at, k) => at - (k === 0 ? rd.start : marks[k - 1]));
      split(perRound[i], lengths.map((len) => len * rng.float(0.6, 1.4))).forEach((n, k) => {
        if (n > 0) out.push({ at: marks[k], round: rd.r, side, stats: { ss: n } });
      });
    });
    if (!b.mma) continue;
    // Takedowns: the fight total, at least the ones the feed shows.
    const tdMore = Math.max(0, takedowns[side] - count(side, 'td'));
    for (let k = 0; k < tdMore; k++) {
      const rd = pickRound();
      out.push({ at: momentIn(rd), round: rd.r, side, stats: { td: 1 } });
    }
    // Submission attempts: a few more, likelier for fighters who get it to the mat.
    const subMore = rng.poisson(0.06 * rounds.reduce((a, rd) => a + rd.limit, 0) / b.roundMin + 0.2 * takedowns[side]);
    for (let k = 0; k < subMore; k++) {
      const rd = pickRound();
      out.push({ at: momentIn(rd), round: rd.r, side, stats: { sa: 1 } });
    }
  }
  return out;
}

/** How many of one stat a fighter has up to `now`. */
function featTotal(feats: Feat[], side: 0 | 1, key: string, now: number): number {
  let total = 0;
  for (const f of feats) {
    if (f.at > now) break;
    if (f.side === side) total += f.stats[key] ?? 0;
  }
  return total;
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
      // Counted as they land, so they always match the fighters' own stats.
      { label: mma ? 'Significant strikes' : 'Punches landed', home: featTotal(s.feats, 0, 'ss', now), away: featTotal(s.feats, 1, 'ss', now) },
      ...(mma ? [{ label: 'Takedowns', home: featTotal(s.feats, 0, 'td', now), away: featTotal(s.feats, 1, 'td', now) }] : []),
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

/**
 * Per-player stats for one event (the whole fight; readers cut it at "now").
 * The fighters are the players: strikes landed minute by minute, knockdowns,
 * takedowns and submission attempts (MMA) as they happen, and at the end the
 * win, a finish inside the distance and a first-round finish. Same script as the
 * scoreboard, so it always agrees with the result, method, round and feed.
 */
export function combatGameStats(meta: EventMeta): GameStats {
  const s = cachedScript(`combat:${meta.id}`, () => buildScript(meta));
  const ids = meta.competitorIds;
  return {
    periods: Array.from({ length: s.finishRound }, (_, i) => `R${i + 1}`),
    lineups: ids.map((id) => ({ competitorId: id, playerIds: [id] })),
    events: s.feats.map((f) => ({ at: f.at, period: f.round - 1, playerId: ids[f.side], stats: f.stats })),
  };
}
