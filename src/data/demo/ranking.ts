// Leaderboards for the whole Stands crowd: Today, the last 7 days, and the season,
// globally or per sport, with tiers, rank movement, and a believable long tail.
//
// How it stays fast on a phone: only the ~260 named fans are scored one by one.
// Everyone else (tens of thousands of players) is described by a smooth curve that
// sits just below the named top 100, so any score can be turned into a rank like
// "#12,408 of 31,240" without scoring every player.
import { SPORTS } from '@/config/sports';
import { DAY, HOUR, MINUTE } from '@/lib/format';
import { createRng, hashText } from '@/lib/random';

import type { Fan } from '../types';
import { FANS, fanActivity, fanById, fanSkill, syntheticFan } from './fans';
import { SEASON_START } from './season';

export type Period = 'today' | 'week' | 'season';
export type TierId = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'legend';

export const PERIODS: { id: Period; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'season', label: 'Season' },
];

/** Highest first. `top` is the share of ranked players at or above the tier. */
export const TIERS: { id: TierId; name: string; top: number }[] = [
  { id: 'legend', name: 'Legend', top: 0.005 },
  { id: 'diamond', name: 'Diamond', top: 0.03 },
  { id: 'platinum', name: 'Platinum', top: 0.1 },
  { id: 'gold', name: 'Gold', top: 0.25 },
  { id: 'silver', name: 'Silver', top: 0.5 },
  { id: 'bronze', name: 'Bronze', top: 1 },
];

export function tierName(id: TierId): string {
  return TIERS.find((t) => t.id === id)?.name ?? 'Bronze';
}

/** Tier from a rank: top 0.5% Legend, top 3% Diamond, 10% Platinum, 25% Gold, 50% Silver. */
export function tierFor(rank: number | null, ranked: number): TierId {
  if (!rank || ranked <= 0) return 'bronze';
  const share = rank / ranked;
  for (const t of TIERS) if (share <= t.top) return t.id;
  return 'bronze';
}

/** The tier above, or null at the top. */
export function nextTier(id: TierId): (typeof TIERS)[number] | null {
  const i = TIERS.findIndex((t) => t.id === id);
  return i > 0 ? TIERS[i - 1] : null;
}

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

export function utcDayStart(t: number): number {
  return Math.floor(t / DAY) * DAY;
}

/** Monday 00:00 UTC on or before `t`: tiers are locked in then, every week. */
export function weekCheckpoint(t: number): number {
  const day = Math.floor(t / DAY);
  const mondayIndex = (day + 3) % 7; // 1 Jan 1970 was a Thursday
  return (day - mondayIndex) * DAY;
}

export function nextWeekCheckpoint(t: number): number {
  return weekCheckpoint(t) + 7 * DAY;
}

/** When the board empties: midnight UTC for Today; the others never reset. */
export function resetsAt(period: Period, now: number): number | null {
  return period === 'today' ? utcDayStart(now) + DAY : null;
}

/** What rank movement is measured against. */
export function referenceTime(period: Period, now: number): number {
  return period === 'today' ? Math.max(utcDayStart(now), now - HOUR) : now - DAY;
}

export function movementWindowLabel(period: Period): string {
  return period === 'today' ? 'in the last hour' : 'since yesterday';
}

function windowStart(period: Period, t: number): number {
  if (period === 'today') return utcDayStart(t);
  if (period === 'week') return t - 7 * DAY;
  return SEASON_START;
}

// ---------------------------------------------------------------------------
// Population
// ---------------------------------------------------------------------------

const BASE_PLAYERS = 46_812;
const SEASON_DAY0 = Math.floor(SEASON_START / DAY);

function signups(day: number): number {
  return 22 + (hashText(`signups:${day}`) % 61);
}

let signupCache = { days: -1, total: 0 };

/** Everyone who has ever played Calls on Stands. Grows a little every hour. */
export function totalPlayers(now: number): number {
  const days = Math.max(0, now / DAY - SEASON_DAY0);
  const whole = Math.floor(days);
  if (signupCache.days !== whole) {
    let total = 0;
    for (let d = 0; d < whole; d++) total += signups(SEASON_DAY0 + d);
    signupCache = { days: whole, total };
  }
  return BASE_PLAYERS + signupCache.total + Math.floor(signups(SEASON_DAY0 + whole) * (days - whole));
}

/** Share of players who make Calls on each sport. */
const SPORT_SHARE: Record<string, number> = {
  soccer: 0.34, f1: 0.27, cricket: 0.21, basketball: 0.24, rugby_union: 0.12, american_football: 0.19, baseball: 0.09,
  ice_hockey: 0.08, rugby_league: 0.06, aussie_rules: 0.06, tennis: 0.11, golf: 0.07, motogp: 0.08, indycar: 0.05,
  mma: 0.12, boxing: 0.1, cycling: 0.04, netball: 0.03,
};

/** Players with at least one winning Call in the period (the people who are ranked). */
export function rankedPlayers(period: Period, sportId: string | null, now: number): number {
  const share = sportId ? SPORT_SHARE[sportId] ?? 0.05 : 1;
  let active: number;
  if (period === 'today') {
    const f = (now - utcDayStart(now)) / DAY;
    active = 0.31 * (0.12 + 0.88 * Math.pow(f, 0.75));
  } else active = period === 'week' ? 0.58 : 0.83;
  return Math.max(40, Math.round(totalPlayers(now) * active * share));
}

// ---------------------------------------------------------------------------
// What each fan wins
// ---------------------------------------------------------------------------

interface Win {
  at: number;
  amount: number;
  sportId: string;
}

const SPORT_IDS = SPORTS.map((s) => s.id);
const traitCache = new Map<string, { skill: number; activity: number }>();

function traits(id: string) {
  let t = traitCache.get(id);
  if (!t) {
    t = { skill: fanSkill(id), activity: fanActivity(id) };
    traitCache.set(id, t);
  }
  return t;
}

/**
 * Calls a fan won on one UTC day, each landing as a game finishes. This runs
 * for every fan and every day of the season, so it uses a bare seeded generator
 * (mulberry32, same as lib/random) instead of building a full Rng each time.
 */
function rollDay(fan: Fan, day: number): Win[] {
  let a = hashText(`wins:${fan.id}:${day}`);
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const { skill, activity } = traits(fan.id);
  if (next() >= 0.3 + activity * 0.6) return [];
  // 1 + a Poisson count with mean activity * 3.
  const limit = Math.exp(-activity * 3);
  let n = 0;
  for (let p = next(); p > limit && n < 12; p *= next()) n++;
  const wins: Win[] = [];
  for (let k = 0; k <= n; k++) {
    // Fans are worldwide, so wins land around the clock, with a bump in the
    // European and American evenings (UTC afternoon and night).
    const bell = (next() + next() + next() + next() - 2) / 2;
    const timeOfDay = next() < 0.55 ? next() : Math.min(0.995, Math.max(0.01, 0.66 + bell * 0.45));
    const big = next() < 0.07 ? 2.6 : 1;
    const base = 15 + Math.floor(next() * 366);
    wins.push({
      at: day * DAY + Math.round(timeOfDay * DAY),
      amount: Math.round(base * (0.35 + skill * 0.9) * big),
      sportId: next() < 0.62 ? fan.favoriteSportId : SPORT_IDS[Math.floor(next() * SPORT_IDS.length)],
    });
  }
  return wins.sort((x, y) => x.at - y.at);
}

const dayCache = new Map<string, Win[]>();

function dayWins(fan: Fan, day: number): Win[] {
  const key = `${fan.id}:${day}`;
  let wins = dayCache.get(key);
  if (!wins) {
    wins = rollDay(fan, day);
    if (dayCache.size > 8000) dayCache.clear();
    dayCache.set(key, wins);
  }
  return wins;
}

/** A finished game's winnings land over a few minutes, so totals tick up smoothly. */
const RAMP = 12 * MINUTE;

function smooth(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

/** Each fan's total for every whole day of the season, rolled once and kept. */
interface DayTotal { all: number; bySport: Record<string, number> }
const seasonDays = new Map<string, DayTotal[]>();

/** Season total for every whole day before yesterday. */
function seasonBase(fan: Fan, sportId: string | null, todayIndex: number): number {
  const count = todayIndex - 1 - SEASON_DAY0;
  let days = seasonDays.get(fan.id);
  if (!days) {
    days = [];
    seasonDays.set(fan.id, days);
  }
  for (let k = days.length; k < count; k++) {
    const total: DayTotal = { all: 0, bySport: {} };
    for (const w of rollDay(fan, SEASON_DAY0 + k)) {
      total.all += w.amount;
      total.bySport[w.sportId] = (total.bySport[w.sportId] ?? 0) + w.amount;
    }
    days.push(total);
  }
  let sum = 0;
  for (let k = 0; k < count; k++) sum += sportId ? days[k].bySport[sportId] ?? 0 : days[k].all;
  return sum;
}

/** Clout a fan has won in a period, as of time `t`. */
export function fanScore(fan: Fan, period: Period, sportId: string | null, t: number): number {
  const start = windowStart(period, t);
  const todayIndex = Math.floor(t / DAY);
  let total = 0;
  let firstDay: number;
  if (period === 'season') {
    total += seasonBase(fan, sportId, todayIndex);
    firstDay = Math.max(SEASON_DAY0, todayIndex - 1);
  } else {
    firstDay = Math.floor((start - RAMP) / DAY);
  }
  for (let d = firstDay; d <= todayIndex; d++) {
    for (const w of dayWins(fan, d)) {
      if (w.at > t) break;
      if (sportId && w.sportId !== sportId) continue;
      // Rolling windows let old wins fade out over the same few minutes.
      const inside = period === 'week' ? smooth((w.at - start) / RAMP + 1) : w.at >= start ? 1 : 0;
      total += w.amount * smooth((t - w.at) / RAMP) * inside;
    }
  }
  return Math.round(total);
}

/** How many Calls a fan has won this season (for profiles). */
export function fanSeasonWins(fan: Fan, now: number): number {
  let n = 0;
  for (let d = SEASON_DAY0; d <= Math.floor(now / DAY); d++) {
    for (const w of dayWins(fan, d)) if (w.at <= now) n++;
  }
  return n;
}

/** Win rate (0..100), current win streak, and best streak for a fan. */
export function fanForm(fan: Fan, now: number): { winRate: number; streak: number; bestStreak: number } {
  const { skill } = traits(fan.id);
  const base = createRng(`form:${fan.id}`);
  const winRate = Math.round(38 + skill * 30 + base.float(-4, 4));
  const day = createRng(`streak:${fan.id}:${Math.floor(now / (6 * HOUR))}`);
  const streak = day.int(0, 2 + Math.round(skill * 7));
  const bestStreak = Math.max(streak, 4 + Math.round(skill * 9) + base.int(0, 3));
  return { winRate, streak, bestStreak };
}

// ---------------------------------------------------------------------------
// Boards
// ---------------------------------------------------------------------------

/** How many named rows the top of a board shows. */
export const TOP_COUNT = 100;
/** The long tail sits just under the named top 100... */
const TAIL_CAP = 0.985;
/** ...and is bottom-heavy: most ranked players have won a little, few a lot. */
const TAIL_SHAPE = 3.2;

interface Standing {
  fan: Fan;
  score: number;
}

interface CoreBoard {
  ranked: number;
  top: Standing[];
  cutoff: number;
  scores: Map<string, number>;
}

const coreCache = new Map<string, CoreBoard>();

function coreBoard(period: Period, sportId: string | null, t: number): CoreBoard {
  const key = `${period}:${sportId ?? '*'}:${Math.floor(t / 10_000)}`;
  const hit = coreCache.get(key);
  if (hit) return hit;
  const scores = new Map<string, number>();
  const positive: Standing[] = [];
  for (const fan of FANS) {
    const score = fanScore(fan, period, sportId, t);
    scores.set(fan.id, score);
    if (score > 0) positive.push({ fan, score });
  }
  positive.sort((a, b) => b.score - a.score || a.fan.id.localeCompare(b.fan.id));
  const top = positive.slice(0, TOP_COUNT);
  const board: CoreBoard = {
    ranked: Math.max(rankedPlayers(period, sportId, t), positive.length + 25),
    top,
    cutoff: top.length ? top[top.length - 1].score : 1,
    scores,
  };
  if (coreCache.size > 48) coreCache.delete(coreCache.keys().next().value as string);
  coreCache.set(key, board);
  return board;
}

/** Rank for a score on a board, or null when the score is zero (not ranked yet). */
function rankOf(score: number, core: CoreBoard): number | null {
  if (score <= 0) return null;
  const T = core.top.length;
  if (T > 0 && score >= core.cutoff) {
    let above = 0;
    for (const s of core.top) if (s.score > score) above++;
    return above + 1;
  }
  const p = Math.min(1, Math.pow(score / (core.cutoff * TAIL_CAP), 1 / TAIL_SHAPE));
  return Math.min(core.ranked, T + 1 + Math.floor((core.ranked - T - 1) * (1 - p)));
}

/** The score that sits at a rank (inverse of rankOf). */
function scoreAt(rank: number, core: CoreBoard): number {
  const T = core.top.length;
  if (rank <= T) return core.top[rank - 1].score;
  const span = Math.max(1, core.ranked - T - 1);
  const p = Math.max(0, 1 - (rank - T - 0.5) / span);
  return Math.max(1, Math.round(core.cutoff * TAIL_CAP * Math.pow(p, TAIL_SHAPE)));
}

export type BoardScope =
  | { kind: 'global' }
  | { kind: 'sport'; sportId: string }
  | { kind: 'group'; fanIds: string[] };

export type Movement = number | 'new' | null;

export interface BoardEntry {
  id: string;
  rank: number | null;
  username: string;
  displayName: string;
  avatarSeed: string;
  favoriteSportId: string | null;
  score: number;
  movement: Movement;
  tier: TierId;
  winRate: number;
  streak: number;
  isMe: boolean;
  synthetic: boolean;
}

/** What the board needs to know about you. Scores come from your own ledger. */
export interface MeInput {
  username: string;
  displayName: string;
  avatarSeed: string;
  favoriteSportId: string | null;
  score: number;
  refScore: number;
  /** Your Clout won in the 7 days before this week's tier checkpoint. */
  checkpointScore: number;
  winRate: number;
  streak: number;
}

export interface BoardView {
  period: Period;
  players: number;
  ranked: number;
  /** Ranked from 1, includes you if you are inside it. */
  top: BoardEntry[];
  me: BoardEntry | null;
  /** A few fans either side of you when you are outside the top. */
  around: BoardEntry[];
  /** Your next tier and the score that would reach it right now. */
  next: { tier: TierId; name: string; score: number; progress: number } | null;
  /** The tier you are on track for if the week ended now. */
  projectedTier: TierId;
  tiersUpdateAt: number;
  resetsAt: number | null;
}

/** A named or synthetic fan from an id. */
export function resolveFan(id: string): Fan | undefined {
  if (id.startsWith('syn~')) return syntheticFan(id, id);
  return fanById(id);
}

/**
 * Fans "around you" are made for a rank slot: `syn~<period>~<scope>~<rank>`.
 * Wherever they appear later (their profile, your Following board) they keep
 * that rank on that board, and their other totals are scaled to match.
 */
function parseSynthetic(id: string): { period: Period; sportId: string | null; slot: number } | null {
  const [tag, period, scope, slot] = id.split('~');
  if (tag !== 'syn' || !PERIODS.some((p) => p.id === period) || !scope || !Number(slot)) return null;
  return { period: period as Period, sportId: scope === 'global' ? null : scope, slot: Number(slot) };
}

/** A fan's total for a board: exact for named fans, anchored to their slot for synthetic ones. */
export function displayScore(fan: Fan, period: Period, sportId: string | null, t: number): number {
  const syn = parseSynthetic(fan.id);
  if (!syn) return fanScore(fan, period, sportId, t);
  const core = coreBoard(syn.period, syn.sportId, t);
  const anchor = scoreAt(Math.min(syn.slot, core.ranked), core);
  if (period === syn.period && sportId === syn.sportId) return anchor;
  const factor = anchor / Math.max(30, fanScore(fan, syn.period, syn.sportId, t));
  return Math.round(fanScore(fan, period, sportId, t) * factor);
}

/** Tier each fan earned at the last weekly checkpoint (global, last 7 days). */
export function lockedTier(fan: Fan, now: number): TierId {
  const at = weekCheckpoint(now);
  const core = coreBoard('week', null, at);
  const score = core.scores.get(fan.id) ?? displayScore(fan, 'week', null, at);
  return tierFor(rankOf(score, core), core.ranked);
}

export function lockedTierForScore(checkpointScore: number, now: number): TierId {
  const core = coreBoard('week', null, weekCheckpoint(now));
  return tierFor(rankOf(checkpointScore, core), core.ranked);
}

function movementOf(rank: number | null, refRank: number | null, refScore: number): Movement {
  if (rank === null) return null;
  if (refScore <= 0 || refRank === null) return 'new';
  return refRank - rank;
}

function fanEntry(fan: Fan, rank: number | null, score: number, movement: Movement, now: number, tier?: TierId): BoardEntry {
  const form = fanForm(fan, now);
  return {
    id: fan.id, rank, username: fan.username, displayName: fan.displayName, avatarSeed: fan.avatarSeed,
    favoriteSportId: fan.favoriteSportId, score, movement, tier: tier ?? lockedTier(fan, now),
    winRate: form.winRate, streak: form.streak, isMe: false, synthetic: fan.id.startsWith('syn~'),
  };
}

function meEntry(me: MeInput, rank: number | null, movement: Movement, now: number): BoardEntry {
  return {
    id: 'me', rank, username: me.username, displayName: me.displayName, avatarSeed: me.avatarSeed,
    favoriteSportId: me.favoriteSportId, score: me.score, movement, tier: lockedTierForScore(me.checkpointScore, now),
    winRate: me.winRate, streak: me.streak, isMe: true, synthetic: false,
  };
}

function scopeKey(scope: BoardScope): string {
  return scope.kind === 'sport' ? scope.sportId : scope.kind;
}

function groupBoard(period: Period, fanIds: string[], now: number, me: MeInput | null): BoardView {
  const ref = referenceTime(period, now);
  const fans = [...new Set(fanIds)].map(resolveFan).filter((f): f is Fan => !!f);
  const rows = fans.map((fan) => ({ fan, score: displayScore(fan, period, null, now), refScore: displayScore(fan, period, null, ref) }));
  type Row = { id: string; score: number; refScore: number; fan: Fan | null };
  const all: Row[] = rows.map((r) => ({ id: r.fan.id, ...r }));
  if (me) all.push({ id: 'me', score: me.score, refScore: me.refScore, fan: null });
  const order = (key: 'score' | 'refScore') => [...all].sort((a, b) => b[key] - a[key] || a.id.localeCompare(b.id)).map((r) => r.id);
  const now0 = order('score');
  const before = order('refScore');
  const entries = now0.map((id, i) => {
    const row = all.find((r) => r.id === id)!;
    const rank = row.score > 0 ? i + 1 : null;
    const refIdx = before.indexOf(id);
    const movement = movementOf(rank, refIdx >= 0 ? refIdx + 1 : null, row.refScore);
    return row.fan ? fanEntry(row.fan, rank, row.score, movement, now) : meEntry(me!, rank, movement, now);
  });
  // Unranked people still show, at the bottom, in their own order.
  const ranked = entries.filter((e) => e.rank !== null).length;
  const myEntry = entries.find((e) => e.isMe) ?? null;
  const projected = myEntry?.tier ?? 'bronze';
  return {
    period, players: entries.length, ranked, top: entries, me: myEntry, around: [], next: null, projectedTier: projected,
    tiersUpdateAt: nextWeekCheckpoint(now), resetsAt: resetsAt(period, now),
  };
}

/**
 * A full leaderboard view. Named fans are scored exactly; you are placed by your
 * own score; the people around you come from the curve, the same on every phone.
 */
export function buildBoard(period: Period, scope: BoardScope, now: number, me: MeInput | null): BoardView {
  if (scope.kind === 'group') return groupBoard(period, scope.fanIds, now, me);
  const sportId = scope.kind === 'sport' ? scope.sportId : null;
  const core = coreBoard(period, sportId, now);
  const ref = referenceTime(period, now);
  const coreRef = coreBoard(period, sportId, ref);

  const top: BoardEntry[] = core.top.map((s, i) => {
    const refScore = coreRef.scores.get(s.fan.id) ?? 0;
    return fanEntry(s.fan, i + 1, s.score, movementOf(i + 1, rankOf(refScore, coreRef), refScore), now);
  });

  let mine: BoardEntry | null = null;
  let around: BoardEntry[] = [];
  let projectedTier: TierId = 'bronze';
  let next: BoardView['next'] = null;
  if (me) {
    const rank = rankOf(me.score, core);
    mine = meEntry(me, rank, movementOf(rank, rankOf(me.refScore, coreRef), me.refScore), now);
    projectedTier = tierFor(rank, core.ranked);
    if (rank !== null && rank <= core.top.length) {
      top.splice(rank - 1, 0, mine);
      for (let i = rank; i < top.length; i++) top[i] = { ...top[i], rank: i + 1 };
      top.length = Math.min(top.length, TOP_COUNT);
    } else if (rank !== null) {
      const slots = [rank - 2, rank - 1, rank + 1, rank + 2].filter((r) => r > core.top.length && r <= core.ranked);
      around = slots.map((slot) => {
        const id = `syn~${period}~${scopeKey(scope)}~${slot}`;
        const fan = syntheticFan(id, id);
        const wobble = createRng(`move:${id}:${Math.floor(now / HOUR)}`);
        const move: Movement = wobble.chance(0.12) ? 'new' : wobble.int(-6, 9);
        const score = Math.max(slot < rank ? me.score : 1, scoreAt(slot, core));
        return fanEntry(fan, slot, slot > rank ? Math.min(score, me.score) : score, move, now);
      });
      around.push(mine);
      around.sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
    }
    // Tiers are earned on the global 7-day board, so only that board shows the next one.
    const target = period === 'week' && scope.kind === 'global' ? nextTier(projectedTier) : null;
    if (target) {
      const targetRank = Math.max(1, Math.floor(target.top * core.ranked));
      const needed = scoreAt(Math.min(targetRank, core.ranked), core) + 1;
      next = { tier: target.id, name: target.name, score: needed, progress: Math.min(1, me.score / needed) };
    }
  }

  return {
    period, players: totalPlayers(now), ranked: core.ranked, top, me: mine, around, next, projectedTier,
    tiersUpdateAt: nextWeekCheckpoint(now), resetsAt: resetsAt(period, now),
  };
}

/** A fan's standing in each period, for their profile. */
export function fanStandings(fan: Fan, now: number): { period: Period; rank: number | null; ranked: number; score: number }[] {
  return PERIODS.map(({ id }) => {
    const core = coreBoard(id, null, now);
    const score = core.scores.get(fan.id) ?? displayScore(fan, id, null, now);
    const topIdx = core.top.findIndex((s) => s.fan.id === fan.id);
    return { period: id, rank: topIdx >= 0 ? topIdx + 1 : rankOf(score, core), ranked: core.ranked, score };
  });
}

// ---------------------------------------------------------------------------
// Your own scores, from your device's ledger (same rules as weeklyCloutWon)
// ---------------------------------------------------------------------------

interface LedgerLike { currency: string; amount: number; reason: string; at: number; ref: string | null }
interface PredictionLike { id: string; sportId: string }

/** Clout you won from Calls in a period as of `t`, optionally on one sport. */
export function myScore(
  ledger: LedgerLike[], predictions: PredictionLike[], period: Period, sportId: string | null, t: number,
): number {
  const start = windowStart(period, t);
  const sportOf = sportId ? new Map(predictions.map((p) => [p.id, p.sportId])) : null;
  let total = 0;
  for (const l of ledger) {
    if (l.currency !== 'clout' || l.reason !== 'prediction_win' || l.at > t) continue;
    if (period === 'week' ? l.at <= start : l.at < start) continue;
    if (sportOf && sportOf.get(l.ref ?? '') !== sportId) continue;
    total += l.amount;
  }
  return total;
}

/** Time left as "2d 14h", "5h 12m" or "8m". */
export function countdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / MINUTE));
  const d = Math.floor(total / (24 * 60));
  const h = Math.floor((total % (24 * 60)) / 60);
  const m = total % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
