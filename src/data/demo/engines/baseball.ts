// Inning-by-inning baseball simulator with a full line score, walk-offs and a box score.
//
// The engine decides each half inning's runs, hits and big plays first (that part
// is unchanged, so every score and result stays the same). Then every plate
// appearance is played out with the real roster: a batting order of nine and a
// pitching staff, with base runners tracked so the box score adds up exactly to
// the line score (runs, hits, home runs, strikeouts).
import { MINUTE, ordinal } from '@/lib/format';
import { createRng, type Rng } from '@/lib/random';

import type { EntryState, EventMeta, EventState, StatsSection } from '../../types';
import { rosterFor } from '../players/roster';
import type { GameStats, Player, StatEvent, StatLine } from '../players/types';
import {
  cachedScript, disruptedState, impactOf, nameOf, playsUpTo, preMatchNote, progressAt, shortOf, sortTimeline, statusAt,
  strengthOf, type TimedPlay,
} from './common';

const HALF_MS = 9.5 * MINUTE;
const MID_MS = 2 * MINUTE;

type RunKind = 'hr' | 'single' | 'double' | 'sac';

/** A scoring play the engine wrote: n runs at one moment. */
interface RunPlay { at: number; n: number; kind: RunKind; walkOff: boolean; play: TimedPlay }

interface Half {
  inning: number;
  top: boolean;
  start: number;
  end: number;
  runs: number;
  hits: number;
  errors: number;
  runTimes: number[];
  hr: number;
  runPlays: RunPlay[];
  /** The engine's big strikeout and double-play moments (at most one per half). */
  kPlay: TimedPlay | null;
  dpPlay: TimedPlay | null;
}

interface BaseballScript {
  halves: Half[];
  endsAt: number;
  walkOff: boolean;
  timeline: TimedPlay[];
  strikeouts: [number, number];
  box: Box;
}

const RUN_PLAYS: { w: number; kind: RunKind }[] = [
  { w: 0.3, kind: 'hr' },
  { w: 0.3, kind: 'single' },
  { w: 0.25, kind: 'double' },
  { w: 0.15, kind: 'sac' },
];

function buildScript(meta: EventMeta): BaseballScript {
  const rng = createRng(`baseball:${meta.id}`);
  const ids = meta.competitorIds; // [home, away]; away bats first (top)
  const s = [strengthOf(ids[0]) + 0.04, strengthOf(ids[1])];
  const rel = s[0] / (s[0] + s[1]);
  const factor = [0.5 + rel, 1.5 - rel];
  const halves: Half[] = [];
  const tl: TimedPlay[] = [];
  const score = [0, 0];
  let t = meta.startsAt + 3 * MINUTE;
  let walkOff = false;
  const startPlay: TimedPlay = { at: meta.startsAt, clock: 'First pitch', importance: 1, tag: 'START', competitorId: null,
    description: `Play ball! ${nameOf(ids[1])} lead off against ${nameOf(ids[0])}.`, scoreAfter: '0-0' };
  tl.push(startPlay);

  // Note: every rng call below is the same as before players existed (names are
  // filled in afterwards), so scores, results and play times never change.
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
      const runPlays: RunPlay[] = [];
      let hr = 0;
      let scoredSoFar = 0;
      while (scoredSoFar < runs) {
        const left = runs - scoredSoFar;
        const n = Math.min(left, rng.chance(0.55) ? 1 : rng.int(1, Math.min(4, left)));
        const at = start + ((scoredSoFar + 1) / (runs + 1)) * (end - start);
        let roll = rng.next();
        let kind = RUN_PLAYS[0];
        for (const k of RUN_PLAYS) { if (roll < k.w) { kind = k; break; } roll -= k.w; }
        if (kind.kind === 'hr') hr++;
        scoredSoFar += n;
        for (let i = 0; i < n; i++) runTimes.push(at);
        const prevScore = [...score];
        score[side] += n;
        const isWalkOff = !top && inning >= 9 && score[0] > score[1] && prevScore[0] <= prevScore[1];
        rng.next(); // was the batter's name
        const play: TimedPlay = { at, clock: `${top ? 'Top' : 'Bot'} ${ordinal(inning)}`, importance: isWalkOff ? 3 : kind.kind === 'hr' ? 3 : 2,
          tag: isWalkOff ? 'WALKOFF' : kind.kind === 'hr' ? 'HR' : 'RUN', competitorId: ids[side],
          description: `${isWalkOff ? 'WALK-OFF! ' : ''}${kind.kind === 'hr' ? 'HOME RUN! ' : ''}${nameOf(ids[side])} score ${n === 1 ? 'a run' : `${n} runs`}.`,
          scoreAfter: `${score[0]}-${score[1]}` }; // the players are written in by playBall()
        tl.push(play);
        runPlays.push({ at, n, kind: kind.kind, walkOff: isWalkOff, play });
        if (isWalkOff) { walkOff = true; runs = scoredSoFar; break; }
      }
      let kPlay: TimedPlay | null = null;
      let dpPlay: TimedPlay | null = null;
      if (rng.chance(0.1)) {
        rng.next(); // was the pitcher's name
        kPlay = { at: start + (end - start) * 0.5, clock: `${top ? 'Top' : 'Bot'} ${ordinal(inning)}`, importance: 2, tag: 'K',
          competitorId: ids[1 - side], description: `${nameOf(ids[1 - side])} strike out the side!`, scoreAfter: null };
        tl.push(kPlay);
      } else if (rng.chance(0.12)) {
        dpPlay = { at: start + (end - start) * 0.6, clock: `${top ? 'Top' : 'Bot'} ${ordinal(inning)}`, importance: 1, tag: 'DP',
          competitorId: ids[1 - side], description: `Inning-ending double play turned by ${nameOf(ids[1 - side])}.`, scoreAfter: null };
        tl.push(dpPlay);
      }
      const halfEnd = walkOff ? (runTimes[runTimes.length - 1] ?? end) : end;
      halves.push({ inning, top, start, end: halfEnd, runs, hits, errors, runTimes, hr, runPlays, kPlay, dpPlay });
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
  const finalPlay: TimedPlay = { at: endsAt - 1, clock: 'Final', importance: 3, tag: 'FINAL', competitorId: ids[w],
    description: `Final: ${nameOf(ids[w])} win ${Math.max(...score)}-${Math.min(...score)}${last.inning > 9 ? ` in ${last.inning} innings` : ''}.`,
    scoreAfter: `${score[0]}-${score[1]}` };
  tl.push(finalPlay);
  const strikeouts: [number, number] = [rng.int(5, 13), rng.int(5, 13)];
  const timeline = sortTimeline(tl);
  const box = playBall(meta, halves, strikeouts, startPlay, finalPlay);
  return { halves, endsAt, walkOff, timeline, strikeouts, box };
}

function scriptFor(meta: EventMeta): BaseballScript {
  return cachedScript(`baseball:${meta.id}`, () => buildScript(meta));
}

const countUpTo = (times: number[], now: number) => times.reduce((a, x) => a + (x <= now ? 1 : 0), 0);

export function simulateBaseball(meta: EventMeta, now: number): EventState {
  if (meta.disruption) return disruptedState(meta);
  const s = scriptFor(meta);
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
    // Hits and home runs come from the box score, so they match the players' lines at every moment.
    const hits = countUpTo(s.box.hitTimes[side], now);
    const errors = s.halves.filter((h) => h.top !== (side === 1) && h.end <= now).reduce((a, h) => a + h.errors, 0);
    return { cells, hits, errors, hr: countUpTo(s.box.hrTimes[side], now) };
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
      { label: 'Strikeouts (pitching)', home: countUpTo(s.box.kTimes[0], now), away: countUpTo(s.box.kTimes[1], now) },
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

/**
 * Per-player stats for one event (the whole game; readers cut it at "now").
 * Batters: ab, h, b1/b2/b3/hr, r, rbi, bb, so, sb. Pitchers: outs, kp, er, ha,
 * bba, and w / sv at the final out. Team runs, hits, home runs and strikeouts
 * add up exactly to the line score.
 */
export function baseballGameStats(meta: EventMeta): GameStats {
  return scriptFor(meta).box.stats;
}

// ---------------------------------------------------------------------------
// Players: plate appearance by plate appearance.

/** What happened on one plate appearance (or, for sb/cs, between pitches). */
type Pa =
  // Fillers: the plate appearances between the engine's big plays.
  | 'out' | 'advOut' | 'single' | 'double' | 'triple' | 'walk' | 'roe' | 'hitOut' | 'sb' | 'cs'
  // Scoring plays (n runs, as the engine decided).
  | 'hr' | 'rsingle' | 'rdouble' | 'rtriple' | 'sacfly' | 'rdoubleE'
  // The engine's strikeout and double-play moments.
  | 'k' | 'k3' | 'kside' | 'dp0' | 'dp1';

const HIT_OF: Partial<Record<Pa, 'b1' | 'b2' | 'b3' | 'hr'>> = {
  single: 'b1', double: 'b2', triple: 'b3', hitOut: 'b1', hr: 'hr', rsingle: 'b1', rdouble: 'b2', rtriple: 'b3', rdoubleE: 'b2',
};
const NO_BATTER = new Set<Pa>(['sb', 'cs']);
const STRIKEOUT_PLAYS = new Set<Pa>(['k', 'k3', 'kside']);

/** Runners on first, second and third (ids), or null. */
type Bases = (string | null)[];
const EMPTY: Bases = [null, null, null];

interface Move {
  bases: Bases;
  scored: string[];
  outs: number;
  /** The runner who stole, was caught, or was forced out. */
  runner?: string;
}

const onBase = (b: Bases) => (b[0] ? 1 : 0) + (b[1] ? 1 : 0) + (b[2] ? 1 : 0);
const loaded = (b: Bases) => onBase(b) === 3;

/** Runners from the lead runner back: third, second, first. */
function leadRunners(b: Bases): { id: string; pos: number }[] {
  const out: { id: string; pos: number }[] = [];
  for (let pos = 2; pos >= 0; pos--) { const id = b[pos]; if (id) out.push({ id, pos }); }
  return out;
}

/** Batter to first; forced runners move up, a runner on second takes third if it is open. Never scores anyone. */
function singleAdvance(b: Bases, batter: string): Bases {
  let [, b2, b3] = b;
  const b1 = b[0];
  if (!b3 && b2) { b3 = b2; b2 = null; }
  if (b1) b2 = b1;
  return [batter, b2, b3];
}

function walkAdvance(b: Bases, batter: string): Bases {
  const [b1, b2, b3] = b;
  if (!b1) return [batter, b2, b3];
  if (!b2) return [batter, b1, b3];
  return [batter, b1, b2];
}

/**
 * The result of one play from a base/out state, or null when it cannot happen
 * there. In `loose` mode scoring plays only need enough runners (any others are
 * simply left off the bases); it is the last resort and keeps every total exact.
 */
function move(type: Pa, b: Bases, batter: string, n: number, outs: number, clean: boolean, loose: boolean): Move | null {
  const lead = leadRunners(b);
  const none = { bases: b, scored: [] as string[], outs: 0 };
  if (loose && (type === 'hr' || type === 'rsingle' || type === 'rdouble' || type === 'rtriple' || type === 'rdoubleE' || type === 'sacfly')) {
    const batterScores = type === 'hr' || type === 'rdoubleE';
    const need = batterScores ? n - 1 : n;
    if (type === 'sacfly' && outs > 1) return null;
    if (lead.length < need) return null;
    const bases: Bases = type === 'rsingle' ? [batter, null, null] : type === 'rdouble' ? [null, batter, null]
      : type === 'rtriple' ? [null, null, batter] : [null, null, null];
    return { bases, scored: [...lead.slice(0, need).map((r) => r.id), ...(batterScores ? [batter] : [])], outs: type === 'sacfly' ? 1 : 0 };
  }
  switch (type) {
    case 'out': return { ...none, outs: 1 };
    case 'advOut': { // a groundout that moves the runners up (never home)
      const bases = [...b];
      if (bases[1] && !bases[2]) { bases[2] = bases[1]; bases[1] = null; }
      if (bases[0] && !bases[1]) { bases[1] = bases[0]; bases[0] = null; }
      return bases.every((id, i) => id === b[i]) ? null : { bases, scored: [], outs: 1 };
    }
    case 'single':
    case 'roe': return loaded(b) ? null : { ...none, bases: singleAdvance(b, batter) };
    case 'double': return b[1] || b[2] ? null : { ...none, bases: [null, batter, b[0]] };
    case 'triple': return onBase(b) ? null : { ...none, bases: [null, null, batter] };
    case 'walk': return loaded(b) ? null : { ...none, bases: walkAdvance(b, batter) };
    case 'hitOut': {
      if (loaded(b) || !lead.length) return null;
      const rest = b.map((id, pos) => (pos === lead[0].pos ? null : id));
      return { bases: singleAdvance(rest, batter), scored: [], outs: 1, runner: lead[0].id };
    }
    case 'sb':
      if (b[0] && !b[1]) return { ...none, bases: [null, b[0], b[2]], runner: b[0] };
      if (b[1] && !b[2]) return { ...none, bases: [b[0], null, b[1]], runner: b[1] };
      return null;
    case 'cs': {
      const pos = b[0] ? 0 : b[1] ? 1 : b[2] ? 2 : -1;
      if (pos < 0) return null;
      return { bases: b.map((id, p) => (p === pos ? null : id)), scored: [], outs: 1, runner: b[pos] as string };
    }
    case 'hr':
      return onBase(b) === n - 1 ? { bases: EMPTY, scored: [...lead.map((r) => r.id), batter], outs: 0 } : null;
    case 'rsingle': {
      if (lead.length < n || lead.slice(0, n).some((r) => r.pos < 1)) return null;
      const bases: Bases = [batter, null, null];
      for (const r of lead.slice(n)) bases[r.pos + 1] = r.id;
      return { bases, scored: lead.slice(0, n).map((r) => r.id), outs: 0 };
    }
    case 'rdouble': {
      if (lead.length < n || lead.filter((r) => r.pos >= 1).length > n) return null;
      const bases: Bases = [null, batter, null];
      for (const r of lead.slice(n)) bases[2] = r.id; // only a runner from first can be left: he goes to third
      return { bases, scored: lead.slice(0, n).map((r) => r.id), outs: 0 };
    }
    case 'rtriple':
      return lead.length === n ? { bases: [null, null, batter], scored: lead.map((r) => r.id), outs: 0 } : null;
    case 'sacfly':
      return n === 1 && b[2] && outs <= 1 ? { bases: [b[0], b[1], null], scored: [b[2]], outs: 1 } : null;
    case 'rdoubleE':
      return n === 4 && loaded(b) ? { bases: EMPTY, scored: [...lead.map((r) => r.id), batter], outs: 0 } : null;
    case 'k': return outs <= 1 ? { ...none, outs: 1 } : null;
    case 'k3': return outs === 2 ? { ...none, outs: 1 } : null;
    case 'kside': return outs === 2 && clean ? { ...none, outs: 1 } : null;
    case 'dp0':
      if (outs !== 0) return null;
      if (!b[0]) return loose ? { ...none, outs: 2 } : null;
      return { bases: [null, b[1], b[2]], scored: [], outs: 2, runner: b[0] };
    case 'dp1':
      if (outs !== 1) return null;
      if (!b[0]) return loose ? { ...none, outs: 2 } : null;
      return { bases: [null, b[1], b[2]], scored: [], outs: 2, runner: b[0] };
    default: return null;
  }
}

/** One of the engine's plays that a plate appearance must land on. */
interface Anchor {
  at: number;
  kind: 'run' | 'k' | 'dp';
  n: number;
  /** Acceptable ways to play it, best first. */
  options: Pa[];
  run: RunPlay | null;
  play: TimedPlay;
}

function runOptions(r: RunPlay, prng: Rng): Pa[] {
  const { n } = r;
  if (r.kind === 'hr') return ['hr'];
  if (n >= 4) return ['rdoubleE'];
  if (n === 3) return ['rdouble', 'rtriple'];
  if (r.kind === 'sac') return n === 1 ? ['sacfly', 'rsingle', 'rdouble'] : ['rsingle', 'rdouble'];
  if (r.kind === 'single') return n === 1 && prng.chance(0.06) ? ['rtriple', 'rsingle', 'rdouble'] : ['rsingle', 'rdouble'];
  return prng.chance(0.05) ? ['rtriple', 'rdouble', 'rsingle'] : ['rdouble', 'rsingle'];
}

/**
 * The plays a half inning's plate appearances must hit, in time order (K/DP moments
 * after a walk-off become recaps). When the engine put a strikeout or double play at
 * the very same moment as a scoring play, either may have come first, so a second
 * ordering is offered with the strikeout or double play ahead.
 */
function anchorsOf(h: Half, prng: Rng, sideOk: boolean): { orderings: Anchor[][]; recap: TimedPlay | null } {
  const walkOffAt = h.runPlays.find((r) => r.walkOff)?.at ?? Infinity;
  const anchors: Anchor[] = h.runPlays.map((r) => ({ at: r.at, kind: 'run', n: r.n, options: runOptions(r, prng), run: r, play: r.play }));
  const extra = h.kPlay ?? h.dpPlay;
  let recap: TimedPlay | null = null;
  if (extra && extra.at < walkOffAt) {
    anchors.push({ at: extra.at, kind: h.kPlay ? 'k' : 'dp', n: 0, options: [], run: null, play: extra });
  } else if (extra) recap = extra;
  anchors.sort((a, b) => a.at - b.at); // stable: on a tie the scoring play comes first, as in the feed
  const orderings = [anchors];
  const tie = anchors.findIndex((a, i) => a.kind !== 'run' && i > 0 && anchors[i - 1].at === a.at);
  if (tie > 0) {
    const alt = anchors.map((a) => ({ ...a }));
    for (let j = tie; j > 0 && alt[j - 1].at === alt[j].at; j--) [alt[j - 1], alt[j]] = [alt[j], alt[j - 1]];
    orderings.push(alt);
  }
  for (const list of orderings) {
    list.forEach((a, i) => {
      const lastOne = i === list.length - 1;
      if (a.kind === 'k') a.options = lastOne ? (sideOk ? ['kside', 'k', 'k3'] : ['k', 'k3']) : ['k'];
      if (a.kind === 'dp') a.options = lastOne ? ['dp1', 'dp0'] : ['dp0'];
    });
  }
  return { orderings, recap };
}

/** How many runners the next engine play wants on base, and whether it must be exactly that many. */
function runnersWanted(a: Anchor, b: Bases): { count: number; exact: boolean; scoring: boolean } {
  const first = a.options[0];
  const inScoring = (b[1] ? 1 : 0) + (b[2] ? 1 : 0);
  switch (first) {
    case 'hr': return { count: a.n - 1, exact: true, scoring: false };
    case 'rtriple': return { count: a.n, exact: true, scoring: false };
    case 'rdoubleE': return { count: 3, exact: false, scoring: false };
    case 'rsingle': case 'sacfly': return { count: a.n, exact: false, scoring: inScoring < a.n };
    case 'rdouble': return { count: a.n, exact: false, scoring: false };
    case 'dp0': case 'dp1': return { count: 1, exact: false, scoring: false };
    default: return { count: 0, exact: false, scoring: false };
  }
}

interface Limits { walks: number; sb: number; cs: number; dropHits: boolean; loose: boolean }

// Tried in order until one works: realistic first, then more forgiving.
const LEVELS: Limits[] = [
  { walks: 2, sb: 1, cs: 1, dropHits: false, loose: false },
  { walks: 4, sb: 2, cs: 2, dropHits: false, loose: false },
  { walks: 4, sb: 2, cs: 2, dropHits: true, loose: false },
  { walks: 12, sb: 0, cs: 0, dropHits: true, loose: true },
];

interface Step { type: Pa; anchor: number }

/**
 * Finds a sequence of plate appearances for one half inning that lands every
 * engine play (with exactly its runs), uses exactly the half's hits and ends on
 * the third out (or on the walk-off). Depth-first, with random preferences, and
 * remembering dead ends so it stays quick.
 */
function searchHalf(
  anchors: Anchor[], hits: number, errors: number, walkOff: boolean, lim: Limits, skillAt: (k: number) => number, prng: Rng,
): Step[] | null {
  const failed = new Set<string>();
  const steps: Step[] = [];
  const last = anchors.length;
  let budget = 20_000;
  const dfs = (ai: number, outs: number, bases: Bases, hitsLeft: number, errs: number, walks: number, sb: number, cs: number, clean: boolean, pa: number): boolean => {
    if (ai === last && (walkOff || outs === 3)) return hitsLeft === 0 || lim.dropHits;
    if (outs >= 3 || --budget < 0) return false;
    const key = `${ai}|${outs}|${bases.map((x) => (x ? 1 : 0)).join('')}|${hitsLeft}|${errs}|${walks}|${sb}|${cs}|${clean ? 1 : 0}`;
    if (failed.has(key)) return false;
    const skill = skillAt(pa);
    const next = ai < last ? anchors[ai] : null;
    const tied = next !== null && ai > 0 && next.at === anchors[ai - 1].at;
    const sideK = next !== null && ai === last - 1 && next.kind === 'k' && clean && outs < 2;
    const acts: { type: Pa; anchor: boolean; key: number }[] = [];
    const add = (type: Pa, w: number) => acts.push({ type, anchor: false, key: Math.pow(prng.next(), 1 / w) });
    // Lookahead: does the next scoring play want more runners on base, or exactly as many as now?
    const runners = onBase(bases);
    const want = next ? runnersWanted(next, bases) : null;
    const reach = want === null ? 1 : runners < want.count ? 2.5 : want.exact ? 0.08 : 0.6;
    // Prefer setting up the engine's own kind of hit (an RBI single needs a runner in scoring position).
    const firstOk = next !== null && move(next.options[0], bases, 'B', next.n, outs, clean, lim.loose) !== null;
    const anchorW = firstOk ? 1.2 : want === null || runners >= want.count ? 0.35 : 0.5;
    if (next) {
      const k = Math.pow(prng.next(), 1 / (sideK ? 0.15 : anchorW));
      next.options.forEach((type, i) => acts.push({ type, anchor: true, key: k - i * 1e-9 }));
    }
    if (!tied) {
      const canOut = next === null || outs < 2;
      if (canOut) add('out', (sideK ? 5 : 1) * (1.4 - skill));
      if (hitsLeft > 0) {
        // Hits come at about the rate the half still needs them.
        const hit = (hitsLeft / Math.max(1, 3 - outs)) * (0.6 + skill) * reach;
        add('single', hit * 0.72);
        add('double', hit * 0.14);
        add('triple', hit * 0.02);
        if (canOut && runners) add('hitOut', 0.02);
      }
      if (canOut && runners) add('advOut', want?.scoring ? 0.9 : 0.12);
      if (walks < lim.walks) add('walk', 0.07 * (reach > 1 && hitsLeft > 0 ? 1 : reach));
      if (errs > 0) add('roe', 0.2 * reach);
      if (sb < lim.sb) add('sb', want?.scoring ? 0.1 : 0.025);
      if (cs < lim.cs && canOut) add('cs', want?.exact && runners > want.count ? 1 : 0.012);
    }
    acts.sort((a, b) => b.key - a.key);
    for (const act of acts) {
      const isHit = HIT_OF[act.type] !== undefined;
      if (isHit && hitsLeft === 0) continue; // never more hits than the line score
      const mv = move(act.type, bases, 'B', act.anchor && next ? next.n : 0, outs, clean, lim.loose);
      if (!mv) continue;
      const nOuts = outs + mv.outs;
      if (!act.anchor && nOuts >= 3 && next) continue; // the third out only comes after every engine play
      steps.push({ type: act.type, anchor: act.anchor ? ai : -1 });
      const ok = dfs(
        act.anchor ? ai + 1 : ai, nOuts, mv.bases, hitsLeft - (isHit ? 1 : 0), errs - (act.type === 'roe' ? 1 : 0),
        walks + (act.type === 'walk' ? 1 : 0), sb + (act.type === 'sb' ? 1 : 0), cs + (act.type === 'cs' ? 1 : 0),
        clean && (mv.outs === 0 || act.type === 'out' || act.type === 'kside'), pa + (NO_BATTER.has(act.type) ? 0 : 1),
      );
      if (ok) return true;
      steps.pop();
    }
    if (budget >= 0) failed.add(key);
    return false;
  };
  return dfs(0, 0, EMPTY, hits, errors, 0, 0, 0, true, 0) ? steps : null;
}

/** One plate appearance (or steal / caught stealing) with the real players. */
interface PaRec {
  at: number;
  half: number;
  period: number;
  type: Pa;
  /** Side whose pitcher is on the mound (0 home, 1 away). */
  fieldSide: number;
  batter: Player | null;
  runner: string | null;
  pitcher: Player;
  scored: string[];
  earned: number;
  outs: number;
  basesBefore: Bases;
  anchor: Anchor | null;
  /** A plain out that was a strikeout (decided once each staff's total is shared out). */
  k: boolean;
  /** A plain out that has to be a strikeout (the side was struck out). */
  forcedK: boolean;
}

interface Staff { sp: Player; setup: Player[]; closer: Player }

interface Box {
  stats: GameStats;
  /** When each side's hits and home runs happened (0 home, 1 away). */
  hitTimes: [number[], number[]];
  hrTimes: [number[], number[]];
  /** When each side's pitchers struck someone out (0 home, 1 away). */
  kTimes: [number[], number[]];
}

const isPitcherPos = (pos: string) => pos === 'SP' || pos === 'RP';

/** Nine hitters: a table-setter leading off, the best two hitting second and third, then by skill. */
function battingOrder(teamId: string): Player[] {
  const best = rosterFor(teamId).filter((p) => !isPitcherPos(p.pos))
    .sort((a, b) => b.skill - a.skill || (a.id < b.id ? -1 : 1));
  if (best.length < 3) return best;
  return [best[2], best[0], best[1], ...best.slice(3, 9)];
}

function staffOf(teamId: string): Staff {
  const roster = rosterFor(teamId);
  const rps = roster.filter((p) => p.pos === 'RP').sort((a, b) => a.skill - b.skill || (a.id < b.id ? -1 : 1));
  const sp = roster.find((p) => p.pos === 'SP') ?? rps[0] ?? roster[0];
  return { sp, setup: rps.slice(0, -1), closer: rps[rps.length - 1] ?? sp };
}

/**
 * Who pitches each half: the starter goes until he tires or gets knocked
 * around, set-up men take an inning each, and the closer gets the ninth (and
 * extras) when the game is close.
 */
function assignPitchers(halves: Half[], staffs: Staff[], before: number[][], prng: Rng): Player[] {
  const spLimit = [0, 1].map(() => Math.max(4, Math.min(8, Math.round(prng.normal(6.3, 2.4)))));
  const state = staffs.map((staff) => ({ cur: staff.sp, runs: 0, innings: 0, used: new Set<string>([staff.sp.id]) }));
  return halves.map((h, hi) => {
    const f = h.top ? 0 : 1;
    const st = state[f];
    const staff = staffs[f];
    const lead = before[hi][f] - before[hi][1 - f];
    const change = st.cur === staff.sp
      ? h.inning > spLimit[f] || (st.runs >= 5 && h.inning >= 3) || (st.runs >= 4 && h.inning >= 6)
      : st.innings >= (st.cur === staff.setup[0] && h.inning <= 7 && st.runs === 0 ? 2 : 1);
    if (change) {
      const closerFree = !st.used.has(staff.closer.id);
      const fresh = closerFree && h.inning >= 9 && lead >= 0 && lead <= 3 ? staff.closer
        : staff.setup.find((p) => !st.used.has(p.id)) ?? (closerFree && h.inning >= 9 && lead >= 0 ? staff.closer : null);
      if (fresh) {
        st.cur = fresh;
        st.used.add(fresh.id);
        st.runs = 0;
        st.innings = 0;
      }
    }
    st.innings++;
    st.runs += h.runs;
    return st.cur;
  });
}

const names = (ps: Player[]) => (ps.length <= 1 ? ps[0]?.short ?? '' : `${ps.slice(0, -1).map((p) => p.short).join(', ')} and ${ps[ps.length - 1].short}`);

function batterLine(r: PaRec): StatLine | null {
  const n = r.anchor?.n ?? 0;
  switch (r.type) {
    case 'out': return r.k ? { ab: 1, so: 1 } : { ab: 1 };
    case 'k': case 'k3': case 'kside': return { ab: 1, so: 1 };
    case 'single': case 'hitOut': return { ab: 1, h: 1, b1: 1 };
    case 'double': return { ab: 1, h: 1, b2: 1 };
    case 'triple': return { ab: 1, h: 1, b3: 1 };
    case 'walk': return { bb: 1 };
    case 'advOut': case 'roe': case 'dp0': case 'dp1': return { ab: 1 };
    case 'hr': return { ab: 1, h: 1, hr: 1, rbi: n, r: 1 };
    case 'rsingle': return { ab: 1, h: 1, b1: 1, rbi: r.scored.length };
    case 'rdouble': return { ab: 1, h: 1, b2: 1, rbi: r.scored.length };
    case 'rtriple': return { ab: 1, h: 1, b3: 1, rbi: r.scored.length };
    case 'rdoubleE': return { ab: 1, h: 1, b2: 1, rbi: r.scored.length - 1, r: 1 };
    case 'sacfly': return { rbi: 1 };
    default: return null;
  }
}

function pitcherLine(r: PaRec): StatLine | null {
  const l: StatLine = {};
  if (r.outs) l.outs = r.outs;
  if (r.k || STRIKEOUT_PLAYS.has(r.type)) l.kp = 1;
  if (HIT_OF[r.type]) l.ha = 1;
  if (r.type === 'walk') l.bba = 1;
  if (r.earned) l.er = r.earned;
  return Object.keys(l).length ? l : null;
}

/** Plays the whole game with the real rosters and writes the players into the feed. */
function playBall(meta: EventMeta, halves: Half[], kTargets: [number, number], startPlay: TimedPlay, finalPlay: TimedPlay): Box {
  const prng = createRng(`players:${meta.id}`);
  const ids = meta.competitorIds;
  const orders = [battingOrder(ids[0]), battingOrder(ids[1])];
  const staffs = [staffOf(ids[0]), staffOf(ids[1])];
  const before: number[][] = [];
  const running = [0, 0];
  for (const h of halves) {
    before.push([...running]);
    running[h.top ? 1 : 0] += h.runs;
  }
  const pitchers = assignPitchers(halves, staffs, before, prng);
  const nextUp = [0, 0];
  // Strikeouts each staff still owes its engine total; "struck out the side" uses three at once.
  const kLeft = [...kTargets];
  const kMoments = [0, 1].map((f) => halves.filter((h) => h.kPlay && (h.top ? 0 : 1) === f).length);
  const recs: PaRec[] = [];
  const recaps: { play: TimedPlay; half: number }[] = [];

  halves.forEach((h, hi) => {
    const bat = h.top ? 1 : 0;
    const order = orders[bat];
    const pitcher = pitchers[hi];
    const f = 1 - bat;
    const { orderings, recap } = anchorsOf(h, prng, h.kPlay !== null && kLeft[f] - 3 >= kMoments[f] - 1);
    if (h.kPlay) kMoments[f]--;
    if (recap) recaps.push({ play: recap, half: hi });
    const walkOff = h.runPlays.some((r) => r.walkOff);
    const skillAt = (k: number) => order[(nextUp[bat] + k) % order.length]?.skill ?? 0.5;
    const plan = planHalf(orderings, h, walkOff, skillAt, prng);
    if (!plan) return; // never happens (the loose level always finds a way); nobody is credited rather than crash
    const { steps, anchors } = plan;
    const loose = !searchOk(steps, anchors);
    const sideK = steps.some((s) => s.type === 'kside');
    kLeft[f] -= sideK ? 3 : steps.some((s) => STRIKEOUT_PLAYS.has(s.type)) ? 1 : 0;
    let bases: Bases = EMPTY;
    let outs = 0;
    const unearned = new Set<string>();
    const halfRecs: PaRec[] = [];
    for (const st of steps) {
      const anchor = st.anchor >= 0 ? anchors[st.anchor] : null;
      const batter = NO_BATTER.has(st.type) ? null : order[nextUp[bat] % order.length];
      const mv = move(st.type, bases, batter?.id ?? '', anchor?.n ?? 0, outs, true, loose)
        ?? move(st.type, bases, batter?.id ?? '', anchor?.n ?? 0, outs, true, true)
        ?? { bases, scored: [], outs: 0 };
      if (st.type === 'roe' && batter) unearned.add(batter.id);
      if (st.type === 'rdoubleE' && batter) unearned.add(batter.id); // he scored on the error
      halfRecs.push({
        at: 0, half: hi, period: h.inning - 1, type: st.type, fieldSide: 1 - bat, batter, runner: mv.runner ?? null, pitcher,
        scored: mv.scored, earned: mv.scored.filter((id) => !unearned.has(id)).length, outs: mv.outs,
        basesBefore: bases, anchor, k: false, forcedK: sideK && st.type === 'out',
      });
      bases = mv.bases;
      outs += mv.outs;
      if (batter) nextUp[bat] = (nextUp[bat] + 1) % order.length;
    }
    timeHalf(halfRecs, h);
    recs.push(...halfRecs);
  });

  shareStrikeouts(recs, kTargets, prng);
  const byId = new Map<string, Player>();
  for (const p of [...orders.flat(), ...pitchers]) byId.set(p.id, p);

  // Stat events, in time order.
  const events: StatEvent[] = [];
  const hitTimes: [number[], number[]] = [[], []];
  const hrTimes: [number[], number[]] = [[], []];
  const kTimes: [number[], number[]] = [[], []];
  const outsBy = new Map<string, number>();
  for (const r of recs) {
    const push = (id: string, stats: StatLine | null) => { if (stats) events.push({ at: r.at, period: r.period, playerId: id, stats }); };
    if (r.batter) push(r.batter.id, batterLine(r));
    push(r.pitcher.id, pitcherLine(r));
    for (const id of r.scored) if (id !== r.batter?.id) push(id, { r: 1 });
    if (r.type === 'sb' && r.runner) push(r.runner, { sb: 1 });
    const bat = 1 - r.fieldSide;
    if (HIT_OF[r.type]) hitTimes[bat].push(r.at);
    if (r.type === 'hr') hrTimes[bat].push(r.at);
    if (r.k || STRIKEOUT_PLAYS.has(r.type)) kTimes[r.fieldSide].push(r.at);
    outsBy.set(r.pitcher.id, (outsBy.get(r.pitcher.id) ?? 0) + r.outs);
  }

  // Win and save, credited at the final out.
  const lastPeriod = halves[halves.length - 1].inning - 1;
  const decision = decisions(halves, pitchers, before, outsBy, staffs);
  if (decision.win) events.push({ at: finalPlay.at, period: lastPeriod, playerId: decision.win.id, stats: { w: 1 } });
  if (decision.save) events.push({ at: finalPlay.at, period: lastPeriod, playerId: decision.save.id, stats: { sv: 1 } });
  events.sort((a, b) => a.at - b.at);

  describe(meta, halves, recs, recaps, pitchers, before, byId, prng);
  const homeSp = pitchers[halves.findIndex((h) => h.top)] ?? staffs[0].sp;
  const leadoff = orders[1][0];
  if (leadoff && homeSp) {
    startPlay.description = `Play ball! ${leadoff.short} leads off for ${nameOf(ids[1])} against ${homeSp.short} of ${nameOf(ids[0])}.`;
    Object.assign(startPlay, { playerIds: [leadoff.id, homeSp.id], playerRoles: ['bat', 'pitch'], headline: 'First pitch', period: 0 });
  }
  if (decision.win) {
    const pitchersOfFinal = [decision.win, ...(decision.save ? [decision.save] : [])];
    finalPlay.description = `${finalPlay.description.replace(/\.$/, '')}. W: ${decision.win.short}${decision.save ? `, S: ${decision.save.short}` : ''}.`;
    Object.assign(finalPlay, { playerIds: pitchersOfFinal.map((p) => p.id), playerRoles: pitchersOfFinal.map(() => 'pitch'), headline: 'Final', period: lastPeriod });
  }

  const used = (side: number) => {
    const list = [...orders[side]];
    halves.forEach((h, hi) => { if ((h.top ? 0 : 1) === side && !list.includes(pitchers[hi])) list.push(pitchers[hi]); });
    return list.map((p) => p.id);
  };
  return {
    stats: {
      periods: Array.from({ length: halves[halves.length - 1].inning }, (_, i) => String(i + 1)),
      lineups: ids.map((id, side) => ({ competitorId: id, playerIds: used(side) })),
      events,
    },
    hitTimes, hrTimes, kTimes,
  };
}

/** The most realistic plan for a half inning: each level in turn, each ordering of the engine's plays. */
function planHalf(orderings: Anchor[][], h: Half, walkOff: boolean, skillAt: (k: number) => number, prng: Rng) {
  for (const lim of LEVELS) {
    for (const anchors of orderings) {
      const steps = searchHalf(anchors, h.hits, h.errors, walkOff, lim, skillAt, prng);
      if (steps) return { steps, anchors };
    }
  }
  return null;
}

/** True when every step of a plan works without the loose rules. */
function searchOk(steps: Step[], anchors: Anchor[]): boolean {
  let bases: Bases = EMPTY;
  let outs = 0;
  for (const st of steps) {
    const mv = move(st.type, bases, 'B', st.anchor >= 0 ? anchors[st.anchor].n : 0, outs, true, false);
    if (!mv) return false;
    bases = mv.bases;
    outs += mv.outs;
  }
  return true;
}

/** Engine plays keep their exact times; the plate appearances in between are spread out evenly. */
function timeHalf(recs: PaRec[], h: Half): void {
  let prevAt = h.start;
  let segStart = 0;
  const marks = [...recs.map((r, i) => (r.anchor ? i : -1)).filter((i) => i >= 0), recs.length];
  for (const mark of marks) {
    const seg = recs.slice(segStart, mark);
    const tail = mark === recs.length;
    const endAt = tail ? Math.max(prevAt + 1000, h.end - 15_000) : (recs[mark].anchor as Anchor).at;
    seg.forEach((r, j) => {
      r.at = tail ? prevAt + ((j + 1) / seg.length) * (endAt - prevAt) : prevAt + ((j + 1) / (seg.length + 1)) * (endAt - prevAt);
    });
    if (!tail) {
      recs[mark].at = (recs[mark].anchor as Anchor).at;
      prevAt = recs[mark].at;
    }
    segStart = mark + 1;
  }
}

/** Turns plain outs into strikeouts so each staff's total matches the engine's (and every "struck out the side" is true). */
function shareStrikeouts(recs: PaRec[], targets: [number, number], prng: Rng): void {
  for (const side of [0, 1]) {
    const mine = recs.filter((r) => r.fieldSide === side);
    let have = 0;
    for (const r of mine) {
      if (r.forcedK || STRIKEOUT_PLAYS.has(r.type)) { r.k = true; have++; }
    }
    const pool = prng.shuffle(mine.filter((r) => r.type === 'out' && !r.k));
    pool.slice(0, Math.max(0, targets[side] - have)).forEach((r) => { r.k = true; });
  }
}

/** Winning pitcher (pitcher of record when his side took the lead for good) and save. */
function decisions(halves: Half[], pitchers: Player[], before: number[][], outsBy: Map<string, number>, staffs: Staff[]) {
  const last = halves.length - 1;
  const final = [...before[last]];
  final[halves[last].top ? 1 : 0] += halves[last].runs;
  const winner = final[0] > final[1] ? 0 : 1;
  const fieldingHalves = halves.map((h, i) => ((h.top ? 0 : 1) === winner ? i : -1)).filter((i) => i >= 0);
  // The half in which the winner went ahead for good.
  let goAhead = -1;
  const score = [0, 0];
  halves.forEach((h, hi) => {
    const bat = h.top ? 1 : 0;
    for (const r of h.runPlays) {
      const wasAhead = score[bat] > score[1 - bat];
      score[bat] += r.n;
      if (bat === winner && !wasAhead && score[bat] > score[1 - bat]) goAhead = hi;
    }
  });
  const ofRecord = fieldingHalves.filter((i) => i < goAhead).pop() ?? fieldingHalves[0];
  let win: Player | undefined = ofRecord === undefined ? staffs[winner].sp : pitchers[ofRecord];
  if (win === staffs[winner].sp && (outsBy.get(win.id) ?? 0) < 15) {
    const relievers = [...new Set(fieldingHalves.map((i) => pitchers[i]))].filter((p) => p !== staffs[winner].sp);
    const bestRelief = relievers.sort((a, b) => (outsBy.get(b.id) ?? 0) - (outsBy.get(a.id) ?? 0))[0];
    if (bestRelief) win = bestRelief;
  }
  const finisherHalf = fieldingHalves[fieldingHalves.length - 1];
  const finisher = finisherHalf === undefined ? undefined : pitchers[finisherHalf];
  let save: Player | undefined;
  if (finisher && finisher !== win) {
    const entered = fieldingHalves.find((i) => pitchers[i] === finisher) as number;
    const lead = before[entered][winner] - before[entered][1 - winner];
    const outs = outsBy.get(finisher.id) ?? 0;
    if (lead >= 1 && ((lead <= 3 && outs >= 3) || outs >= 9)) save = finisher;
  }
  return { win, save };
}

/** Writes the players into the engine's plays: names, roles, a headline, a rating and the inning. */
function describe(
  meta: EventMeta, halves: Half[], recs: PaRec[], recaps: { play: TimedPlay; half: number }[], pitchers: Player[],
  before: number[][], byId: Map<string, Player>, prng: Rng,
): void {
  const ks = new Map<string, number>();
  for (const r of recs) {
    if (r.k || STRIKEOUT_PLAYS.has(r.type)) ks.set(r.pitcher.id, (ks.get(r.pitcher.id) ?? 0) + 1);
    const a = r.anchor;
    if (!a || !r.batter) continue;
    const h = halves[r.half];
    const B = r.batter.short;
    const P = r.pitcher.short;
    const margin = Math.abs(before[r.half][0] - before[r.half][1]);
    const late = h.inning >= 7 && margin <= 2 ? 0.7 : 0;
    const scoringPos = r.basesBefore[1] || r.basesBefore[2] ? 1 : 0;
    const play = a.play;
    const set = (description: string, headline: string, impact: number, players: Player[], roles: string[]) => {
      play.description = description;
      Object.assign(play, { playerIds: players.map((p) => p.id), playerRoles: roles, headline, impact: impactOf(impact), period: r.period });
    };
    if (a.kind === 'run') {
      const n = r.scored.length;
      const others = r.scored.filter((id) => id !== r.batter?.id).map((id) => byId.get(id)).filter((p): p is Player => !!p);
      const walkOff = a.run?.walkOff ?? false;
      let text: string;
      let headline: string;
      let base: number;
      switch (r.type) {
        case 'hr':
          text = n === 4 ? `GRAND SLAM! ${B} clears the bases off ${P}!` : `HOME RUN! ${B} takes ${P} deep — a ${n === 1 ? 'solo' : `${n}-run`} shot!`;
          headline = n === 4 ? 'Grand slam' : n === 1 ? 'Solo homer' : `${n}-run homer`;
          base = 5.5 + n;
          break;
        case 'rsingle':
          text = n === 1 ? `${B} lines an RBI single off ${P} — ${names(others)} scores.` : `${B} lines a ${n}-run single off ${P} — ${names(others)} score.`;
          headline = n === 1 ? 'RBI single' : `${n}-run single`;
          base = 3.5 + n;
          break;
        case 'rdouble':
          text = n === 1 ? `${B} doubles into the gap off ${P} — ${names(others)} scores.`
            : n === 3 ? `${B} clears the bases with a 3-run double off ${P}! ${names(others)} all come home.`
              : `${B} rips a ${n}-run double off ${P} — ${names(others)} score.`;
          headline = n === 1 ? 'RBI double' : `${n}-run double`;
          base = 3.8 + n;
          break;
        case 'rtriple':
          text = n === 1 ? `${B} triples off the wall against ${P} — ${names(others)} scores.` : `${B} clears the bases with a ${n}-run triple off ${P}! ${names(others)} come home.`;
          headline = n === 1 ? 'RBI triple' : `${n}-run triple`;
          base = 4 + n;
          break;
        case 'sacfly':
          text = `${B} lifts a sacrifice fly off ${P} to bring ${names(others)} home.`;
          headline = 'Sac fly';
          base = 3.2;
          break;
        default: // the bases-clearing double with an error on the throw
          text = `${B} clears the bases with a double off ${P} and comes all the way home on a throwing error — ${n} runs score!`;
          headline = 'Bases-clearing double';
          base = 7;
      }
      if (walkOff) {
        text = `WALK-OFF! ${text}`;
        headline = r.type === 'hr' ? (n === 4 ? 'Walk-off grand slam' : 'Walk-off homer') : r.type === 'sacfly' ? 'Walk-off sac fly' : 'Walk-off hit';
      }
      const credited = r.type === 'hr' ? [] : others;
      set(text, headline, walkOff ? (r.type === 'hr' ? 9.9 : 9.5) : base + late,
        [r.batter, r.pitcher, ...credited], ['bat', 'pitch', ...credited.map(() => 'bat')]);
    } else if (a.kind === 'k') {
      const k = ks.get(r.pitcher.id) ?? 1;
      const onBaseBefore = onBase(r.basesBefore);
      let text: string;
      if (r.type === 'kside') text = `${P} strikes out the side! ${B} is the third victim in the ${ordinal(h.inning)}.`;
      else if (r.type === 'k3') {
        const stranded = onBaseBefore === 3 ? ', leaving the bases loaded' : onBaseBefore ? `, stranding ${onBaseBefore === 1 ? 'a runner' : 'two runners'}` : '';
        text = `${P} strikes out ${B} to end the ${ordinal(h.inning)}${stranded}.`;
      } else {
        text = prng.pick([
          `${P} strikes out ${B} swinging.`,
          `${P} catches ${B} looking at strike three.`,
          `${P} blows a fastball past ${B} for strike three.`,
          `${P} gets ${B} chasing a breaking ball in the dirt.`,
        ]);
      }
      if (k >= 4) text = `${text} That's ${k} strikeouts for ${P}.`;
      set(text, r.type === 'kside' ? 'Struck out the side' : 'Strikeout', (r.type === 'kside' ? 5 : 3) + scoringPos + late,
        [r.pitcher, r.batter], ['pitch', 'bat']);
    } else {
      const team = nameOf(meta.competitorIds[r.fieldSide]);
      const text = r.type === 'dp1'
        ? `${B} grounds into an inning-ending double play — ${team} turn two behind ${P}.`
        : `${B} grounds into a double play — ${team} turn two behind ${P}.`;
      set(text, 'Double play', 4 + scoringPos + late, [r.pitcher, r.batter], ['pitch', 'bat']);
    }
  }
  // Strikeout or double-play moments the engine placed after a walk-off: a recap of the losing pitcher.
  for (const { play, half } of recaps) {
    const p = pitchers[half];
    const team = nameOf(play.competitorId);
    const k = ks.get(p.id) ?? 0;
    play.description = play.tag === 'K' && k > 0
      ? `${p.short} finished with ${k} strikeout${k === 1 ? '' : 's'} for ${team}, but it was not enough.`
      : `Heartbreak for ${team}: ${p.short} was on the mound for the walk-off.`;
    Object.assign(play, { playerIds: [p.id], playerRoles: ['pitch'], headline: play.tag === 'K' && k > 0 ? 'Strikeouts' : 'Walk-off loss', period: halves[half].inning - 1 });
  }
}
