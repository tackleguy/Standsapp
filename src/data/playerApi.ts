// Players for the screens: a player's performance in one game, their game log,
// and the running stat lines shown under each play in the feed. Works the same
// way for every sport. Like api.ts, this is the swap point for a real backend.
import { DAY, HOUR } from '@/lib/format';
import { fantasyTix } from '@/logic/fantasy';

import { gameStatsFor, simulate } from './demo/engines';
import { addInto, lineOf, pointsByPeriod, pointsOf } from './demo/players/lines';
import { allPlayers, playerById, playersForSide, playersForSport, rosterFor } from './demo/players/roster';
import { sportStats } from './demo/players/sports';
import type { GridCell, Player, StatLine } from './demo/players/types';
import { eventMetaById, eventsBetween } from './demo/schedule';
import type { EventMeta, EventState, Play } from './types';

export type { GridCell, Player, StatLine };
export { allPlayers, playerById, playersForSide, playersForSport, rosterFor, sportStats };

/** A player's whole performance in one event, as of `now`. */
export interface PlayerGame {
  player: Player;
  state: EventState;
  /** The side the player is on, and the other side (null in fields like F1). */
  sideId: string;
  opponentId: string | null;
  played: boolean;
  line: StatLine;
  points: number;
  /** Tix a player card earns for this game (rounded fantasy points, never below 0). */
  tix: number;
  headline: string;
  periods: string[];
  periodPoints: number[];
  /** Rating per period from the plays they were in (biggest moments count most). */
  periodRatings: number[];
  rating: number;
  /** Plays they were in, newest first. */
  plays: Play[];
}

function ratingsFor(plays: Play[], playerId: string, periods: number): number[] {
  const out = Array.from({ length: Math.max(1, periods) }, () => 0);
  for (const p of plays) {
    const k = p.playerIds?.indexOf(playerId) ?? -1;
    if (k < 0 || p.impact === undefined) continue;
    const i = Math.min(out.length - 1, Math.max(0, p.period ?? 0));
    out[i] += (p.impact * (k === 0 ? 1 : 0.5)) / 4;
  }
  return out.map((v) => Math.round(v * 100) / 100);
}

export function getPlayerGame(playerId: string, eventId: string, now: number): PlayerGame | null {
  const player = playerById(playerId);
  const meta = eventMetaById(eventId);
  if (!player || !meta || !meta.competitorIds.includes(player.sideId)) return null;
  const state = simulate(meta, now);
  const gs = gameStatsFor(meta);
  const line = lineOf(meta.sportId, gs, playerId, now);
  const points = pointsOf(meta.sportId, line);
  const plays = state.plays.filter((p) => p.playerIds?.includes(playerId)).reverse();
  const periodRatings = ratingsFor(plays, playerId, gs.periods.length);
  const played = gs.lineups.some((l) => l.playerIds.includes(playerId));
  return {
    player,
    state,
    sideId: player.sideId,
    opponentId: meta.competitorIds.length === 2 ? meta.competitorIds.find((id) => id !== player.sideId) ?? null : null,
    played,
    line,
    points,
    tix: fantasyTix(points),
    headline: sportStats(meta.sportId).headline(line, player.pos),
    periods: gs.periods,
    periodPoints: pointsByPeriod(meta.sportId, gs, playerId, now),
    periodRatings,
    rating: Math.round(periodRatings.reduce((a, b) => a + b, 0) * 10) / 10,
    plays,
  };
}

export interface GameLogRow {
  meta: EventMeta;
  state: EventState;
  points: number;
  headline: string;
}

/** Events a player is in between two times, oldest first. */
export function playerEvents(playerId: string, from: number, to: number): EventMeta[] {
  const player = playerById(playerId);
  if (!player) return [];
  return eventsBetween(from, to).filter((m) => !m.disruption && m.sportId === player.sportId && m.competitorIds.includes(player.sideId));
}

/** Recent and upcoming games with fantasy points, newest first. */
export function getPlayerLog(playerId: string, now: number, days = 4): GameLogRow[] {
  const player = playerById(playerId);
  if (!player) return [];
  return playerEvents(playerId, now - days * DAY, now + 2 * DAY).reverse().map((meta) => {
    const state = simulate(meta, now);
    const line = state.status === 'scheduled' ? {} : lineOf(meta.sportId, gameStatsFor(meta), playerId, now);
    return { meta, state, points: pointsOf(meta.sportId, line), headline: sportStats(meta.sportId).headline(line, player.pos) };
  });
}

/** The game to show by default: live now, else the latest finished, else the next one. */
export function defaultPlayerEvent(playerId: string, now: number): string | null {
  const metas = playerEvents(playerId, now - 4 * DAY, now + 3 * DAY);
  const states = metas.map((m) => simulate(m, now));
  const live = states.find((s) => s.status === 'live');
  if (live) return live.meta.id;
  const done = states.filter((s) => s.status === 'finished');
  if (done.length) return done[done.length - 1].meta.id;
  return states.find((s) => s.status === 'scheduled')?.meta.id ?? null;
}

const avgCache = new Map<string, number>();

/** Average fantasy points over a player's last few finished games (for the card picker). */
export function recentAverage(playerId: string, now: number, games = 5): number {
  const bucket = Math.floor(now / HOUR);
  const key = `${playerId}@${bucket}`;
  const hit = avgCache.get(key);
  if (hit !== undefined) return hit;
  const player = playerById(playerId);
  if (!player) return 0;
  const done = playerEvents(playerId, now - 6 * DAY, now).filter((m) => simulate(m, now).status === 'finished').slice(-games);
  const pts = done.map((m) => pointsOf(m.sportId, lineOf(m.sportId, gameStatsFor(m), playerId)));
  const value = pts.length ? Math.round((pts.reduce((a, b) => a + b, 0) / pts.length) * 10) / 10 : 0;
  avgCache.set(key, value);
  if (avgCache.size > 5000) avgCache.delete(avgCache.keys().next().value as string);
  return value;
}

export interface PlayLine {
  playerId: string;
  short: string;
  text: string;
  role: string | null;
}

/** For each play, the running stat line of every player in it, right after the play. */
export function playLines(meta: EventMeta, plays: Play[]): Map<string, PlayLine[]> {
  const out = new Map<string, PlayLine[]>();
  if (!plays.some((p) => p.playerIds?.length)) return out;
  const def = sportStats(meta.sportId);
  const gs = gameStatsFor(meta);
  const running = new Map<string, StatLine>();
  const sorted = [...plays].sort((a, b) => a.at - b.at || a.seq - b.seq);
  let i = 0;
  for (const p of sorted) {
    while (i < gs.events.length && gs.events[i].at <= p.at) {
      const e = gs.events[i];
      const line = running.get(e.playerId) ?? {};
      running.set(e.playerId, addInto(line, e.stats, def.maxKeys));
      i++;
    }
    if (!p.playerIds?.length) continue;
    out.set(p.id, p.playerIds.map((id, k) => {
      const pl = playerById(id);
      const role = p.playerRoles?.[k] ?? null;
      return { playerId: id, short: pl?.short ?? '?', role, text: pl ? def.feedLine({ ...(running.get(id) ?? {}) }, pl.pos, role ?? undefined) : '' };
    }));
  }
  return out;
}

/** Fantasy points for every player in an event so far, best first. */
export function eventLeaders(meta: EventMeta, now: number): { player: Player; points: number; line: StatLine }[] {
  const gs = gameStatsFor(meta);
  const def = sportStats(meta.sportId);
  const lines = new Map<string, StatLine>();
  for (const e of gs.events) {
    if (e.at > now) break;
    lines.set(e.playerId, addInto(lines.get(e.playerId) ?? {}, e.stats, def.maxKeys));
  }
  return gs.lineups.flatMap((l) => l.playerIds).map((id) => {
    const line = lines.get(id) ?? {};
    return { player: playerById(id)!, points: pointsOf(meta.sportId, line), line };
  }).filter((x) => !!x.player).sort((a, b) => b.points - a.points);
}

/** Fun fan tags for a performance: "#scorer", "#hattrick", "#2fifty"... */
export function performanceTags(sportId: string, line: StatLine, points: number): string[] {
  const n = (k: string) => line[k] ?? 0;
  const tags: string[] = [];
  const add = (cond: boolean, tag: string) => { if (cond) tags.push(tag); };
  switch (sportId) {
    case 'american_football': {
      const yds = n('rushYds') + n('recYds');
      add(n('passYds') >= 400, '#4hundred');
      add(n('passYds') >= 300 && n('passYds') < 400, '#3hundred');
      add(yds >= 250, '#2fifty');
      add(yds >= 100 && yds < 250, '#100club');
      add(n('rushTd') + n('recTd') + n('passTd') >= 3, '#hattrick');
      add(n('rushTd') + n('recTd') > 0, '#scorer');
      add(n('rushAtt') >= 25, '#workhorse');
      add(n('rec') >= 10, '#target');
      add(n('sacks') >= 2, '#sackmaster');
      add(n('ints') > 0, '#ballhawk');
      add(n('fg5') > 0, '#bigleg');
      break;
    }
    case 'soccer': case 'ice_hockey':
      add(n('g') >= 3, '#hattrick'); add(n('g') === 2, '#brace'); add(n('g') === 1, '#scorer');
      add(n('a') >= 2, '#playmaker'); add(n('cs') + n('so') > 0, '#cleansheet'); add(n('sv') >= 8, '#wall');
      break;
    case 'basketball': {
      const doubles = ['pts', 'reb', 'ast', 'stl', 'blk'].filter((k) => n(k) >= 10).length;
      add(doubles >= 3, '#tripledouble'); add(doubles === 2, '#doubledouble');
      add(n('pts') >= 40, '#40burger'); add(n('pts') >= 30 && n('pts') < 40, '#30club'); add(n('tpm') >= 5, '#splash');
      add(n('blk') >= 4, '#rimprotector');
      break;
    }
    case 'rugby_union': case 'rugby_league':
      add(n('t') >= 3, '#hattrick'); add(n('t') > 0 && n('t') < 3, '#tryscorer'); add(n('m') >= 100, '#metres');
      add(n('tkl') >= 15, '#tacklemachine');
      break;
    case 'aussie_rules':
      add(n('g') >= 4, '#bagof4'); add(n('k') + n('hb') >= 30, '#ballmagnet'); add(n('tkl') >= 8, '#tackler');
      break;
    case 'netball':
      add(n('g') >= 30, '#sharpshooter'); add(n('int') >= 3, '#intercept');
      break;
    case 'baseball':
      add(n('hr') > 0, '#dinger'); add(n('h') >= 3, '#hitparade'); add(n('kp') >= 10, '#kking'); add(n('sv') > 0, '#closer');
      break;
    case 'cricket':
      add(n('runs') >= 100, '#century'); add(n('runs') >= 50 && n('runs') < 100, '#fifty'); add(n('sixes') >= 4, '#sixhitter');
      add(n('wkts') >= 5, '#fivefor'); add(n('wkts') >= 3 && n('wkts') < 5, '#wickets');
      break;
    case 'tennis':
      add(n('win') > 0, '#winner'); add(n('aces') >= 10, '#acemachine'); add(n('brk') >= 4, '#breaker');
      break;
    case 'golf':
      add(n('bird') + n('eag') >= 6, '#birdiefest'); add(n('eag') > 0, '#eagle'); add(n('hio') > 0, '#ace'); add(n('toPar') <= -5, '#lowround');
      break;
    case 'mma': case 'boxing':
      add(n('fin') > 0, '#finisher'); add(n('win') > 0 && !n('fin'), '#winner'); add(n('kd') >= 2, '#heavyhands');
      break;
    default:
      add(n('pos') === 1, '#winner'); add(n('gained') >= 5, '#charger'); add(n('fl') > 0, '#fastestlap'); add(n('bk') > 0, '#breakaway');
  }
  add(points >= 30, '#monster');
  add(points >= 20 && points < 30, '#bigday');
  return tags.slice(0, 5);
}
