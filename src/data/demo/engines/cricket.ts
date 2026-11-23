// Ball-by-ball T20 cricket simulator with batting and bowling scorecards.
// Every ball is credited to the real roster players who faced it, bowled it and
// fielded it, so the scorecard, the feed and the fantasy points always agree.
import { formatOvers, MINUTE } from '@/lib/format';
import { createRng, type Rng } from '@/lib/random';

import type { EntryState, EventMeta, EventState, StatsSection } from '../../types';
import { linesUpTo, pointsOf } from '../players/lines';
import { startersFor } from '../players/roster';
import type { GameStats, Player, StatEvent, StatLine } from '../players/types';
import {
  cachedScript, disruptedState, impactOf, nameOf, playsUpTo, preMatchNote, progressAt, shortOf, sortTimeline,
  statusAt, strengthOf, type TimedPlay,
} from './common';

const BALL_MS = 40_000;
const WIDE_MS = 20_000;
const BREAK_MS = 15 * MINUTE;
const MAX_BALLS = 120;
const PERIODS = ['1st inns', '2nd inns'];

/** How a batter got out. */
type How = 'caught' | 'bowled' | 'lbw' | 'runout' | 'cb' | 'stumped';

interface Ball {
  at: number;
  inn: 0 | 1;
  legal: boolean;
  runs: number; // runs off the bat
  extras: number;
  wicket: string | null; // dismissal text
  how: How | null;
  fielder: number | null; // fielding XI index of the catcher, keeper or thrower
  batter: number; // batting XI index
  bowler: number; // fielding XI index
}

interface Innings {
  battingSide: 0 | 1;
  start: number;
  end: number;
  balls: Ball[];
  order: number[]; // batting order indices into squad, in the order they came in
  /** Maiden overs: who bowled them and when they were complete. */
  maidens: { bowler: number; at: number }[];
}

interface CricketScript {
  innings: [Innings, Innings];
  endsAt: number;
  /** Each side's playing XI in batting order (by meta.competitorIds). */
  squads: [Player[], Player[]];
  timeline: TimedPlay[];
  tossText: string;
  stats: GameStats;
}

// The engine's own dismissal mix. Catches are then shared out between the
// fielders, the keeper (caught behind, stumpings) and the bowler (caught and bowled).
const DISMISSALS: { w: number; how: How }[] = [
  { w: 0.32, how: 'caught' },
  { w: 0.22, how: 'bowled' },
  { w: 0.16, how: 'lbw' },
  { w: 0.18, how: 'runout' },
  { w: 0.12, how: 'cb' },
];

function pickDismissal(rng: Rng): How {
  let roll = rng.next();
  for (const d of DISMISSALS) {
    if (roll < d.w) return d.how;
    roll -= d.w;
  }
  return 'bowled';
}

/** Who completed a dismissal. `picked` is the fielder the engine drew. */
function placeDismissal(how: How, picked: number, bowler: number, keeper: number, prng: Rng): { how: How; fielder: number | null } {
  if (how === 'cb') return { how, fielder: bowler };
  if (how === 'runout') return { how, fielder: picked };
  if (how !== 'caught') return { how, fielder: null };
  if (picked === bowler) return { how: 'cb', fielder: bowler };
  if (prng.chance(0.12)) return { how: 'stumped', fielder: keeper };
  if (prng.chance(0.18)) return { how: 'caught', fielder: keeper }; // caught behind
  return { how, fielder: picked };
}

function dismissalText(how: How, bowler: Player, fielder: Player | null): string {
  const f = fielder?.short ?? '?';
  switch (how) {
    case 'caught': return `c ${f} b ${bowler.short}`;
    case 'cb': return `c & b ${bowler.short}`;
    case 'lbw': return `lbw b ${bowler.short}`;
    case 'runout': return `run out (${f})`;
    case 'stumped': return `st ${f} b ${bowler.short}`;
    default: return `b ${bowler.short}`;
  }
}

const HOW_HEADLINE: Record<How, string> = {
  caught: 'Caught', cb: 'Caught & bowled', bowled: 'Bowled', lbw: 'LBW', runout: 'Run out', stumped: 'Stumped',
};

/** The playing XI in batting order: batters, keeper, all-rounders, bowlers. */
function playingXI(teamId: string): Player[] {
  return startersFor(teamId);
}

/** "2-0-14-1": overs, maidens, runs and wickets. */
function figures(f: { balls: number; maidens: number; runs: number; wkts: number }): string {
  return `${formatOvers(f.balls).replace(/\.0$/, '')}-${f.maidens}-${f.runs}-${f.wkts}`;
}

function playInnings(
  rng: Rng, prng: Rng, inn: 0 | 1, battingSide: 0 | 1, start: number, target: number | null,
  squads: [Player[], Player[]], strengths: [number, number], timeline: TimedPlay[], teamIds: string[],
): Innings {
  const bat = squads[battingSide];
  const bowl = squads[1 - battingSide];
  const keeper = Math.max(0, bowl.findIndex((p) => p.pos === 'WK'));
  const adv = strengths[battingSide] - strengths[1 - battingSide];
  const balls: Ball[] = [];
  const maidens: Innings['maidens'] = [];
  const order = [0, 1];
  let striker = 0;
  let nonStriker = 1;
  let nextIn = 2;
  let legal = 0;
  let runs = 0;
  let wickets = 0;
  let t = start;
  const batterRuns = new Map<number, number>();
  const batterBalls = new Map<number, number>();
  const bowlerOrder = [10, 9, 8, 7, 6];
  const bowling = new Map<number, { balls: number; maidens: number; runs: number; wkts: number }>();
  const figuresOf = (idx: number) => {
    let f = bowling.get(idx);
    if (!f) { f = { balls: 0, maidens: 0, runs: 0, wkts: 0 }; bowling.set(idx, f); }
    return f;
  };
  let overConceded = 0;
  let overWickets = 0;
  const teamShort = shortOf(teamIds[battingSide]);

  while (legal < MAX_BALLS && wickets < 10 && (target === null || runs < target)) {
    const over = Math.floor(legal / 6);
    const bowler = bowlerOrder[over % 5];
    const phase = over < 6 ? 'powerplay' : over >= 16 ? 'death' : 'middle';
    const pWide = 0.03;
    if (rng.chance(pWide)) {
      runs += 1;
      figuresOf(bowler).runs += 1;
      overConceded += 1;
      balls.push({ at: t, inn, legal: false, runs: 0, extras: 1, wicket: null, how: null, fielder: null, batter: striker, bowler });
      t += WIDE_MS;
      continue;
    }
    const chasePressure = target !== null ? Math.min(0.03, Math.max(0, (target - runs) / Math.max(1, MAX_BALLS - legal) - 1.5) * 0.01) : 0;
    const pW = 0.045 - adv * 0.02 + (phase === 'death' ? 0.02 : 0) + chasePressure;
    const p6 = 0.045 + adv * 0.02 + (phase === 'death' ? 0.035 : 0);
    const p4 = 0.11 + adv * 0.02 + (phase === 'powerplay' ? 0.04 : 0);
    const p2 = 0.08;
    const p1 = 0.36;
    const roll = rng.next();
    let r = 0;
    let wicket: string | null = null;
    let how: How | null = null;
    let fielder: number | null = null;
    if (roll < pW) {
      // Same two draws as before (fielder, then dismissal), so every score is unchanged.
      const picked = Math.floor(rng.next() * bowl.length);
      ({ how, fielder } = placeDismissal(pickDismissal(rng), picked, bowler, keeper, prng));
      wicket = dismissalText(how, bowl[bowler], fielder === null ? null : bowl[fielder]);
    } else if (roll < pW + p6) r = 6;
    else if (roll < pW + p6 + p4) r = 4;
    else if (roll < pW + p6 + p4 + p2) r = rng.chance(0.08) ? 3 : 2;
    else if (roll < pW + p6 + p4 + p2 + p1) r = 1;
    legal++;
    runs += r;
    balls.push({ at: t, inn, legal: true, runs: r, extras: 0, wicket, how, fielder, batter: striker, bowler });
    const bf = figuresOf(bowler);
    bf.balls++;
    bf.runs += r;
    overConceded += r;
    if (how && how !== 'runout') { bf.wkts++; overWickets++; }
    const ballLabel = `${Math.floor((legal - 1) / 6)}.${((legal - 1) % 6) + 1}`;
    const before = batterRuns.get(striker) ?? 0;
    const faced = (batterBalls.get(striker) ?? 0) + 1;
    batterRuns.set(striker, before + r);
    batterBalls.set(striker, faced);
    const batter = bat[striker];
    const bowlerP = bowl[bowler];
    const tense = target !== null && MAX_BALLS - legal <= 30 && target - runs <= (MAX_BALLS - legal) * 2 ? 1 : 0;
    const death = phase === 'death' ? 1 : 0;
    const withBowler = { playerIds: [batter.id, bowlerP.id], playerRoles: ['bat', 'bowl'], period: inn };
    if (r === 6) {
      timeline.push({ at: t, clock: ballLabel, importance: 2, tag: 'SIX', competitorId: teamIds[battingSide],
        description: `SIX! ${batter.short} launches ${bowlerP.short} over ${rng.pick(['long-on', 'deep midwicket', 'long-off', 'cow corner', 'the sightscreen'])}!`,
        scoreAfter: `${teamShort} ${runs}/${wickets}`,
        ...withBowler, headline: 'SIX', impact: impactOf(4.5 + death * 0.8 + tense) });
    } else if (r === 4) {
      timeline.push({ at: t, clock: ballLabel, importance: 1, tag: 'FOUR', competitorId: teamIds[battingSide],
        description: `FOUR! ${batter.short} ${rng.pick(['drives {b} through the covers', 'cuts {b} hard past point', 'flicks {b} off the pads to fine leg', 'pulls {b} in front of square', 'edges {b} past the keeper']).replace('{b}', bowlerP.short)}.`,
        scoreAfter: `${teamShort} ${runs}/${wickets}`,
        ...withBowler, headline: 'FOUR', impact: impactOf(2.5 + death * 0.5 + tense) });
    }
    const after = before + r;
    if (before < 50 && after >= 50) {
      timeline.push({ at: t + 1, clock: ballLabel, importance: 2, tag: 'FIFTY', competitorId: teamIds[battingSide],
        description: `Fifty for ${batter.short} off ${faced} balls! A brilliant knock for ${nameOf(teamIds[battingSide])}.`, scoreAfter: null,
        playerIds: [batter.id], playerRoles: ['bat'], headline: 'Fifty', impact: impactOf(7 + tense), period: inn });
    }
    if (before < 100 && after >= 100) {
      timeline.push({ at: t + 1, clock: ballLabel, importance: 3, tag: 'HUNDRED', competitorId: teamIds[battingSide],
        description: `HUNDRED! ${batter.short} brings up a T20 century off ${faced} balls!`, scoreAfter: null,
        playerIds: [batter.id], playerRoles: ['bat'], headline: 'Hundred', impact: 9.5, period: inn });
    }
    if (wicket && how) {
      wickets++;
      const fielderP = fielder === null ? null : bowl[fielder];
      const ids = how === 'runout'
        ? [fielderP!.id, batter.id]
        : fielderP && fielder !== bowler ? [bowlerP.id, fielderP.id, batter.id] : [bowlerP.id, batter.id];
      const roles = how === 'runout' ? ['field', 'bat'] : ids.length === 3 ? ['bowl', 'field', 'bat'] : ['bowl', 'bat'];
      timeline.push({ at: t, clock: ballLabel, importance: 3, tag: 'WICKET', competitorId: teamIds[1 - battingSide],
        description: `WICKET! ${batter.short} ${wicket} for ${after} (${faced}).`, scoreAfter: `${teamShort} ${runs}/${wickets}`,
        playerIds: ids, playerRoles: roles, headline: HOW_HEADLINE[how],
        impact: impactOf(5 + Math.min(3, after / 20) + death * 0.3 + tense), period: inn });
      if (nextIn < 11 && wickets < 10) {
        order.push(nextIn);
        striker = nextIn;
        nextIn++;
      }
    } else if (r % 2 === 1) {
      [striker, nonStriker] = [nonStriker, striker];
    }
    t += BALL_MS;
    const overDone = legal % 6 === 0;
    const maiden = overDone && overConceded === 0;
    if (maiden) bf.maidens++;
    const inningsGoesOn = legal < MAX_BALLS && wickets < 10 && (target === null || runs < target);
    if (maiden) maidens.push({ bowler, at: inningsGoesOn ? t - 1 : t - BALL_MS });
    if (overDone && inningsGoesOn) {
      [striker, nonStriker] = [nonStriker, striker];
      const overNo = legal / 6;
      const need = target !== null ? ` · need ${target - runs} from ${MAX_BALLS - legal}` : '';
      timeline.push({ at: t - 1, clock: `${overNo}.0`, importance: 1, tag: 'OVER', competitorId: null,
        description: `End of over ${overNo}: ${teamShort} ${runs}/${wickets}${need}. ${maiden ? `Maiden from ${bowlerP.short}!` : `${bowlerP.short} ${figures(bf)}.`}`,
        scoreAfter: null, playerIds: [bowlerP.id], playerRoles: ['bowl'], headline: maiden ? 'Maiden' : 'End of over',
        impact: impactOf(maiden ? 3.5 + overWickets : 0.8 + overWickets * 0.8), period: inn });
    }
    if (overDone) {
      overConceded = 0;
      overWickets = 0;
    }
  }
  return { battingSide, start, end: t, balls, order, maidens };
}

/** Every ball as stat events for the players involved. Extras (wides) count against the bowler only. */
function buildStats(meta: EventMeta, innings: [Innings, Innings], squads: [Player[], Player[]]): GameStats {
  const events: StatEvent[] = [];
  const push = (at: number, period: number, player: Player, stats: StatLine) => events.push({ at, period, playerId: player.id, stats });
  innings.forEach((inn, period) => {
    const bat = squads[inn.battingSide];
    const bowl = squads[1 - inn.battingSide];
    for (const b of inn.balls) {
      if (!b.legal) {
        push(b.at, period, bowl[b.bowler], { rc: b.extras });
        continue;
      }
      const batting: StatLine = { balls: 1 };
      if (b.runs) batting.runs = b.runs;
      if (b.runs === 4) batting.fours = 1;
      if (b.runs === 6) batting.sixes = 1;
      if (b.wicket) batting.out = 1;
      push(b.at, period, bat[b.batter], batting);
      const bowling: StatLine = { bb: 1 };
      if (b.runs) bowling.rc = b.runs;
      if (b.how && b.how !== 'runout') bowling.wkts = 1;
      push(b.at, period, bowl[b.bowler], bowling);
      if (b.how && b.fielder !== null) {
        push(b.at, period, bowl[b.fielder], { [b.how === 'stumped' ? 'st' : b.how === 'runout' ? 'ro' : 'ct']: 1 });
      }
    }
    for (const m of inn.maidens) push(m.at, period, bowl[m.bowler], { md: 1 });
  });
  events.sort((a, b) => a.at - b.at);
  return {
    periods: PERIODS,
    lineups: meta.competitorIds.map((id, side) => ({ competitorId: id, playerIds: (squads[side] ?? []).map((p) => p.id) })),
    events,
  };
}

/** Top scorer and best bowler of an innings. */
function heroesOf(inn: Innings, squads: [Player[], Player[]]) {
  const bat = squads[inn.battingSide];
  const bowl = squads[1 - inn.battingSide];
  const batting = new Map<number, { runs: number; balls: number; out: boolean }>();
  const bowling = new Map<number, { wkts: number; runs: number }>();
  for (const b of inn.balls) {
    const w = bowling.get(b.bowler) ?? { wkts: 0, runs: 0 };
    w.runs += b.runs + b.extras;
    if (b.how && b.how !== 'runout') w.wkts++;
    bowling.set(b.bowler, w);
    if (!b.legal) continue;
    const x = batting.get(b.batter) ?? { runs: 0, balls: 0, out: false };
    x.runs += b.runs;
    x.balls++;
    if (b.wicket) x.out = true;
    batting.set(b.batter, x);
  }
  const [topIdx, top] = [...batting.entries()].sort((a, b) => b[1].runs - a[1].runs || a[1].balls - b[1].balls || a[0] - b[0])[0];
  const [bestIdx, best] = [...bowling.entries()].sort((a, b) => b[1].wkts - a[1].wkts || a[1].runs - b[1].runs || a[0] - b[0])[0];
  return { bat: bat[topIdx], top, bowl: bowl[bestIdx], best };
}

function buildScript(meta: EventMeta): CricketScript {
  const rng = createRng(`cricket:${meta.id}`);
  // Who did what is drawn from its own sequence, so scores never depend on it.
  const prng = createRng(`players:${meta.id}`);
  const teamIds = meta.competitorIds;
  const squads: [Player[], Player[]] = [playingXI(teamIds[0]), playingXI(teamIds[1])];
  const strengths: [number, number] = [strengthOf(teamIds[0]) + 0.03, strengthOf(teamIds[1])];
  const tossWinner: 0 | 1 = rng.chance(0.5) ? 0 : 1;
  const electBat = rng.chance(0.45);
  const battingFirst: 0 | 1 = electBat ? tossWinner : ((1 - tossWinner) as 0 | 1);
  const timeline: TimedPlay[] = [];
  const tossText = `${nameOf(teamIds[tossWinner])} won the toss and chose to ${electBat ? 'bat' : 'bowl'} first.`;
  timeline.push({ at: meta.startsAt, clock: '0.0', importance: 2, tag: 'TOSS', competitorId: teamIds[tossWinner],
    description: tossText, scoreAfter: null });

  const first = playInnings(rng, prng, 0, battingFirst, meta.startsAt + 60_000, null, squads, strengths, timeline, teamIds);
  const firstRuns = first.balls.reduce((a, b) => a + b.runs + b.extras, 0);
  const firstW = first.balls.filter((b) => b.wicket).length;
  const firstLegal = first.balls.filter((b) => b.legal).length;
  const h1 = heroesOf(first, squads);
  timeline.push({ at: first.end, clock: 'Innings', importance: 3, tag: 'INNINGS', competitorId: teamIds[battingFirst],
    description: `${nameOf(teamIds[battingFirst])} finish on ${firstRuns}/${firstW} (${formatOvers(firstLegal)} ov). Target: ${firstRuns + 1}. `
      + `Top score: ${h1.bat.short} ${h1.top.runs}${h1.top.out ? '' : '*'} (${h1.top.balls}); best bowling: ${h1.bowl.short} ${h1.best.wkts}/${h1.best.runs}.`,
    scoreAfter: null, playerIds: [h1.bat.id, h1.bowl.id], playerRoles: ['bat', 'bowl'], headline: 'Innings', period: 0 });

  const chasing = (1 - battingFirst) as 0 | 1;
  const second = playInnings(rng, prng, 1, chasing, first.end + BREAK_MS, firstRuns + 1, squads, strengths, timeline, teamIds);
  const endsAt = second.end + 3 * MINUTE;
  const secondRuns = second.balls.reduce((a, b) => a + b.runs + b.extras, 0);
  const secondW = second.balls.filter((b) => b.wicket).length;
  const secondLegal = second.balls.filter((b) => b.legal).length;
  let result: string;
  let winnerSide: 0 | 1 | null;
  if (secondRuns > firstRuns) {
    winnerSide = chasing;
    result = `${nameOf(teamIds[chasing])} won by ${10 - secondW} wickets (${MAX_BALLS - secondLegal} balls left)`;
  } else if (secondRuns < firstRuns) {
    winnerSide = battingFirst;
    result = `${nameOf(teamIds[battingFirst])} won by ${firstRuns - secondRuns} runs`;
  } else {
    winnerSide = null;
    result = 'Match tied';
  }
  const innings: [Innings, Innings] = [first, second];
  const stats = buildStats(meta, innings, squads);
  const potm = playerOfTheMatch(stats, squads, winnerSide);
  timeline.push({ at: endsAt - 1, clock: 'Result', importance: 3, tag: 'FINAL',
    competitorId: winnerSide === null ? null : teamIds[winnerSide],
    description: potm ? `${result}! Player of the match: ${potm.player.short} (${potm.summary}).` : `${result}!`, scoreAfter: null,
    ...(potm ? { playerIds: [potm.player.id], playerRoles: [potm.role], headline: 'Player of the match', period: 1 } : null) });

  return { innings, endsAt, squads, timeline: sortTimeline(timeline), tossText, stats };
}

/** The best fantasy performer, from the winning side when there is one. */
function playerOfTheMatch(stats: GameStats, squads: [Player[], Player[]], winnerSide: 0 | 1 | null) {
  const lines = linesUpTo('cricket', stats.events);
  const pool = winnerSide === null ? [...squads[0], ...squads[1]] : squads[winnerSide];
  let best: { player: Player; line: StatLine; pts: number } | null = null;
  for (const player of pool) {
    const line = lines.get(player.id);
    if (!line) continue;
    const pts = pointsOf('cricket', line);
    if (!best || pts > best.pts) best = { player, line, pts };
  }
  if (!best) return null;
  const l = best.line;
  const n = (k: string) => l[k] ?? 0;
  const parts: string[] = [];
  if (n('balls') > 0 && (n('runs') >= 20 || n('wkts') === 0)) parts.push(`${n('runs')}${n('out') ? '' : '*'} off ${n('balls')}`);
  if (n('wkts') > 0) parts.push(`${n('wkts')}/${n('rc')}`);
  if (!parts.length) parts.push(`${n('ct') + n('st') + n('ro')} dismissals in the field`);
  const role = n('wkts') > 0 && n('runs') < 20 ? 'bowl' : n('balls') > 0 ? 'bat' : 'field';
  return { player: best.player, summary: parts.join(' and '), role };
}

interface InningsNow {
  runs: number;
  wickets: number;
  legal: number;
  extras: number;
  started: boolean;
  done: boolean;
}

function inningsAt(inn: Innings, now: number): InningsNow {
  const balls = inn.balls.filter((b) => b.at <= now);
  return {
    runs: balls.reduce((a, b) => a + b.runs + b.extras, 0),
    wickets: balls.filter((b) => b.wicket).length,
    legal: balls.filter((b) => b.legal).length,
    extras: balls.reduce((a, b) => a + b.extras, 0),
    started: now >= inn.start,
    done: now >= inn.end,
  };
}

function scoreLine(s: InningsNow): string {
  if (s.wickets >= 10) return `${s.runs} all out (${formatOvers(s.legal)} ov)`;
  return `${s.runs}/${s.wickets} (${formatOvers(s.legal)} ov)`;
}

function scorecard(script: CricketScript, inn: Innings, now: number, teamIds: string[]): StatsSection[] {
  const bat = script.squads[inn.battingSide];
  const bowl = script.squads[1 - inn.battingSide];
  const balls = inn.balls.filter((b) => b.at <= now);
  if (balls.length === 0) return [];
  const batters = inn.order.filter((idx) => balls.some((b) => b.batter === idx) || idx < 2);
  const battingRows = batters.map((idx) => {
    const faced = balls.filter((b) => b.batter === idx && b.legal);
    const r = faced.reduce((a, b) => a + b.runs, 0);
    const out = faced.find((b) => b.wicket);
    const sr = faced.length > 0 ? ((r / faced.length) * 100).toFixed(0) : '0';
    return { key: `bat${idx}`, cells: [`${bat[idx].short}${out ? '' : '*'}`, String(r), String(faced.length),
      String(faced.filter((b) => b.runs === 4).length), String(faced.filter((b) => b.runs === 6).length), sr] };
  });
  const bowlers = [...new Set(balls.map((b) => b.bowler))];
  const bowlingRows = bowlers.map((idx) => {
    const mine = balls.filter((b) => b.bowler === idx);
    const legal = mine.filter((b) => b.legal).length;
    const r = mine.reduce((a, b) => a + b.runs + b.extras, 0);
    const w = mine.filter((b) => b.wicket && b.how !== 'runout').length;
    const econ = legal > 0 ? ((r / legal) * 6).toFixed(1) : '0.0';
    return { key: `bowl${idx}`, cells: [bowl[idx].short, formatOvers(legal), String(r), String(w), econ] };
  });
  const s = inningsAt(inn, now);
  const team = shortOf(teamIds[inn.battingSide]);
  return [
    { type: 'table', title: `${team} batting · ${scoreLine(s)}`, columns: ['Batter', 'R', 'B', '4s', '6s', 'SR'], rows: battingRows },
    { type: 'table', title: `${shortOf(teamIds[1 - inn.battingSide])} bowling`, columns: ['Bowler', 'O', 'R', 'W', 'Econ'], rows: bowlingRows },
    { type: 'note', title: 'Extras and run rate', text: `Extras ${s.extras} · Run rate ${s.legal > 0 ? ((s.runs / s.legal) * 6).toFixed(2) : '0.00'}` },
  ];
}

function scriptFor(meta: EventMeta): CricketScript {
  return cachedScript(`cricket:${meta.id}`, () => buildScript(meta));
}

export function simulateCricket(meta: EventMeta, now: number): EventState {
  if (meta.disruption) return disruptedState(meta);
  const script = scriptFor(meta);
  const status = statusAt(meta, script.endsAt, now);
  const progress = progressAt(meta, script.endsAt, now);
  const [first, second] = script.innings;
  const s1 = inningsAt(first, now);
  const s2 = inningsAt(second, now);
  const teamIds = meta.competitorIds;
  const finished = status === 'finished';
  const final1 = inningsAt(first, Infinity);
  const final2 = inningsAt(second, Infinity);
  const winnerSide = final2.runs > final1.runs ? second.battingSide : final2.runs < final1.runs ? first.battingSide : null;

  const entries: EntryState[] = teamIds.map((id, side) => {
    const isFirst = first.battingSide === side;
    const s = isFirst ? s1 : s2;
    let scoreText: string | null = null;
    if (status === 'live' || finished) scoreText = s.started && (s.legal > 0 || s.runs > 0) ? scoreLine(s) : 'Yet to bat';
    const battingNow = status === 'live' && ((isFirst && !s1.done) || (!isFirst && s2.started && !s2.done));
    return {
      competitorId: id, role: side === 0 ? 'home' : 'away',
      score: s.started ? s.runs : null, scoreText, position: null,
      isWinner: finished ? (winnerSide === null ? null : winnerSide === side) : null,
      note: battingNow ? 'Batting' : null,
    };
  });

  let periodLabel: string | null = null;
  if (status === 'live') {
    if (!s1.done) periodLabel = `1st inns · ${formatOvers(s1.legal)} ov · RR ${s1.legal > 0 ? ((s1.runs / s1.legal) * 6).toFixed(1) : '0.0'}`;
    else if (!s2.started) periodLabel = 'Innings break';
    else if (!s2.done) periodLabel = `Need ${Math.max(0, final1.runs + 1 - s2.runs)} from ${MAX_BALLS - s2.legal} balls`;
    else periodLabel = 'Presentation';
  }

  const stats: StatsSection[] = progress <= 0 ? [preMatchNote(meta), { type: 'note', title: 'Toss', text: 'Toss at the scheduled start.' }]
    : [
        { type: 'note', title: 'Toss', text: script.tossText },
        ...scorecard(script, first, now, teamIds),
        ...scorecard(script, second, now, teamIds),
        { type: 'compare', title: 'Boundaries', items: [
          { label: 'Fours', home: countAt(script, now, 0, 4), away: countAt(script, now, 1, 4) },
          { label: 'Sixes', home: countAt(script, now, 0, 6), away: countAt(script, now, 1, 6) },
        ] },
      ];

  const resultText = !finished ? null : winnerSide === null ? 'Match tied'
    : winnerSide === second.battingSide
      ? `${nameOf(teamIds[winnerSide])} won by ${10 - final2.wickets} wickets`
      : `${nameOf(teamIds[winnerSide])} won by ${final1.runs - final2.runs} runs`;

  return {
    meta, status, periodLabel, progress, entries,
    plays: playsUpTo(meta, script.timeline, now),
    stats, resultText,
    facts: {
      firstInningsRuns: final1.runs,
      winner: winnerSide === null ? 'draw' : winnerSide === 0 ? 'home' : 'away',
      battingFirst: first.battingSide === 0 ? 'home' : 'away',
      totalSixes: [...first.balls, ...second.balls].filter((b) => b.runs === 6).length,
    },
    endsAt: script.endsAt,
  };
}

function countAt(script: CricketScript, now: number, side: number, runs: number): number {
  return script.innings
    .filter((inn) => inn.battingSide === side)
    .flatMap((inn) => inn.balls)
    .filter((b) => b.at <= now && b.runs === runs).length;
}

/**
 * Per-player stats for one event (the whole game; readers cut it at "now"):
 * batters (runs, balls, fours, sixes, out), bowlers (balls, runs conceded
 * including wides, wickets, maidens) and fielders (catches, stumpings, run outs).
 * Wides are extras: they count against the bowler and the total, never a batter.
 */
export function cricketGameStats(meta: EventMeta): GameStats {
  return scriptFor(meta).stats;
}
