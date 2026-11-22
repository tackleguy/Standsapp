// Ball-by-ball T20 cricket simulator with batting and bowling scorecards.
import { formatOvers, MINUTE } from '@/lib/format';
import { createRng, type Rng } from '@/lib/random';

import type { EntryState, EventMeta, EventState, StatsSection } from '../../types';
import { squadFor } from '../world';
import {
  cachedScript, disruptedState, nameOf, playsUpTo, preMatchNote, progressAt, shortOf, sortTimeline,
  statusAt, strengthOf, type TimedPlay,
} from './common';

const BALL_MS = 40_000;
const WIDE_MS = 20_000;
const BREAK_MS = 15 * MINUTE;
const MAX_BALLS = 120;

interface Ball {
  at: number;
  inn: 0 | 1;
  legal: boolean;
  runs: number; // runs off the bat
  extras: number;
  wicket: string | null; // dismissal text
  batter: number;
  bowler: number;
}

interface Innings {
  battingSide: 0 | 1;
  start: number;
  end: number;
  balls: Ball[];
  order: number[]; // batting order indices into squad, in the order they came in
}

interface CricketScript {
  innings: [Innings, Innings];
  endsAt: number;
  squads: [string[], string[]];
  timeline: TimedPlay[];
  tossText: string;
}

const DISMISSALS = [
  { w: 0.32, make: (b: string, f: string) => `c ${f} b ${b}` },
  { w: 0.22, make: (b: string) => `b ${b}` },
  { w: 0.16, make: (b: string) => `lbw b ${b}` },
  { w: 0.18, make: (_b: string, f: string) => `run out (${f})` },
  { w: 0.12, make: (b: string) => `c & b ${b}` },
];

function pickDismissal(rng: Rng, bowler: string, fielder: string): string {
  let roll = rng.next();
  for (const d of DISMISSALS) {
    if (roll < d.w) return d.make(bowler, fielder);
    roll -= d.w;
  }
  return `b ${bowler}`;
}

function surname(name: string): string {
  return name.split(' ').slice(-1)[0];
}

function playInnings(
  rng: Rng, inn: 0 | 1, battingSide: 0 | 1, start: number, target: number | null,
  squads: [string[], string[]], strengths: [number, number], timeline: TimedPlay[], teamIds: string[],
): Innings {
  const bat = squads[battingSide];
  const bowl = squads[1 - battingSide];
  const adv = strengths[battingSide] - strengths[1 - battingSide];
  const balls: Ball[] = [];
  const order = [0, 1];
  let striker = 0;
  let nonStriker = 1;
  let nextIn = 2;
  let legal = 0;
  let runs = 0;
  let wickets = 0;
  let t = start;
  const batterRuns = new Map<number, number>();
  const bowlerOrder = [10, 9, 8, 7, 6];
  const teamShort = shortOf(teamIds[battingSide]);

  while (legal < MAX_BALLS && wickets < 10 && (target === null || runs < target)) {
    const over = Math.floor(legal / 6);
    const bowler = bowlerOrder[over % 5];
    const phase = over < 6 ? 'powerplay' : over >= 16 ? 'death' : 'middle';
    const pWide = 0.03;
    if (rng.chance(pWide)) {
      runs += 1;
      balls.push({ at: t, inn, legal: false, runs: 0, extras: 1, wicket: null, batter: striker, bowler });
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
    if (roll < pW) wicket = pickDismissal(rng, surname(bowl[bowler]), surname(rng.pick(bowl)));
    else if (roll < pW + p6) r = 6;
    else if (roll < pW + p6 + p4) r = 4;
    else if (roll < pW + p6 + p4 + p2) r = rng.chance(0.08) ? 3 : 2;
    else if (roll < pW + p6 + p4 + p2 + p1) r = 1;
    legal++;
    runs += r;
    balls.push({ at: t, inn, legal: true, runs: r, extras: 0, wicket, batter: striker, bowler });
    const ballLabel = `${Math.floor((legal - 1) / 6)}.${((legal - 1) % 6) + 1}`;
    const before = batterRuns.get(striker) ?? 0;
    batterRuns.set(striker, before + r);
    const name = bat[striker];
    if (r === 6) {
      timeline.push({ at: t, clock: ballLabel, importance: 2, tag: 'SIX', competitorId: teamIds[battingSide],
        description: `SIX! ${name} launches ${surname(bowl[bowler])} over ${rng.pick(['long-on', 'deep midwicket', 'long-off', 'cow corner', 'the sightscreen'])}!`,
        scoreAfter: `${teamShort} ${runs}/${wickets}` });
    } else if (r === 4) {
      timeline.push({ at: t, clock: ballLabel, importance: 1, tag: 'FOUR', competitorId: teamIds[battingSide],
        description: `FOUR! ${name} ${rng.pick(['drives through the covers', 'cuts hard past point', 'flicks off the pads to fine leg', 'pulls in front of square', 'edges it past the keeper'])}.`,
        scoreAfter: `${teamShort} ${runs}/${wickets}` });
    }
    const after = before + r;
    if (before < 50 && after >= 50) {
      timeline.push({ at: t + 1, clock: ballLabel, importance: 2, tag: 'FIFTY', competitorId: teamIds[battingSide],
        description: `Fifty for ${name}! A brilliant knock for ${nameOf(teamIds[battingSide])}.`, scoreAfter: null });
    }
    if (before < 100 && after >= 100) {
      timeline.push({ at: t + 1, clock: ballLabel, importance: 3, tag: 'HUNDRED', competitorId: teamIds[battingSide],
        description: `HUNDRED! ${name} brings up a T20 century!`, scoreAfter: null });
    }
    if (wicket) {
      wickets++;
      timeline.push({ at: t, clock: ballLabel, importance: 3, tag: 'WICKET', competitorId: teamIds[1 - battingSide],
        description: `WICKET! ${name} ${wicket} for ${after}.`, scoreAfter: `${teamShort} ${runs}/${wickets}` });
      if (nextIn < 11 && wickets < 10) {
        order.push(nextIn);
        striker = nextIn;
        nextIn++;
      }
    } else if (r % 2 === 1) {
      [striker, nonStriker] = [nonStriker, striker];
    }
    t += BALL_MS;
    if (legal % 6 === 0 && legal < MAX_BALLS && wickets < 10 && (target === null || runs < target)) {
      [striker, nonStriker] = [nonStriker, striker];
      const overNo = legal / 6;
      const need = target !== null ? ` · need ${target - runs} from ${MAX_BALLS - legal}` : '';
      timeline.push({ at: t - 1, clock: `${overNo}.0`, importance: 1, tag: 'OVER', competitorId: null,
        description: `End of over ${overNo}: ${teamShort} ${runs}/${wickets}${need}.`, scoreAfter: null });
    }
  }
  return { battingSide, start, end: t, balls, order };
}

function buildScript(meta: EventMeta): CricketScript {
  const rng = createRng(`cricket:${meta.id}`);
  const teamIds = meta.competitorIds;
  const squads: [string[], string[]] = [squadFor(teamIds[0], 11), squadFor(teamIds[1], 11)];
  const strengths: [number, number] = [strengthOf(teamIds[0]) + 0.03, strengthOf(teamIds[1])];
  const tossWinner: 0 | 1 = rng.chance(0.5) ? 0 : 1;
  const electBat = rng.chance(0.45);
  const battingFirst: 0 | 1 = electBat ? tossWinner : ((1 - tossWinner) as 0 | 1);
  const timeline: TimedPlay[] = [];
  const tossText = `${nameOf(teamIds[tossWinner])} won the toss and chose to ${electBat ? 'bat' : 'bowl'} first.`;
  timeline.push({ at: meta.startsAt, clock: '0.0', importance: 2, tag: 'TOSS', competitorId: teamIds[tossWinner],
    description: tossText, scoreAfter: null });

  const first = playInnings(rng, 0, battingFirst, meta.startsAt + 60_000, null, squads, strengths, timeline, teamIds);
  const firstRuns = first.balls.reduce((a, b) => a + b.runs + b.extras, 0);
  const firstW = first.balls.filter((b) => b.wicket).length;
  const firstLegal = first.balls.filter((b) => b.legal).length;
  timeline.push({ at: first.end, clock: 'Innings', importance: 3, tag: 'INNINGS', competitorId: teamIds[battingFirst],
    description: `${nameOf(teamIds[battingFirst])} finish on ${firstRuns}/${firstW} (${formatOvers(firstLegal)} ov). Target: ${firstRuns + 1}.`,
    scoreAfter: null });

  const chasing = (1 - battingFirst) as 0 | 1;
  const second = playInnings(rng, 1, chasing, first.end + BREAK_MS, firstRuns + 1, squads, strengths, timeline, teamIds);
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
  timeline.push({ at: endsAt - 1, clock: 'Result', importance: 3, tag: 'FINAL',
    competitorId: winnerSide === null ? null : teamIds[winnerSide], description: `${result}!`, scoreAfter: null });

  return { innings: [first, second], endsAt, squads, timeline: sortTimeline(timeline), tossText };
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
    return { key: `bat${idx}`, cells: [`${bat[idx]}${out ? '' : '*'}`, String(r), String(faced.length),
      String(faced.filter((b) => b.runs === 4).length), String(faced.filter((b) => b.runs === 6).length), sr] };
  });
  const bowlers = [...new Set(balls.map((b) => b.bowler))];
  const bowlingRows = bowlers.map((idx) => {
    const mine = balls.filter((b) => b.bowler === idx);
    const legal = mine.filter((b) => b.legal).length;
    const r = mine.reduce((a, b) => a + b.runs + b.extras, 0);
    const w = mine.filter((b) => b.wicket && !b.wicket.startsWith('run out')).length;
    const econ = legal > 0 ? ((r / legal) * 6).toFixed(1) : '0.0';
    return { key: `bowl${idx}`, cells: [bowl[idx], formatOvers(legal), String(r), String(w), econ] };
  });
  const s = inningsAt(inn, now);
  const team = shortOf(teamIds[inn.battingSide]);
  return [
    { type: 'table', title: `${team} batting · ${scoreLine(s)}`, columns: ['Batter', 'R', 'B', '4s', '6s', 'SR'], rows: battingRows },
    { type: 'table', title: `${shortOf(teamIds[1 - inn.battingSide])} bowling`, columns: ['Bowler', 'O', 'R', 'W', 'Econ'], rows: bowlingRows },
    { type: 'note', title: 'Extras and run rate', text: `Extras ${s.extras} · Run rate ${s.legal > 0 ? ((s.runs / s.legal) * 6).toFixed(2) : '0.00'}` },
  ];
}

export function simulateCricket(meta: EventMeta, now: number): EventState {
  if (meta.disruption) return disruptedState(meta);
  const script = cachedScript(`cricket:${meta.id}`, () => buildScript(meta));
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
