// What a player card or team card earns: a player card earns its player's
// fantasy points (rounded) after every game; a team card earns the combined
// fantasy points of the team's three best performers in that game. Only games
// that start after you got the card count.
import { DAY } from '@/lib/format';
import { fantasyTix, teamFantasyPoints } from '@/logic/fantasy';

import type { EventMeta, OwnedCard } from '../types';
import { gameStatsFor, simulate } from './engines';
import { lineOf, pointsOf } from './players/lines';
import { playerById, playersForSport } from './players/roster';
import { eventsBetween } from './schedule';
import { competitorById } from './world';

export interface CardGame {
  meta: EventMeta;
  points: number;
  tix: number;
  /** False when the player sat the game out (or the team did not play). */
  played: boolean;
}

/** Does this event involve the card's player or team? */
export function cardInEvent(card: Pick<OwnedCard, 'kind' | 'playerId' | 'competitorId'>, meta: EventMeta): boolean {
  if (card.kind === 'player') {
    const p = playerById(card.playerId);
    return !!p && meta.competitorIds.includes(p.sideId);
  }
  if (card.kind === 'team') {
    if (meta.competitorIds.includes(card.competitorId)) return true;
    // Racing and cycling teams: their athletes are the competitors.
    return meta.competitorIds.some((id) => competitorById(id)?.parentId === card.competitorId);
  }
  return false;
}

/** Fantasy points for a team in an event: its three best performers combined. */
export function teamPointsIn(teamId: string, meta: EventMeta, now = Number.MAX_SAFE_INTEGER): { points: number; played: boolean } {
  const gs = gameStatsFor(meta);
  const team = competitorById(teamId);
  const sportPlayers = team ? playersForSport(team.sportId) : [];
  const ids = new Set(sportPlayers.filter((p) => p.teamId === teamId || p.sideId === teamId).map((p) => p.id));
  const mine = gs.lineups.flatMap((l) => l.playerIds).filter((id) => ids.has(id));
  if (mine.length === 0) return { points: 0, played: false };
  const pts = mine.map((id) => pointsOf(meta.sportId, lineOf(meta.sportId, gs, id, now)));
  return { points: teamFantasyPoints(pts), played: true };
}

/** What a player or team card earns from one event, as of `now`. */
export function cardEarning(card: Pick<OwnedCard, 'kind' | 'playerId' | 'competitorId'>, meta: EventMeta, now = Number.MAX_SAFE_INTEGER): CardGame {
  if (card.kind === 'team') {
    const { points, played } = teamPointsIn(card.competitorId, meta, now);
    return { meta, points, tix: fantasyTix(points), played };
  }
  const gs = gameStatsFor(meta);
  const id = card.playerId ?? '';
  const played = gs.lineups.some((l) => l.playerIds.includes(id));
  const points = played ? pointsOf(meta.sportId, lineOf(meta.sportId, gs, id, now)) : 0;
  return { meta, points, tix: fantasyTix(points), played };
}

/** A card's games since it was acquired (newest first), finished or live, up to `limit`. */
export function cardGames(card: Pick<OwnedCard, 'kind' | 'playerId' | 'competitorId' | 'acquiredAt'>, now: number, limit = 10): (CardGame & { live: boolean })[] {
  const from = Math.max(card.acquiredAt, now - 7 * DAY);
  return eventsBetween(from - DAY, now)
    .filter((m) => !m.disruption && m.startsAt >= card.acquiredAt && m.startsAt <= now && cardInEvent(card, m))
    .reverse()
    .slice(0, limit)
    .map((meta) => ({ ...cardEarning(card, meta, now), live: simulate(meta, now).status === 'live' }));
}

/** The card's next game that has not started yet. */
export function cardNextGame(card: Pick<OwnedCard, 'kind' | 'playerId' | 'competitorId'>, now: number): EventMeta | null {
  return eventsBetween(now, now + 4 * DAY).find((m) => !m.disruption && m.startsAt > now && cardInEvent(card, m)) ?? null;
}
