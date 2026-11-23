// A whole simulated season, computed cheaply so it is instant on a phone:
// league tables, win-loss records, recent form, streaks, championship points,
// fighters' career records, and past meetings between two sides.
// Everything is seeded, so every phone sees the same table.
import { sportById } from '@/config/sports';
import { DAY, ordinal } from '@/lib/format';
import { createRng, hashText } from '@/lib/random';

import type { Competitor } from '../types';
import { planFor } from './plans';
import { competitorById, participantsFor } from './world';

/** The demo season began on Friday 14 August 2026 (UTC). */
export const SEASON_START = Date.UTC(2026, 7, 14);

export type Result = 'W' | 'D' | 'L';
export type StandingsKind = 'table' | 'pct' | 'championship' | 'record';

interface TeamSportRules {
  /** Real days between rounds of the league. */
  cadenceDays: number;
  /** League points for a win and a draw ('pct' sports sort by win percentage). */
  win: number;
  draw: number;
  drawChance: number;
  kind: 'table' | 'pct';
  /** Typical score per side, for points-for and points-against. */
  meanScore: number;
  spread: number;
  homeEdge: number;
}

const TEAM_RULES: Record<string, TeamSportRules> = {
  soccer: { cadenceDays: 7, win: 3, draw: 1, drawChance: 0.26, kind: 'table', meanScore: 1.4, spread: 0, homeEdge: 0.06 },
  rugby_union: { cadenceDays: 7, win: 4, draw: 2, drawChance: 0.03, kind: 'table', meanScore: 24, spread: 9, homeEdge: 0.07 },
  rugby_league: { cadenceDays: 7, win: 2, draw: 1, drawChance: 0.02, kind: 'table', meanScore: 21, spread: 9, homeEdge: 0.06 },
  aussie_rules: { cadenceDays: 7, win: 4, draw: 2, drawChance: 0.01, kind: 'table', meanScore: 84, spread: 18, homeEdge: 0.06 },
  netball: { cadenceDays: 7, win: 2, draw: 1, drawChance: 0.02, kind: 'table', meanScore: 58, spread: 8, homeEdge: 0.05 },
  cricket: { cadenceDays: 7, win: 2, draw: 1, drawChance: 0, kind: 'table', meanScore: 168, spread: 25, homeEdge: 0.05 },
  basketball: { cadenceDays: 3.5, win: 1, draw: 0, drawChance: 0, kind: 'pct', meanScore: 110, spread: 11, homeEdge: 0.05 },
  american_football: { cadenceDays: 7, win: 1, draw: 0, drawChance: 0, kind: 'pct', meanScore: 23, spread: 9, homeEdge: 0.05 },
  ice_hockey: { cadenceDays: 3.5, win: 2, draw: 0, drawChance: 0, kind: 'pct', meanScore: 3, spread: 0, homeEdge: 0.05 },
  baseball: { cadenceDays: 1.5, win: 1, draw: 0, drawChance: 0, kind: 'pct', meanScore: 4.5, spread: 0, homeEdge: 0.04 },
};

/** Points by finishing position in individual sports. */
const POINTS_TABLES: Record<string, number[]> = {
  motor: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
  tennis: [1000, 650, 400, 200, 200, 100, 100, 100, 100, 50, 50, 50, 50, 50, 50, 50, 50, 10],
  golf: [500, 300, 190, 135, 110, 100, 90, 85, 80, 75, 70, 65, 60, 57, 54, 51, 48, 45, 42, 40],
  cycling: [100, 80, 65, 55, 45, 35, 30, 25, 20, 15, 10, 5],
};

const ATHLETE_RULES: Record<string, { cadenceDays: number; table: keyof typeof POINTS_TABLES; sharpness: number }> = {
  f1: { cadenceDays: 14, table: 'motor', sharpness: 7 },
  motogp: { cadenceDays: 14, table: 'motor', sharpness: 5 },
  indycar: { cadenceDays: 14, table: 'motor', sharpness: 4 },
  tennis: { cadenceDays: 7, table: 'tennis', sharpness: 5 },
  golf: { cadenceDays: 7, table: 'golf', sharpness: 3 },
  cycling: { cadenceDays: 7, table: 'cycling', sharpness: 4 },
};

export function standingsKind(sportId: string): StandingsKind {
  if (TEAM_RULES[sportId]) return TEAM_RULES[sportId].kind;
  if (ATHLETE_RULES[sportId]) return 'championship';
  return 'record';
}

function cadence(sportId: string): number {
  return (TEAM_RULES[sportId]?.cadenceDays ?? ATHLETE_RULES[sportId]?.cadenceDays ?? 7) * DAY;
}

/** How many rounds of the season are complete at `now`. */
export function roundsPlayed(sportId: string, now: number): number {
  return Math.max(0, Math.floor((now - SEASON_START) / cadence(sportId)));
}

/** When the next round is complete (tables move then). */
export function nextRoundAt(sportId: string, now: number): number {
  return SEASON_START + (roundsPlayed(sportId, now) + 1) * cadence(sportId);
}

// ---------------------------------------------------------------------------
// Matches between two sides (team sports and fights)
// ---------------------------------------------------------------------------

export interface MatchResult {
  home: number;
  away: number;
  /** 'H' home win, 'A' away win, 'D' draw. */
  result: 'H' | 'D' | 'A';
}

function scoreFrom(rules: TeamSportRules, rng: ReturnType<typeof createRng>, strength: number): number {
  const mean = rules.meanScore * (0.75 + strength * 0.5);
  if (rules.spread === 0) return rng.poisson(mean);
  return Math.max(0, Math.round(rng.normal(mean, rules.spread * 2)));
}

/** Plays one match between two teams from a seed. Same seed, same result. */
export function simulateMatch(sportId: string, homeId: string, awayId: string, seed: string): MatchResult {
  const rules = TEAM_RULES[sportId] ?? TEAM_RULES.soccer;
  const rng = createRng(`match:${seed}`);
  const sH = (competitorById(homeId)?.strength ?? 0.5) + rules.homeEdge;
  const sA = competitorById(awayId)?.strength ?? 0.5;
  const pHome = 1 / (1 + Math.exp(-6 * (sH - sA)));
  const drawP = rules.drawChance * (1 - Math.min(0.8, Math.abs(sH - sA) * 2));
  const roll = rng.next();
  const result: MatchResult['result'] = roll < drawP ? 'D' : roll < drawP + (1 - drawP) * pHome ? 'H' : 'A';
  let home = scoreFrom(rules, rng, sH);
  let away = scoreFrom(rules, rng, sA);
  // Bend the invented score so it agrees with the result.
  if (result === 'D') away = home;
  else if (result === 'H' && home <= away) home = away + 1 + (rules.spread ? rng.int(0, Math.round(rules.spread / 2)) : 0);
  else if (result === 'A' && away <= home) away = home + 1 + (rules.spread ? rng.int(0, Math.round(rules.spread / 2)) : 0);
  return { home, away, result };
}

/** Pairings for one round: a seeded shuffle, odd one out gets a bye. */
function roundPairs(sportId: string, round: number, ids: string[]): [string, string][] {
  const order = createRng(`round:${sportId}:${round}`).shuffle(ids);
  const pairs: [string, string][] = [];
  for (let i = 0; i + 1 < order.length; i += 2) pairs.push([order[i], order[i + 1]]);
  return pairs;
}

export interface Meeting {
  round: number;
  at: number;
  homeId: string;
  awayId: string;
  home: number;
  away: number;
  result: MatchResult['result'];
}

// ---------------------------------------------------------------------------
// League tables
// ---------------------------------------------------------------------------

export interface TeamRow {
  competitorId: string;
  position: number;
  /** Positions gained (+) or lost (-) since the previous round. */
  movement: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  /** League points (table sports) or wins (pct sports). */
  points: number;
  pct: number;
  /** Games behind the leader (pct sports). */
  gamesBack: number;
  /** Oldest first, up to 5. */
  form: Result[];
  /** "W3", "L1"... */
  streak: string;
}

interface TableBuild {
  rows: TeamRow[];
  meetings: Meeting[];
}

const tableCache = new Map<string, TableBuild>();

function sortRows(rows: TeamRow[], kind: 'table' | 'pct'): TeamRow[] {
  const name = (id: string) => competitorById(id)?.name ?? id;
  return [...rows].sort((a, b) => (kind === 'pct'
    ? b.pct - a.pct || b.won - a.won
    : b.points - a.points || (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst) || b.pointsFor - a.pointsFor)
    || name(a.competitorId).localeCompare(name(b.competitorId)));
}

function streakOf(form: Result[]): string {
  if (form.length === 0) return '–';
  const last = form[form.length - 1];
  let n = 0;
  for (let i = form.length - 1; i >= 0 && form[i] === last; i--) n++;
  return `${last}${n}`;
}

function buildTable(sportId: string, rounds: number): TableBuild {
  const key = `${sportId}:${rounds}`;
  const hit = tableCache.get(key);
  if (hit) return hit;
  const rules = TEAM_RULES[sportId];
  const ids = participantsFor(sportId).map((c) => c.id);
  const rows = new Map<string, TeamRow & { results: Result[] }>(ids.map((id) => [id, {
    competitorId: id, position: 0, movement: 0, played: 0, won: 0, drawn: 0, lost: 0, pointsFor: 0, pointsAgainst: 0,
    points: 0, pct: 0, gamesBack: 0, form: [], streak: '–', results: [],
  }]));
  const meetings: Meeting[] = [];
  let previousOrder: string[] = [];
  for (let r = 0; r < rounds; r++) {
    if (r === rounds - 1) previousOrder = sortRows([...rows.values()], rules.kind).map((x) => x.competitorId);
    for (const [homeId, awayId] of roundPairs(sportId, r, ids)) {
      const m = simulateMatch(sportId, homeId, awayId, `${sportId}:${r}:${homeId}:${awayId}`);
      meetings.push({ round: r, at: SEASON_START + (r + 1) * rules.cadenceDays * DAY, homeId, awayId, ...m });
      const h = rows.get(homeId)!;
      const a = rows.get(awayId)!;
      h.played++; a.played++;
      h.pointsFor += m.home; h.pointsAgainst += m.away;
      a.pointsFor += m.away; a.pointsAgainst += m.home;
      if (m.result === 'D') {
        h.drawn++; a.drawn++; h.points += rules.draw; a.points += rules.draw; h.results.push('D'); a.results.push('D');
      } else {
        const [w, l] = m.result === 'H' ? [h, a] : [a, h];
        w.won++; l.lost++; w.points += rules.win; w.results.push('W'); l.results.push('L');
      }
    }
  }
  for (const row of rows.values()) {
    row.pct = row.played ? (row.won + row.drawn * 0.5) / row.played : 0;
    row.form = row.results.slice(-5);
    row.streak = streakOf(row.results);
  }
  const sorted = sortRows([...rows.values()], rules.kind);
  const leader = sorted[0];
  const out: TeamRow[] = sorted.map((row, i) => {
    const before = previousOrder.indexOf(row.competitorId);
    return {
      competitorId: row.competitorId, position: i + 1, movement: before < 0 ? 0 : before - i,
      played: row.played, won: row.won, drawn: row.drawn, lost: row.lost, pointsFor: row.pointsFor,
      pointsAgainst: row.pointsAgainst, points: row.points, pct: row.pct,
      gamesBack: leader ? ((leader.won - row.won) + (row.lost - leader.lost)) / 2 : 0,
      form: row.form, streak: row.streak,
    };
  });
  const build = { rows: out, meetings };
  tableCache.set(key, build);
  if (tableCache.size > 60) tableCache.delete(tableCache.keys().next().value as string);
  return build;
}

/** The league table for a team sport, best first. Empty for other sports. */
export function teamTable(sportId: string, now: number): TeamRow[] {
  if (!TEAM_RULES[sportId]) return [];
  return buildTable(sportId, roundsPlayed(sportId, now)).rows;
}

export function teamRow(competitorId: string, now: number): TeamRow | undefined {
  const c = competitorById(competitorId);
  if (!c) return undefined;
  return teamTable(c.sportId, now).find((r) => r.competitorId === competitorId);
}

/** Past meetings between two teams this season, newest first, padded with earlier seasons. */
export function headToHead(aId: string, bId: string, now: number, count = 5): Meeting[] {
  const c = competitorById(aId);
  if (!c || !TEAM_RULES[c.sportId]) return [];
  const thisSeason = buildTable(c.sportId, roundsPlayed(c.sportId, now)).meetings
    .filter((m) => (m.homeId === aId && m.awayId === bId) || (m.homeId === bId && m.awayId === aId))
    .sort((x, y) => y.at - x.at);
  const out = [...thisSeason];
  const pairKey = [aId, bId].sort().join(':');
  for (let k = 1; out.length < count && k < 20; k++) {
    const swap = (hashText(`${pairKey}:${k}`) % 2) === 0;
    const homeId = swap ? bId : aId;
    const awayId = swap ? aId : bId;
    const m = simulateMatch(c.sportId, homeId, awayId, `past:${pairKey}:${k}`);
    // Earlier meetings, roughly two per season going back.
    const at = SEASON_START - k * 170 * DAY + (hashText(`${pairKey}:d${k}`) % 60) * DAY;
    out.push({ round: -k, at, homeId, awayId, ...m });
  }
  return out.slice(0, count);
}

// ---------------------------------------------------------------------------
// Championships (racing, tennis, golf, cycling)
// ---------------------------------------------------------------------------

export interface ChampionshipRow {
  competitorId: string;
  position: number;
  movement: number;
  points: number;
  wins: number;
  podiums: number;
  /** Finishing positions in the last few rounds, oldest first. */
  recent: number[];
}

const champCache = new Map<string, ChampionshipRow[]>();

function finishingOrder(ids: string[], sharpness: number, seed: string): string[] {
  // Plackett-Luce: draw the winner by weight, then the next from those left.
  const rng = createRng(seed);
  const pool = ids.map((id) => ({ id, w: Math.exp((competitorById(id)?.strength ?? 0.5) * sharpness + rng.normal(0, 1.2)) }));
  const out: string[] = [];
  while (pool.length > 0) {
    const total = pool.reduce((a, p) => a + p.w, 0);
    let roll = rng.next() * total;
    let i = 0;
    for (; i < pool.length - 1; i++) {
      roll -= pool[i].w;
      if (roll <= 0) break;
    }
    out.push(pool[i].id);
    pool.splice(i, 1);
  }
  return out;
}

function buildChampionship(sportId: string, rounds: number): ChampionshipRow[] {
  const key = `${sportId}:${rounds}`;
  const hit = champCache.get(key);
  if (hit) return hit;
  const rules = ATHLETE_RULES[sportId];
  const table = POINTS_TABLES[rules.table];
  const ids = participantsFor(sportId).map((c) => c.id);
  const acc = new Map(ids.map((id) => [id, { points: 0, wins: 0, podiums: 0, results: [] as number[] }]));
  let previous: string[] = [];
  const order = () => [...acc.entries()]
    .sort((a, b) => b[1].points - a[1].points || b[1].wins - a[1].wins || a[0].localeCompare(b[0])).map(([id]) => id);
  for (let r = 0; r < rounds; r++) {
    if (r === rounds - 1) previous = order();
    finishingOrder(ids, rules.sharpness, `champ:${sportId}:${r}`).forEach((id, i) => {
      const row = acc.get(id)!;
      row.points += table[i] ?? 0;
      if (i === 0) row.wins++;
      if (i < 3) row.podiums++;
      row.results.push(i + 1);
    });
  }
  const rows = order().map((id, i) => {
    const a = acc.get(id)!;
    const before = previous.indexOf(id);
    return { competitorId: id, position: i + 1, movement: before < 0 ? 0 : before - i, points: a.points, wins: a.wins,
      podiums: a.podiums, recent: a.results.slice(-5) };
  });
  champCache.set(key, rows);
  if (champCache.size > 40) champCache.delete(champCache.keys().next().value as string);
  return rows;
}

/** Drivers' or players' standings, best first. Empty for team sports. */
export function championship(sportId: string, now: number): ChampionshipRow[] {
  if (!ATHLETE_RULES[sportId]) return [];
  return buildChampionship(sportId, roundsPlayed(sportId, now));
}

/** Constructors' standings: each racing team's drivers' points added up. */
export function teamsChampionship(sportId: string, now: number): { competitorId: string; position: number; points: number; wins: number }[] {
  const rows = championship(sportId, now);
  const byTeam = new Map<string, { points: number; wins: number }>();
  for (const r of rows) {
    const parent = competitorById(r.competitorId)?.parentId;
    if (!parent) continue;
    const cur = byTeam.get(parent) ?? { points: 0, wins: 0 };
    cur.points += r.points;
    cur.wins += r.wins;
    byTeam.set(parent, cur);
  }
  return [...byTeam.entries()].sort((a, b) => b[1].points - a[1].points || b[1].wins - a[1].wins)
    .map(([competitorId, v], i) => ({ competitorId, position: i + 1, ...v }));
}

export function championshipRow(competitorId: string, now: number): ChampionshipRow | undefined {
  const c = competitorById(competitorId);
  return c ? championship(c.sportId, now).find((r) => r.competitorId === competitorId) : undefined;
}

// ---------------------------------------------------------------------------
// Fighters' career records (MMA, boxing)
// ---------------------------------------------------------------------------

export interface FightRecord { won: number; lost: number; drawn: number; finishes: number; ranking: number | null }

export function fightRecord(competitor: Competitor): FightRecord {
  const rng = createRng(`record:${competitor.id}`);
  const won = 6 + Math.round(competitor.strength * 18) + rng.int(0, 4);
  const lost = Math.max(0, Math.round((1 - competitor.strength) * 7) + rng.int(-1, 2));
  const drawn = rng.chance(0.25) ? 1 : 0;
  const finishes = Math.round(won * rng.float(0.35, 0.8));
  const field = participantsFor(competitor.sportId).slice().sort((a, b) => b.strength - a.strength);
  const idx = field.findIndex((c) => c.id === competitor.id);
  return { won, lost, drawn, finishes, ranking: idx >= 0 && idx < 15 ? idx + 1 : null };
}

/** Fighters in a division, champion first, with their records. */
export function fightRankings(sportId: string): ({ competitorId: string } & FightRecord)[] {
  return participantsFor(sportId).slice().sort((a, b) => b.strength - a.strength)
    .map((c) => ({ competitorId: c.id, ...fightRecord(c) }));
}

// ---------------------------------------------------------------------------
// One-line summaries for score cards and headers
// ---------------------------------------------------------------------------

/** "12-4" (US sports), "8-3-2" (W-D-L), "P2 · 143 pts" (racing), "22-3-0" (fighters). */
export function recordLine(competitorId: string, now: number): string | null {
  const c = competitorById(competitorId);
  if (!c) return null;
  const kind = standingsKind(c.sportId);
  if (kind === 'record') {
    const r = fightRecord(c);
    return `${r.won}-${r.lost}-${r.drawn}`;
  }
  if (kind === 'championship') {
    const r = championshipRow(competitorId, now);
    return r ? `P${r.position} · ${r.points} pts` : null;
  }
  const r = teamRow(competitorId, now);
  if (!r) return null;
  if (kind === 'pct') return `${r.won}-${r.lost}`;
  return TEAM_RULES[c.sportId]?.drawChance ? `${r.won}-${r.drawn}-${r.lost}` : `${r.won}-${r.lost}`;
}

/** "1st", "2nd", "3rd", "4th"... (re-exported so screens can get it from one place). */
export { ordinal };

/** The sport's main league name, used as the standings title. */
export function leagueName(sportId: string): string {
  return planFor(sportId)?.competitions[0]?.name ?? sportById(sportId)?.name ?? 'League';
}
