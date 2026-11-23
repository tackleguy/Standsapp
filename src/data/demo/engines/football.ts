// American football, snap by snap. Every play has a down, distance, ball spot,
// personnel grouping and the named players involved, so the feed, box score and
// fantasy points all come from the same game. Like every simulator it writes the
// whole game from a seed, then reveals it as real time passes.
import { MINUTE } from '@/lib/format';
import { createRng, type Rng } from '@/lib/random';

import type { EntryState, EventMeta, EventState, FootballSnap, Importance, StatsSection } from '../../types';
import { linesUpTo } from '../players/lines';
import { rosterFor } from '../players/roster';
import type { GameStats, Player, StatEvent, StatLine } from '../players/types';
import { competitorById, venueFor } from '../world';
import {
  cachedScript, disruptedState, impactOf, mmss, nameOf, playsUpTo, preMatchNote, progressAt, shortOf, statusAt,
  strengthOf, type TimedPlay,
} from './common';

const QUARTER_SEC = 900;
const OT_SEC = 600;
const QUARTER_REAL = 44 * MINUTE;
const OT_REAL = 22 * MINUTE;
const BREAKS = [{ min: 3, label: 'End of Q1' }, { min: 18, label: 'Half-time' }, { min: 3, label: 'End of Q3' }];
const HOME_EDGE = 0.05;
/** Average combined score, used to set the over/under line. */
export const FOOTBALL_EXPECTED_TOTAL = 44;

type Side = 0 | 1;

interface Period {
  label: string;
  seconds: number;
  start: number;
  end: number;
  breakAfter: { min: number; label: string } | null;
}

interface Team {
  side: Side;
  id: string;
  short: string;
  qb: Player;
  rb: Player[];
  wr: Player[];
  te: Player[];
  k: Player;
  p: Player;
  dl: Player[];
  lb: Player[];
  db: Player[];
  str: number;
  passLean: number;
}

/** Team numbers for the box score, one row per scrimmage play or penalty. */
interface TeamLog {
  at: number;
  side: Side;
  kind: FootballSnap['kind'];
  yards: number;
  firstDown: boolean;
  /** 'conv' / 'fail' for third-down plays. */
  third: 'conv' | 'fail' | null;
  turnover: boolean;
  success: boolean;
  penaltyYds: number;
  /** Side that committed the penalty. */
  penaltySide: Side | null;
}

interface FootballScript {
  periods: Period[];
  endsAt: number;
  timeline: TimedPlay[];
  events: StatEvent[];
  log: TeamLog[];
  /** Points per side per period, with the real time they were scored. */
  scores: { at: number; side: Side; points: number; period: number }[];
  finalScore: [number, number];
  firstScore: Side | null;
  lineups: string[][];
}

function buildPeriods(start: number): Period[] {
  const out: Period[] = [];
  let t = start;
  for (let q = 0; q < 4; q++) {
    const brk = BREAKS[q] ?? null;
    out.push({ label: `Q${q + 1}`, seconds: QUARTER_SEC, start: t, end: t + QUARTER_REAL, breakAfter: brk });
    t += QUARTER_REAL + (brk ? brk.min * MINUTE : 0);
  }
  return out;
}

function makeTeam(side: Side, id: string, rng: Rng, edge: number): Team {
  const roster = rosterFor(id);
  const by = (pos: string) => roster.filter((p) => p.pos === pos);
  return {
    side, id, short: shortOf(id),
    qb: by('QB')[0], rb: by('RB'), wr: by('WR'), te: by('TE'), k: by('K')[0], p: by('P')[0],
    dl: by('DL'), lb: by('LB'), db: by('DB'),
    str: strengthOf(id) + edge,
    passLean: rng.float(-0.06, 0.06),
  };
}

/** Weighted pick from [item, weight] pairs. */
function weighted<T>(rng: Rng, items: [T, number][]): T {
  const total = items.reduce((a, [, w]) => a + w, 0);
  let r = rng.next() * total;
  for (const [item, w] of items) {
    r -= w;
    if (r <= 0) return item;
  }
  return items[items.length - 1][0];
}

const ordinal = (d: number) => ['', '1st', '2nd', '3rd', '4th'][d] ?? `${d}th`;

/** "3rd & 4", "1st & Goal". */
export function downText(down: number, distance: number, yardLine: number): string {
  if (down < 1) return '';
  return `${ordinal(down)} & ${distance >= 100 - yardLine ? 'Goal' : distance}`;
}

/** "SEA 35", "NE 20", "50": the ball spot from the offense's own goal line. */
export function spotText(yardLine: number, offenseShort: string, defenseShort: string): string {
  if (yardLine === 50) return '50';
  return yardLine < 50 ? `${offenseShort} ${yardLine}` : `${defenseShort} ${100 - yardLine}`;
}

function fgChance(distance: number, skill: number): number {
  const base = distance <= 29 ? 0.985 : distance <= 39 ? 0.93 : distance <= 49 ? 0.83 : distance <= 54 ? 0.68 : distance <= 59 ? 0.48 : 0.25;
  return Math.min(0.995, Math.max(0.05, base + (skill - 0.6) * 0.2));
}

function buildScript(meta: EventMeta): FootballScript {
  const rng = createRng(`football:${meta.id}`);
  const [homeId, awayId] = meta.competitorIds;
  const teams: [Team, Team] = [makeTeam(0, homeId, rng, HOME_EDGE), makeTeam(1, awayId, rng, 0)];
  const periods = buildPeriods(meta.startsAt);
  const timeline: TimedPlay[] = [];
  const events: StatEvent[] = [];
  const log: TeamLog[] = [];
  const scores: FootballScript['scores'] = [];
  const score: [number, number] = [0, 0];
  let firstScore: Side | null = null;

  let period = 0;
  let clock = QUARTER_SEC;
  const openingKicker: Side = rng.chance(0.5) ? 0 : 1;
  let kicker: Side = openingKicker;
  let phase: 'kickoff' | 'play' = 'kickoff';
  let poss: Side = 1 - openingKicker as Side;
  let yl = 25;
  let down = 1;
  let dist = 10;
  let over = false;
  let endsAt = periods[3].end;

  const atOf = (clockLeft: number) => {
    const p = periods[period];
    return Math.round(p.start + ((p.seconds - Math.max(0, clockLeft)) / p.seconds) * (p.end - p.start));
  };
  const clockLabel = (clockLeft: number) => `${periods[period].label} ${mmss(Math.max(0, clockLeft) / 60)}`;
  const credit = (at: number, player: Player | undefined, stats: StatLine) => {
    if (player) events.push({ at, period, playerId: player.id, stats });
  };
  const addScore = (at: number, side: Side, points: number) => {
    score[side] += points;
    if (firstScore === null) firstScore = side;
    scores.push({ at, side, points, period });
  };
  const scoreLine = () => `${score[0]}-${score[1]}`;
  const late = () => period >= 3 && Math.abs(score[0] - score[1]) <= 8;

  const push = (p: {
    at: number; clockLeft: number; description: string; competitorId: string | null; importance: Importance; tag: string;
    scored?: boolean; players?: [Player | undefined, string][]; headline: string; impact: number; snap: Omit<FootballSnap, 'clockSec'> | null;
  }) => {
    const players = (p.players ?? []).filter((x): x is [Player, string] => !!x[0]);
    timeline.push({
      at: p.at, clock: clockLabel(p.clockLeft), description: p.description, competitorId: p.competitorId, importance: p.importance,
      tag: p.tag, scoreAfter: p.scored ? scoreLine() : null,
      playerIds: players.map(([pl]) => pl.id), playerRoles: players.map(([, r]) => r),
      headline: p.headline, impact: impactOf(p.impact * (late() ? 1.12 : 1)), period,
      football: p.snap ? { ...p.snap, clockSec: Math.max(0, Math.round(p.clockLeft)) } : undefined,
    });
  };

  const snapBase = (kind: FootballSnap['kind'], personnel: string | null) => ({
    offenseId: teams[poss].id, down, distance: dist, yardLine: yl, personnel, kind,
  });

  const kickoff = () => {
    const kt = teams[kicker];
    const rt = teams[1 - kicker as Side];
    const at = atOf(clock);
    poss = rt.side;
    down = 1;
    dist = 10;
    if (rng.chance(0.62)) {
      yl = 30;
      push({ at, clockLeft: clock, description: `${kt.k.short} kicks off. Touchback, ${rt.short} start at their own 30.`, competitorId: kt.id,
        importance: 1, tag: 'KICKOFF', players: [[kt.k, 'kick']], headline: 'Kickoff, touchback', impact: 0.3,
        snap: { offenseId: kt.id, down: 0, distance: 0, yardLine: 35, personnel: null, kind: 'kickoff', yards: 0, firstDown: false, touchdown: false, yac: null, success: false } });
    } else {
      const returner = rng.chance(0.6) ? rt.rb[1] : rt.wr[2];
      yl = rng.chance(0.07) ? rng.int(41, 55) : rng.int(19, 40);
      const big = yl >= 41;
      push({ at, clockLeft: clock, description: `${kt.k.short} kicks off. ${returner.short} returns it to the ${spotText(yl, rt.short, kt.short)}${big ? ' — great return!' : '.'}`,
        competitorId: rt.id, importance: big ? 2 : 1, tag: 'KICKOFF', players: [[returner, 'ret'], [kt.k, 'kick']],
        headline: big ? 'Big kick return' : 'Kick return', impact: big ? 3.2 : 0.8,
        snap: { offenseId: kt.id, down: 0, distance: 0, yardLine: 35, personnel: null, kind: 'kickoff', yards: 0, firstDown: false, touchdown: false, yac: null, success: false } });
      clock -= rng.int(4, 7);
    }
    phase = 'play';
  };

  const afterTouchdown = (side: Side, at: number) => {
    const t = teams[side];
    // A touchdown ends overtime: no extra point.
    if (period === 4) { phase = 'kickoff'; return; }
    const margin = score[side] - score[1 - side];
    const goForTwo = period >= 3 && [-2, 1, 5, -5, -10].includes(margin);
    if (goForTwo) {
      const pass = rng.chance(0.55);
      const scorer = pass ? weighted(rng, [[t.wr[0], 3], [t.te[0], 2], [t.wr[1], 2], [t.rb[0], 1]]) : rng.chance(0.75) ? t.rb[0] : t.qb;
      const good = rng.chance(0.47);
      if (good) {
        addScore(at, side, 2);
        credit(at, scorer, { twoPt: 1 });
        if (pass) credit(at, t.qb, { twoPt: 1 });
      }
      push({ at, clockLeft: clock, description: good
        ? `Two-point try is GOOD! ${pass ? `${t.qb.short} finds ${scorer.short}` : `${scorer.short} pushes in`}.`
        : `Two-point try fails. ${pass ? `${t.qb.short}'s pass for ${scorer.short} falls incomplete` : `${scorer.short} is stopped short`}.`,
      competitorId: t.id, importance: 2, tag: '2PT', scored: good, players: [[scorer, pass ? 'rec' : 'rush'], ...(pass ? [[t.qb, 'pass'] as [Player, string]] : [])],
      headline: good ? 'Two-point try good' : 'Two-point try fails', impact: good ? 3 : 0.4,
      snap: { offenseId: t.id, down: 0, distance: 2, yardLine: 98, personnel: '11', kind: 'two', yards: good ? 2 : 0, firstDown: false, touchdown: good, yac: null, success: good } });
    } else {
      const good = rng.chance(Math.min(0.99, 0.93 + (t.k.skill - 0.6) * 0.1));
      if (good) addScore(at, side, 1);
      credit(at, t.k, good ? { pat: 1 } : { patMiss: 1 });
      push({ at, clockLeft: clock, description: good ? `${t.k.short} extra point is good.` : `${t.k.short} extra point is NO good — off the upright!`,
        competitorId: t.id, importance: 1, tag: good ? 'PAT' : 'PAT_MISS', scored: good, players: [[t.k, 'kick']],
        headline: good ? 'Extra point' : 'Extra point missed', impact: good ? 0.3 : 0.1,
        snap: { offenseId: t.id, down: 0, distance: 0, yardLine: 85, personnel: null, kind: 'pat', yards: 0, firstDown: false, touchdown: false, yac: null, success: good } });
    }
    kicker = side;
    phase = 'kickoff';
  };

  const fieldGoal = (personnel: string | null) => {
    const o = teams[poss];
    const d = teams[1 - poss as Side];
    const at = atOf(clock);
    const distance = 117 - yl;
    const good = rng.chance(fgChance(distance, o.k.skill));
    const clutch = period >= 3 && clock < 120 && score[poss] - score[1 - poss] >= -3 && score[poss] - score[1 - poss] <= 0;
    const snap = { ...snapBase('fg', personnel), yards: 0, firstDown: false, touchdown: false, yac: null, success: good };
    if (good) {
      addScore(at, poss, 3);
      credit(at, o.k, { fgAtt: 1, [distance >= 50 ? 'fg5' : distance >= 40 ? 'fg4' : 'fg3']: 1, fgLng: distance });
      push({ at, clockLeft: clock, description: `${o.k.short} ${distance}-yard field goal is GOOD${clutch ? ' — clutch!' : '.'}`, competitorId: o.id,
        importance: clutch ? 3 : 2, tag: 'FG', scored: true, players: [[o.k, 'kick']], headline: `${distance}-yd FG`,
        impact: 1.2 + (distance - 20) * 0.07 + (clutch ? 3 : 0), snap });
      kicker = poss;
      phase = 'kickoff';
    } else {
      credit(at, o.k, { fgAtt: 1, fgMiss: 1 });
      push({ at, clockLeft: clock, description: `${o.k.short} ${distance}-yard field goal is NO good, wide ${rng.chance(0.5) ? 'left' : 'right'}.`, competitorId: d.id,
        importance: 2, tag: 'FG_MISS', players: [[o.k, 'kick']], headline: `${distance}-yd FG missed`, impact: 0.2, snap });
      const spot = Math.max(20, 100 - (yl - 7));
      poss = d.side;
      yl = spot;
      down = 1;
      dist = 10;
    }
    log.push({ at, side: o.side, kind: 'fg', yards: 0, firstDown: false, third: null, turnover: false, success: good, penaltyYds: 0, penaltySide: null });
    clock -= rng.int(4, 6);
  };

  const punt = () => {
    const o = teams[poss];
    const d = teams[1 - poss as Side];
    const at = atOf(clock);
    const gross = Math.max(30, rng.int(38, 54) + Math.round((o.p.skill - 0.6) * 10));
    const landing = yl + gross;
    let newYl: number;
    let text: string;
    let in20 = false;
    const returner = rng.chance(0.5) ? d.wr[2] : d.db[3];
    if (landing >= 100) {
      newYl = 20;
      text = `${o.p.short} punts ${100 - yl} yards into the end zone. Touchback.`;
    } else if (rng.chance(0.42)) {
      newYl = Math.max(1, 100 - landing);
      in20 = newYl < 20;
      text = `${o.p.short} punts ${gross} yards. Fair catch by ${returner.short} at the ${spotText(newYl, d.short, o.short)}.`;
    } else {
      const ret = rng.chance(0.06) ? rng.int(15, 35) : rng.int(0, 13);
      newYl = Math.max(1, Math.min(99, 100 - landing + ret));
      in20 = 100 - landing < 20 && newYl < 20;
      text = `${o.p.short} punts ${gross} yards. ${returner.short} returns it ${ret} yards to the ${spotText(newYl, d.short, o.short)}.`;
    }
    credit(at, o.p, { punts: 1, puntYds: landing >= 100 ? 100 - yl : gross, ...(in20 ? { puntIn20: 1 } : {}) });
    push({ at, clockLeft: clock, description: text, competitorId: o.id, importance: 1, tag: 'PUNT', players: [[o.p, 'punt']],
      headline: `${landing >= 100 ? 100 - yl : gross}-yd punt`, impact: 0.4 + Math.max(0, gross - 40) * 0.05 + (in20 ? 0.6 : 0),
      snap: { ...snapBase('punt', null), yards: 0, firstDown: false, touchdown: false, yac: null, success: false } });
    poss = d.side;
    yl = newYl;
    down = 1;
    dist = 10;
    clock -= rng.int(6, 10);
  };

  const penalty = (isPass: boolean) => {
    const o = teams[poss];
    const d = teams[1 - poss as Side];
    const at = atOf(clock);
    const r = rng.next();
    let yards: number;
    let offense: boolean;
    let name: string;
    let autoFirst = false;
    if (r < 0.33) { yards = 5; offense = true; name = 'False start'; }
    else if (r < 0.62) { yards = 10; offense = true; name = 'Holding'; }
    else if (r < 0.82) { yards = 5; offense = false; name = 'Defensive offside'; }
    else if (isPass) { yards = rng.int(9, 32); offense = false; name = 'Pass interference'; autoFirst = true; }
    else { yards = 15; offense = false; name = 'Unnecessary roughness'; autoFirst = true; }
    if (offense) yards = Math.min(yards, Math.floor(yl / 2));
    else yards = Math.min(yards, Math.max(1, Math.floor((100 - yl) / 2)), 99 - yl);
    const snap = { ...snapBase('penalty', null), yards: offense ? -yards : yards, firstDown: false, touchdown: false, yac: null, success: !offense };
    if (offense) {
      yl -= yards;
      dist += yards;
    } else {
      yl += yards;
      dist -= yards;
      if (dist <= 0 || autoFirst) {
        down = 1;
        dist = Math.min(10, 100 - yl);
        snap.firstDown = true;
      }
    }
    const team = offense ? o : d;
    push({ at, clockLeft: clock, description: `Flag: ${name.toLowerCase()} on ${team.short}. ${yards} yards${autoFirst ? ', automatic first down' : offense ? ', replay the down' : ''}.`,
      competitorId: team.id, importance: autoFirst && yards >= 20 ? 2 : 1, tag: 'FLAG', headline: `Flag: ${name}`, impact: 0.2, snap });
    log.push({ at, side: o.side, kind: 'penalty', yards: 0, firstDown: snap.firstDown, third: null, turnover: false, success: false,
      penaltyYds: yards, penaltySide: team.side });
    if (name !== 'False start') clock -= rng.int(4, 8);
  };

  /** One scrimmage play: run, pass, sack or kneel. `fourth` marks a fourth-down attempt. */
  const scrimmage = (fourth: boolean) => {
    const o = teams[poss];
    const d = teams[1 - poss as Side];
    const at = atOf(clock);
    const diff = score[poss] - score[1 - poss];
    const twoMin = (period === 1 || period >= 3) && clock <= 120;
    const hurry = twoMin && (diff <= 0 || period === 1);
    const milk = period >= 3 && diff > 0 && clock <= 420;
    const edge = o.str - d.str;
    const goalToGo = dist >= 100 - yl;
    const startDown = down;

    // Kneel to end the game or the half.
    if ((period >= 3 && diff > 0 && clock <= (5 - down) * 40) || (period === 1 && clock <= 25 && yl < 60 && diff >= -7)) {
      credit(at, o.qb, { rushAtt: 1, rushYds: -1 });
      push({ at, clockLeft: clock, description: `${o.qb.short} takes a knee.`, competitorId: o.id, importance: 1, tag: 'KNEEL',
        players: [[o.qb, 'rush']], headline: 'Kneel down', impact: 0.1,
        snap: { ...snapBase('kneel', '22'), yards: -1, firstDown: false, touchdown: false, yac: null, success: false } });
      yl = Math.max(1, yl - 1);
      down += 1;
      dist += 1;
      clock -= 40;
      if (down > 4) { poss = d.side; yl = 100 - yl; down = 1; dist = 10; }
      return;
    }

    // Personnel and the play call.
    const personnel = weighted(rng, goalToGo && yl >= 97 || dist <= 1
      ? [['22', 3], ['13', 2], ['12', 3], ['21', 2], ['11', 2]]
      : (down === 3 && dist >= 6) || hurry
        ? [['11', 9], ['12', 1]]
        : [['11', 62], ['12', 20], ['21', 8], ['13', 4], ['22', 3]]);
    const rbCount = Number(personnel[0]);
    const teCount = Number(personnel[1]);
    let pPass = 0.56 + o.passLean;
    if (personnel === '11') pPass += 0.05;
    else if (personnel === '12') pPass -= 0.06;
    else pPass -= 0.18;
    if (down === 1) pPass -= 0.04;
    if (down === 2 && dist >= 8) pPass += 0.14;
    if (down === 2 && dist <= 3) pPass -= 0.14;
    if (down >= 3 && dist >= 5) pPass = 0.86;
    else if (down >= 3 && dist >= 3) pPass = 0.62;
    else if (down >= 3) pPass = 0.36;
    if (hurry) pPass += 0.25;
    if (period >= 3 && diff < -8) pPass += 0.18;
    if (milk) pPass -= 0.22;
    if (yl >= 97) pPass -= 0.15;
    pPass = Math.min(0.95, Math.max(0.15, pPass));

    // A flag before or during the play.
    if (rng.chance(0.052)) {
      penalty(rng.chance(pPass));
      return;
    }

    let kind: FootballSnap['kind'] = rng.chance(pPass) ? 'pass' : 'run';
    let yards = 0;
    let yac: number | null = null;
    let td = false;
    let turnover: 'int' | 'fumble' | null = null;
    let stopsClock = false;
    let carrier: Player | undefined;
    let target: Player | undefined;
    let defender: Player | undefined;
    let complete = false;
    let scramble = false;
    let headline = '';
    let description = '';
    let returnTd = false;
    let interceptSpot = 0;
    const toGoal = 100 - yl;
    const pickDefender = (weights: [Player[], number][]) => {
      const group = weighted(rng, weights.filter(([g]) => g.length > 0));
      return rng.pick(group.slice(0, Math.max(1, group.length)));
    };

    if (kind === 'pass') {
      const sackP = 0.064 - edge * 0.04;
      if (rng.chance(sackP)) {
        kind = 'sack';
        defender = pickDefender([[d.dl, 7], [d.lb, 3]]);
        yards = -Math.min(rng.int(3, 10), yl - 1 + (rng.chance(0.02) ? 1 : 0));
        if (yl + yards <= 0) yards = -yl;
        credit(at, o.qb, { sacked: 1 });
        credit(at, defender, { sacks: 1, tkl: 1 });
        if (rng.chance(0.08)) {
          credit(at, defender, { ff: 1 });
          if (rng.chance(0.5)) {
            turnover = 'fumble';
            credit(at, o.qb, { fumLost: 1 });
          }
        }
      } else if (rng.chance(0.03)) {
        kind = 'run';
        scramble = true;
        carrier = o.qb;
        yards = Math.min(toGoal, rng.int(1, 14));
      } else {
        const wrs = o.wr.slice(0, 5 - rbCount - teCount);
        const tes = o.te.slice(0, teCount);
        const rbs = o.rb.slice(0, rbCount);
        const pool: [Player, number][] = [
          ...wrs.map((p, i) => [p, [26, 19, 13][i] * (0.7 + p.skill * 0.5)] as [Player, number]),
          ...tes.map((p, i) => [p, [16, 7, 4][i] * (0.7 + p.skill * 0.5)] as [Player, number]),
          ...rbs.map((p, i) => [p, [11, 5][i] * (0.7 + p.skill * 0.5)] as [Player, number]),
        ];
        target = weighted(rng, pool);
        const r = rng.next();
        const depth = target.pos === 'RB' ? 'short' : target.pos === 'TE'
          ? (r < 0.58 ? 'short' : r < 0.95 ? 'mid' : 'deep')
          : (r < 0.42 ? 'short' : r < 0.8 ? 'mid' : 'deep');
        let air = depth === 'short' ? rng.int(-2, 5) : depth === 'mid' ? rng.int(6, 15) : rng.int(16, 42);
        air = Math.min(air, toGoal);
        const pComp = (depth === 'short' ? 0.77 : depth === 'mid' ? 0.6 : 0.38) + edge * 0.15
          + (o.qb.skill - 0.6) * 0.15 + (target.skill - 0.6) * 0.1 - (yl >= 90 ? 0.03 : 0);
        const pInt = Math.max(0.004, (depth === 'short' ? 0.012 : depth === 'mid' ? 0.026 : 0.05) - edge * 0.015 - (o.qb.skill - 0.6) * 0.02);
        credit(at, o.qb, { passAtt: 1 });
        credit(at, target, { tgt: 1 });
        if (rng.chance(pInt)) {
          turnover = 'int';
          defender = pickDefender([[d.db, 8], [d.lb, 2]]);
          credit(at, o.qb, { passInt: 1 });
          credit(at, defender, { ints: 1, pd: 1 });
          interceptSpot = yl + Math.max(air, 1);
          const ret = rng.chance(0.06) ? 100 : rng.int(0, 28);
          returnTd = 100 - interceptSpot + ret >= 100;
          yards = 0;
          stopsClock = true;
        } else if (rng.chance(Math.min(0.92, Math.max(0.2, pComp)))) {
          complete = true;
          let extra = depth === 'short' ? rng.int(0, target.pos === 'RB' ? 7 : 6) : depth === 'mid' ? rng.int(0, 5) : rng.int(0, 4);
          const breakaway = depth === 'short' ? 0.09 : depth === 'mid' ? 0.06 : 0.12;
          if (rng.chance(breakaway + (target.skill - 0.6) * 0.08)) extra += Math.round(-Math.log(1 - rng.next()) * (depth === 'deep' ? 18 : 15));
          yac = Math.max(0, Math.min(extra, toGoal - air));
          yards = air + yac;
          if (yl + yards <= 0) yards = -yl + 1;
          td = yards >= toGoal;
          credit(at, o.qb, { passCmp: 1, passYds: yards, passLng: yards, ...(td ? { passTd: 1 } : {}) });
          credit(at, target, { rec: 1, recYds: yards, recLng: yards, yac, ...(td ? { recTd: 1 } : {}) });
          if (!td && rng.chance(0.004)) {
            turnover = 'fumble';
            defender = pickDefender([[d.db, 6], [d.lb, 4]]);
            credit(at, target, { fumLost: 1 });
            credit(at, defender, { ff: 1 });
          }
          stopsClock = td || rng.chance(0.18);
        } else {
          stopsClock = true;
          if (rng.chance(0.35)) {
            defender = pickDefender([[d.db, 8], [d.lb, 2]]);
            credit(at, defender, { pd: 1 });
          }
        }
      }
    }

    if (kind === 'run') {
      if (!carrier) {
        carrier = weighted(rng, rbCount >= 2
          ? [[o.rb[0], 60], [o.rb[1], 30], [o.qb, 10]]
          : [[o.rb[0], 70], [o.rb[1], 20], [o.qb, 10]]);
        const u = rng.next();
        const bigP = 0.075 * (1 + edge * 1.5) + (carrier.skill - 0.6) * 0.05;
        if (u < 0.11 - edge * 0.04) yards = -rng.int(0, 3);
        else if (u > 1 - bigP) yards = 9 + Math.round(-Math.log(1 - rng.next()) * 12);
        else yards = rng.int(1, 3) + rng.int(0, 4) + (edge > 0.15 ? rng.int(0, 1) : 0);
        if (yl >= 95 && rng.chance(0.4)) yards = Math.min(yards, rng.int(-1, toGoal - 1));
        else if (yl >= 80) yards += rng.int(0, 2);
      }
      yards = Math.min(yards, toGoal);
      if (yl + yards <= 0) yards = -yl;
      td = yards >= toGoal;
      credit(at, carrier, { rushAtt: 1, rushYds: yards, rushLng: yards, ...(td ? { rushTd: 1 } : {}) });
      if (!td && rng.chance(0.008)) {
        defender = pickDefender([[d.lb, 5], [d.dl, 3], [d.db, 2]]);
        credit(at, defender, { ff: 1 });
        if (rng.chance(0.55)) {
          turnover = 'fumble';
          credit(at, carrier, { fumLost: 1 });
        }
      }
      stopsClock = td || rng.chance(0.12);
    }

    // The tackle.
    let tackler: Player | undefined;
    if ((kind === 'run' || complete) && !td && !turnover) {
      tackler = yards <= 1 ? pickDefender([[d.dl, 5], [d.lb, 4], [d.db, 1]]) : pickDefender([[d.lb, 5], [d.db, 4], [d.dl, 1]]);
      credit(at, tackler, { tkl: 1 });
    }

    const safety = !turnover && yl + yards <= 0;
    const firstDown = !td && !turnover && !safety && kind !== 'sack' && yards >= dist;
    const success = td || firstDown || (!turnover && kind !== 'sack' && yards >= (down === 1 ? 0.4 : down === 2 ? 0.6 : 1) * dist);
    const offenseName = o.short;

    // Words for the feed.
    const ydsWord = (y: number) => `${Math.abs(y)}-yd`;
    if (kind === 'sack') {
      headline = yards === 0 ? 'Sack' : `Sack, −${-yards}`;
      description = `${o.qb.short} is sacked by ${defender?.short ?? d.short} for ${yards === 0 ? 'no gain' : `a loss of ${-yards}`}${turnover ? ' — the ball comes loose and the defense recovers!' : '.'}`;
    } else if (turnover === 'int') {
      headline = returnTd ? 'Pick-six' : 'Interception';
      description = returnTd
        ? `PICK-SIX! ${defender?.short} intercepts ${o.qb.short} and takes it all the way back!`
        : `INTERCEPTED! ${defender?.short} picks off ${o.qb.short}${target ? `, intended for ${target.short}` : ''}.`;
    } else if (kind === 'run') {
      const who = carrier?.short ?? '';
      headline = td ? `${ydsWord(yards)} TD run` : yards > 0 ? `${ydsWord(yards)} rush` : yards === 0 ? 'No gain' : `${ydsWord(yards)} loss`;
      if (scramble) headline = td ? `${ydsWord(yards)} TD scramble` : `${ydsWord(yards)} scramble`;
      description = td
        ? `TOUCHDOWN! ${who} ${yards}-yard TD ${scramble ? 'scramble' : 'run'}!`
        : turnover === 'fumble'
          ? `FUMBLE! ${who} loses the ball and ${d.short} recover!`
          : `${who} ${scramble ? 'scrambles' : yards >= 15 ? 'breaks free' : rng.pick(['runs', 'up the middle', 'bounces outside'])} for ${yards === 0 ? 'no gain' : yards > 0 ? `${yards} yard${yards === 1 ? '' : 's'}` : `a loss of ${-yards}`}${firstDown ? '. First down.' : '.'}`;
    } else if (complete) {
      headline = td ? `${ydsWord(yards)} TD catch` : turnover ? 'Catch and fumble' : `${ydsWord(yards)} catch`;
      description = td
        ? `TOUCHDOWN! ${target?.short} ${yards}-yard catch from ${o.qb.short}!`
        : turnover === 'fumble'
          ? `FUMBLE! ${target?.short} catches it for ${yards} but ${d.short} strip it and recover!`
          : `${o.qb.short} to ${target?.short} for ${yards} yard${yards === 1 ? '' : 's'}${firstDown ? '. First down.' : '.'}`;
    } else if (kind === 'pass') {
      headline = 'Incomplete';
      description = `${o.qb.short} incomplete, intended for ${target?.short}${defender ? `. Broken up by ${defender.short}` : ''}.`;
    }

    // Rating.
    let impact = 0.2;
    if (td) impact = 0.6 + Math.max(0, yards) * 0.15 + 0.9 + 2.6;
    else if (turnover) impact = returnTd ? 9 : 5.5;
    else if (safety) impact = 6;
    else if (kind === 'sack') impact = 1.8 + (fourth ? 1.5 : 0);
    else if (yards > 0) impact = 0.6 + yards * 0.15 + (firstDown ? 0.9 : 0) + (firstDown && down >= 3 ? 0.6 : 0);
    else if (kind === 'run' && yards <= 0) impact = fourth ? 2.5 : 0.3;
    if (fourth && firstDown) impact += 1.5;

    const big = !td && !turnover && yards >= 20;
    const tag = td ? 'TD' : turnover === 'int' ? 'INT' : turnover === 'fumble' ? 'FUMBLE' : safety ? 'SAF' : kind === 'sack' ? 'SACK'
      : fourth ? '4TH' : big ? 'BIGPLAY' : kind === 'run' ? 'RUN' : 'PASS';
    const importance: Importance = td || turnover || safety ? 3 : big || kind === 'sack' || fourth ? 2 : 1;
    const defenseGains = turnover || safety || kind === 'sack';
    const players: [Player | undefined, string][] = kind === 'sack'
      ? [[defender, 'def'], [o.qb, 'pass']]
      : turnover === 'int'
        ? [[defender, 'def'], [o.qb, 'pass'], [target, 'rec']]
        : kind === 'run'
          ? [[carrier, 'rush'], [tackler ?? defender, 'def']]
          : complete
            ? [[target, 'rec'], [o.qb, 'pass'], [tackler ?? defender, 'def']]
            : [[o.qb, 'pass'], [target, 'rec'], [defender, 'def']];
    const snap: Omit<FootballSnap, 'clockSec'> = {
      ...snapBase(kind, personnel), yards, firstDown, touchdown: td, yac: complete ? yac : null, success,
    };

    log.push({ at, side: o.side, kind, yards, firstDown, third: startDown === 3 ? (firstDown || td ? 'conv' : 'fail') : null,
      turnover: !!turnover, success, penaltyYds: 0, penaltySide: null });

    // Score and possession.
    if (returnTd) {
      addScore(at, d.side, 6);
      credit(at, defender, { defTd: 1 });
    } else if (td) {
      addScore(at, o.side, 6);
    } else if (safety) {
      addScore(at, d.side, 2);
    }
    push({ at, clockLeft: clock, description: safety ? `SAFETY! ${offenseName} are tackled in their own end zone. Two points to ${d.short}.` : description,
      competitorId: defenseGains ? d.id : o.id, importance, tag, scored: td || returnTd || safety, players, headline: safety ? 'Safety' : headline,
      impact, snap });

    // Clock.
    const between = hurry ? rng.int(10, 16) : milk ? rng.int(36, 40) : rng.int(28, 36);
    clock -= rng.int(4, 8) + (stopsClock || turnover || td ? 0 : between);

    if (td) { afterTouchdown(o.side, at); return; }
    if (returnTd) { afterTouchdown(d.side, at); return; }
    if (safety) { kicker = o.side; phase = 'kickoff'; return; }
    if (turnover === 'int') {
      poss = d.side;
      yl = Math.max(1, Math.min(99, 100 - interceptSpot + rng.int(0, 20)));
      down = 1;
      dist = 10;
      return;
    }
    if (turnover === 'fumble') {
      poss = d.side;
      yl = Math.max(1, Math.min(99, 100 - (yl + yards)));
      down = 1;
      dist = 10;
      return;
    }
    yl += yards;
    if (firstDown) {
      down = 1;
      dist = Math.min(10, 100 - yl);
      return;
    }
    down += 1;
    dist -= yards;
    if (down > 4) {
      poss = d.side;
      yl = Math.max(1, 100 - yl);
      down = 1;
      dist = 10;
    }
  };

  const fourthDown = () => {
    const o = teams[poss];
    const diff = score[poss] - score[1 - poss];
    const fgDist = 117 - yl;
    const lateTrail = period >= 3 && diff < 0 && clock < 360;
    let go = false;
    if (lateTrail && !(diff >= -3 && fgDist <= 52)) go = true;
    else if (dist <= 2 && yl >= 88) go = rng.chance(0.5);
    else if (dist <= 1 && yl >= 40 && yl <= 75) go = rng.chance(0.45);
    else if (dist <= 3 && yl > 55 && yl < 64) go = rng.chance(0.3);
    if (go) { scrimmage(true); return; }
    if (fgDist <= 50 || (fgDist <= 56 && o.k.skill > 0.6)) { fieldGoal(null); return; }
    punt();
  };

  const endPeriod = () => {
    const p = periods[period];
    if (period === 4) {
      // Overtime ran out level: the team with the ball wins it with a long field goal.
      const side = poss;
      const t = teams[side];
      clock = 1;
      const at = atOf(clock);
      const distance = Math.max(38, Math.min(52, 117 - yl));
      addScore(at, side, 3);
      credit(at, t.k, { fgAtt: 1, [distance >= 50 ? 'fg5' : distance >= 40 ? 'fg4' : 'fg3']: 1, fgLng: distance });
      push({ at, clockLeft: clock, description: `${t.k.short} drills a ${distance}-yard field goal as time expires! ${nameOf(t.id)} win it!`,
        competitorId: t.id, importance: 3, tag: 'FG', scored: true, players: [[t.k, 'kick']], headline: `${distance}-yd walk-off FG`, impact: 9.5,
        snap: { offenseId: t.id, down: 0, distance: 0, yardLine: 117 - distance, personnel: null, kind: 'fg', yards: 0, firstDown: false, touchdown: false, yac: null, success: true } });
      endsAt = at + 2 * MINUTE;
      over = true;
      return;
    }
    const tied = score[0] === score[1];
    if (period === 3 && !tied) { over = true; return; }
    const label = period === 3 ? 'End of regulation' : p.breakAfter?.label ?? `End of ${p.label}`;
    const extra = period === 3 ? ' — we are heading to overtime!' : '';
    timeline.push({ at: p.end, clock: label, description: `${label}: ${shortOf(homeId)} ${score[0]}-${score[1]} ${shortOf(awayId)}${extra}`,
      competitorId: null, importance: period === 3 ? 3 : 2, tag: 'PERIOD', scoreAfter: scoreLine() });
    if (period === 3) {
      p.breakAfter = { min: 5, label };
      const start = p.end + 5 * MINUTE;
      periods.push({ label: 'OT', seconds: OT_SEC, start, end: start + OT_REAL, breakAfter: null });
      endsAt = start + OT_REAL;
      kicker = rng.chance(0.5) ? 0 : 1;
      phase = 'kickoff';
    }
    if (period === 1) {
      kicker = 1 - openingKicker as Side;
      phase = 'kickoff';
    }
    period += 1;
    clock = periods[period].seconds;
  };

  // Kickoff.
  const venue = competitorById(homeId) ? venueFor(competitorById(homeId)!) : meta.venue;
  timeline.push({ at: meta.startsAt, clock: `Q1 ${mmss(15)}`, description: `Kickoff at ${venue}. ${nameOf(teams[poss].id)} receive.`,
    competitorId: null, importance: 1, tag: 'START', scoreAfter: '0-0' });

  let guard = 0;
  while (!over && guard++ < 600) {
    if (clock <= 0) { endPeriod(); continue; }
    if (phase === 'kickoff') { kickoff(); continue; }
    const fgDist = 117 - yl;
    const diff = score[poss] - score[1 - poss];
    // Last-second field goal at the end of a half or to win/tie.
    if ((period === 1 || period >= 3) && clock <= 8 && fgDist <= 57 && (period === 1 || diff >= -3)) fieldGoal(null);
    else if (down === 4) fourthDown();
    else scrimmage(false);
    // Sudden death in overtime.
    if (period === 4 && score[0] !== score[1]) {
      endsAt = timeline[timeline.length - 1].at + 2 * MINUTE;
      over = true;
    }
  }

  const winner: Side = score[0] > score[1] ? 0 : 1;
  timeline.push({
    at: endsAt - 1, clock: 'Final', importance: 3, tag: 'FINAL', competitorId: teams[winner].id,
    description: `Final: ${nameOf(teams[winner].id)} win! ${nameOf(homeId)} ${score[0]}-${score[1]} ${nameOf(awayId)}.`,
    scoreAfter: scoreLine(),
  });
  // Plays are written in game order; keep it stable.
  timeline.sort((a, b) => a.at - b.at);
  events.sort((a, b) => a.at - b.at);
  return {
    periods, endsAt, timeline, events, log, scores, finalScore: [score[0], score[1]], firstScore,
    lineups: [rosterFor(homeId).map((p) => p.id), rosterFor(awayId).map((p) => p.id)],
  };
}

function scriptFor(meta: EventMeta): FootballScript {
  return cachedScript(`football:${meta.id}`, () => buildScript(meta));
}

function periodLabelAt(script: FootballScript, now: number): string {
  for (const p of script.periods) {
    if (now >= p.start && now < p.end) {
      const left = p.seconds - ((now - p.start) / (p.end - p.start)) * p.seconds;
      return `${p.label} ${mmss(left / 60)}`;
    }
    if (p.breakAfter && now >= p.end && now < p.end + p.breakAfter.min * MINUTE) return p.breakAfter.label;
  }
  return 'Final minutes';
}

/** The game clock at `now` ("Q2 4:12", "Half-time"), or null when not live. */
export function footballClock(meta: EventMeta, now: number): string | null {
  if (meta.disruption) return null;
  const script = scriptFor(meta);
  if (now < meta.startsAt || now >= script.endsAt) return null;
  return periodLabelAt(script, now);
}

/** Every player's stats, as timed events over the whole game. */
export function footballGameStats(meta: EventMeta): GameStats {
  const script = scriptFor(meta);
  return {
    periods: script.periods.map((p) => p.label),
    lineups: meta.competitorIds.map((id, i) => ({ competitorId: id, playerIds: script.lineups[i] ?? [] })),
    events: script.events,
  };
}

export interface FootballSituation {
  /** Team with the ball now (or about to receive a kick). */
  offenseId: string;
  down: number;
  distance: number;
  yardLine: number;
  /** "1st & 10", "Kickoff", "Extra point". */
  text: string;
  /** "SEA 35". */
  spot: string;
}

/** Where the ball is right now, for the field strip: the next snap's down, distance and spot. */
export function footballSituation(meta: EventMeta, now: number): FootballSituation | null {
  if (meta.disruption) return null;
  const script = scriptFor(meta);
  if (now < meta.startsAt || now >= script.endsAt) return null;
  const next = script.timeline.find((p) => p.at > now && p.football);
  const f = next?.football;
  if (!f) return null;
  const offShort = shortOf(f.offenseId);
  const defId = meta.competitorIds.find((id) => id !== f.offenseId) ?? '';
  const defShort = shortOf(defId);
  const text = f.kind === 'kickoff' ? 'Kickoff' : f.kind === 'pat' ? 'Extra point' : f.kind === 'two' ? 'Two-point try'
    : downText(f.down, f.distance, f.yardLine);
  const offenseId = f.kind === 'kickoff' ? defId : f.offenseId;
  return { offenseId, down: f.down, distance: f.distance, yardLine: f.yardLine, text, spot: spotText(f.yardLine, offShort, defShort) };
}

export interface FootballTeamNumbers {
  plays: number;
  yards: number;
  passYards: number;
  rushYards: number;
  firstDowns: number;
  thirdConv: number;
  thirdAtt: number;
  turnovers: number;
  sacksTaken: number;
  penalties: number;
  penaltyYards: number;
  runs: number;
  passes: number;
  successes: number;
}

/** Team box score numbers up to `now`, per side in competitorIds order. */
export function footballTeamNumbers(meta: EventMeta, now: number): [FootballTeamNumbers, FootballTeamNumbers] {
  const script = scriptFor(meta);
  const blank = (): FootballTeamNumbers => ({ plays: 0, yards: 0, passYards: 0, rushYards: 0, firstDowns: 0, thirdConv: 0, thirdAtt: 0,
    turnovers: 0, sacksTaken: 0, penalties: 0, penaltyYards: 0, runs: 0, passes: 0, successes: 0 });
  const out: [FootballTeamNumbers, FootballTeamNumbers] = [blank(), blank()];
  for (const l of script.log) {
    if (l.at > now) break;
    const t = out[l.side];
    if (l.kind === 'penalty') {
      if (l.firstDown) t.firstDowns++;
      if (l.penaltySide !== null) {
        out[l.penaltySide].penalties++;
        out[l.penaltySide].penaltyYards += l.penaltyYds;
      }
      continue;
    }
    if (l.kind === 'fg' || l.kind === 'punt') continue;
    if (l.kind === 'kneel') continue;
    t.plays++;
    t.yards += l.yards;
    if (l.kind === 'run') { t.rushYards += l.yards; t.runs++; }
    if (l.kind === 'pass' || l.kind === 'sack') { t.passYards += l.yards; t.passes++; }
    if (l.kind === 'sack') t.sacksTaken++;
    if (l.firstDown) t.firstDowns++;
    if (l.third) { t.thirdAtt++; if (l.third === 'conv') t.thirdConv++; }
    if (l.turnover) t.turnovers++;
    if (l.success) t.successes++;
  }
  return out;
}

function statsFor(meta: EventMeta, script: FootballScript, now: number, progress: number): StatsSection[] {
  if (progress <= 0) return [preMatchNote(meta)];
  const [homeId, awayId] = meta.competitorIds;
  const columns = ['Team', ...script.periods.map((p) => p.label), 'T'];
  const rows = [0, 1].map((side) => {
    const id = side === 0 ? homeId : awayId;
    const cells = script.periods.map((p, i) => (now < p.start ? '–'
      : String(script.scores.filter((s) => s.side === side && s.period === i && s.at <= now).reduce((a, s) => a + s.points, 0))));
    const total = script.scores.filter((s) => s.side === side && s.at <= now).reduce((a, s) => a + s.points, 0);
    return { key: id, competitorId: id, cells: [shortOf(id), ...cells, String(total)], emphasis: true };
  });
  const [h, a] = footballTeamNumbers(meta, now);
  const third = (t: FootballTeamNumbers) => (t.thirdAtt ? Math.round((t.thirdConv / t.thirdAtt) * 100) : 0);
  const sections: StatsSection[] = [
    { type: 'table', title: 'Scoring by quarter', columns, rows },
    { type: 'compare', title: 'Team stats', items: [
      { label: 'Total yards', home: h.yards, away: a.yards },
      { label: 'Passing yards', home: h.passYards, away: a.passYards },
      { label: 'Rushing yards', home: h.rushYards, away: a.rushYards },
      { label: 'First downs', home: h.firstDowns, away: a.firstDowns },
      { label: '3rd down', home: third(h), away: third(a), suffix: '%' },
      { label: 'Turnovers', home: h.turnovers, away: a.turnovers },
      { label: 'Sacks', home: a.sacksTaken, away: h.sacksTaken },
      { label: 'Penalties', home: h.penalties, away: a.penalties },
    ] },
  ];
  const lines = linesUpTo('american_football', script.events, now);
  const teamOf = (id: string) => id.split('.p')[0];
  const nameFor = (id: string) => rosterFor(teamOf(id)).find((p) => p.id === id)?.short ?? '?';
  const leaders = (title: string, cols: string[], key: string, cells: (l: StatLine) => string[], limit = 6) => {
    const list = [...lines.entries()].filter(([, l]) => (l[key] ?? 0) > 0)
      .sort((x, y) => (y[1][key === 'passAtt' ? 'passYds' : key === 'rushAtt' ? 'rushYds' : 'recYds'] ?? 0) - (x[1][key === 'passAtt' ? 'passYds' : key === 'rushAtt' ? 'rushYds' : 'recYds'] ?? 0))
      .slice(0, limit);
    if (list.length === 0) return;
    sections.push({ type: 'table', title, columns: ['Player', 'Team', ...cols],
      rows: list.map(([id, l]) => ({ key: id, competitorId: teamOf(id), cells: [nameFor(id), shortOf(teamOf(id)), ...cells(l)] })) });
  };
  leaders('Passing', ['C/ATT', 'YDS', 'TD', 'INT'], 'passAtt', (l) => [`${l.passCmp ?? 0}/${l.passAtt ?? 0}`, String(l.passYds ?? 0), String(l.passTd ?? 0), String(l.passInt ?? 0)], 2);
  leaders('Rushing', ['CAR', 'YDS', 'TD', 'LNG'], 'rushAtt', (l) => [String(l.rushAtt ?? 0), String(l.rushYds ?? 0), String(l.rushTd ?? 0), String(l.rushLng ?? 0)]);
  leaders('Receiving', ['REC', 'YDS', 'TD', 'LNG'], 'rec', (l) => [String(l.rec ?? 0), String(l.recYds ?? 0), String(l.recTd ?? 0), String(l.recLng ?? 0)]);
  return sections;
}

export function simulateFootball(meta: EventMeta, now: number): EventState {
  if (meta.disruption) return disruptedState(meta);
  const script = scriptFor(meta);
  const status = statusAt(meta, script.endsAt, now);
  const progress = progressAt(meta, script.endsAt, now);
  const [homeId, awayId] = meta.competitorIds;
  const points = [0, 1].map((side) => script.scores.filter((s) => s.side === side && s.at <= now).reduce((a, s) => a + s.points, 0));
  const finished = status === 'finished';
  const winner = points[0] > points[1] ? 0 : points[1] > points[0] ? 1 : null;
  const entries: EntryState[] = [homeId, awayId].map((id, side) => ({
    competitorId: id,
    role: side === 0 ? 'home' : 'away',
    score: status === 'scheduled' ? null : points[side],
    scoreText: null,
    position: null,
    isWinner: finished ? (winner === null ? null : winner === side) : null,
    note: null,
  }));
  const [fh, fa] = script.finalScore;
  return {
    meta,
    status,
    periodLabel: status === 'live' ? periodLabelAt(script, now) : null,
    progress,
    entries,
    plays: playsUpTo(meta, script.timeline, now),
    stats: statsFor(meta, script, now, progress),
    resultText: finished ? `${nameOf(fh > fa ? homeId : awayId)} won ${Math.max(fh, fa)}-${Math.min(fh, fa)}` : null,
    facts: {
      homeScore: points[0],
      awayScore: points[1],
      total: points[0] + points[1],
      winner: winner === null ? 'draw' : winner === 0 ? 'home' : 'away',
      firstScore: script.firstScore === null ? 'none' : script.firstScore === 0 ? 'home' : 'away',
      expectedTotal: FOOTBALL_EXPECTED_TOTAL,
    },
    endsAt: script.endsAt,
  };
}
