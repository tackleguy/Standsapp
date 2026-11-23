// Plays and Performances: the moments packs are made of. A Play card is one
// play from a real (simulated) game; a Performance card is one player's whole
// game. Bigger plays and bigger games are rarer. Every sport whose simulator
// credits players has moments.
import { createRng } from '@/lib/random';
import { RARITY_ORDER } from '@/logic/cards';

import type { CardRarity, CardTemplate, EventMeta } from '../types';
import { gameStatsFor, simulate } from './engines';
import { linesUpTo, pointsOf } from './players/lines';
import { playerById } from './players/roster';
import { sportStats } from './players/sports';
import type { StatLine } from './players/types';
import { eventMetaById, eventsBetween } from './schedule';

export type MomentKind = 'play' | 'performance';

export interface Moment extends CardTemplate {
  kind: MomentKind;
  eventId: string;
  sportId: string;
  playerId: string;
  /** Play cards only. */
  playId: string | null;
  /** When it happened: the play, or the end of the game. */
  at: number;
  /** Shown on the card: "29-yd TD run", "181 yds 1 td 5 rec". */
  headline: string;
  /** Play rating (plays) or fantasy points (performances). */
  value: number;
}

/** Play rarity from its rating: the biggest plays are Legendary. Small plays are not collectible. */
export function playRarity(impact: number): CardRarity | null {
  if (impact >= 8) return 'legendary';
  if (impact >= 6) return 'epic';
  if (impact >= 4) return 'rare';
  if (impact >= 2) return 'common';
  return null;
}

/** Performance rarity from fantasy points. Quiet games are not collectible. */
export function performanceRarity(points: number): CardRarity | null {
  if (points >= 35) return 'legendary';
  if (points >= 24) return 'epic';
  if (points >= 15) return 'rare';
  if (points >= 7) return 'common';
  return null;
}

export const playTemplateId = (rarity: CardRarity, playId: string) => `play|${rarity}|${playId}`;
export const performanceTemplateId = (rarity: CardRarity, eventId: string, playerId: string) => `perf|${rarity}|${eventId}|${playerId}`;

export function isMomentTemplate(id: string): boolean {
  return id.startsWith('play|') || id.startsWith('perf|');
}

/** The rarity written into a moment template id. */
export function momentRarity(id: string): CardRarity | null {
  return isMomentTemplate(id) ? (id.split('|')[1] as CardRarity) : null;
}

const finishedCache = new Map<string, Moment[]>();

/** Every collectible moment of one event, as of `now` (performances once it has finished). */
export function momentsForEvent(meta: EventMeta, now: number): Moment[] {
  if (meta.disruption) return [];
  const state = simulate(meta, now);
  if (state.status === 'scheduled') return [];
  const hit = state.status === 'finished' ? finishedCache.get(meta.id) : undefined;
  if (hit) return hit;
  const out: Moment[] = [];
  for (const p of state.plays) {
    const playerId = p.playerIds?.[0];
    if (!playerId || p.impact === undefined) continue;
    const rarity = playRarity(p.impact);
    const player = playerById(playerId);
    if (!rarity || !player) continue;
    out.push({ id: playTemplateId(rarity, p.id), competitorId: player.sideId, rarity, season: '2026', kind: 'play', eventId: meta.id,
      sportId: meta.sportId, playerId, playId: p.id, at: p.at, headline: p.headline ?? p.description, value: p.impact });
  }
  if (state.status === 'finished') {
    for (const [playerId, line] of linesUpTo(meta.sportId, gameStatsFor(meta).events)) {
      const rarity = performanceRarity(pointsOf(meta.sportId, line));
      const moment = rarity ? performanceMoment(meta, state.endsAt, playerId, line, rarity) : null;
      if (moment) out.push(moment);
    }
    finishedCache.set(meta.id, out);
    if (finishedCache.size > 400) finishedCache.delete(finishedCache.keys().next().value as string);
  }
  return out;
}

function performanceMoment(meta: EventMeta, endsAt: number, playerId: string, line: StatLine, rarity: CardRarity): Moment | null {
  const player = playerById(playerId);
  if (!player) return null;
  return { id: performanceTemplateId(rarity, meta.id, playerId), competitorId: player.sideId, rarity, season: '2026',
    kind: 'performance', eventId: meta.id, sportId: meta.sportId, playerId, playId: null, at: endsAt,
    headline: sportStats(meta.sportId).headline(line, player.pos), value: pointsOf(meta.sportId, line) };
}

/** Rebuilds a moment from its template id (for card faces and details). */
export function momentById(templateId: string): Moment | null {
  if (!isMomentTemplate(templateId)) return null;
  const parts = templateId.split('|');
  const eventId = parts[0] === 'play' ? parts[2].split('#')[0] : parts[2];
  const meta = eventMetaById(eventId);
  if (!meta) return null;
  const found = momentsForEvent(meta, Number.MAX_SAFE_INTEGER).find((m) => m.id === templateId);
  if (found || parts[0] !== 'perf') return found ?? null;
  // A Performance card collected before its game's stats were corrected (motor
  // racing once counted places won when a car ahead pitted as overtakes) can now
  // be worth a different rarity, or none. The card keeps the rarity it was
  // collected at and shows the corrected line.
  const [, rarity, , playerId] = parts;
  const state = simulate(meta, Number.MAX_SAFE_INTEGER);
  const gs = gameStatsFor(meta);
  if (state.status !== 'finished' || !RARITY_ORDER.includes(rarity as CardRarity)
    || !gs.lineups.some((l) => l.playerIds.includes(playerId))) return null;
  return performanceMoment(meta, state.endsAt, playerId, linesUpTo(meta.sportId, gs.events).get(playerId) ?? {}, rarity as CardRarity);
}

/**
 * Moments for a pack: from a random handful of games played in the last three
 * days (or still on), optionally one sport, sampled until every rarity is there.
 * Sampling keeps opening a pack quick on a phone.
 */
export function momentPool(now: number, random: () => number, sportId: string | null = null, minGames = 8, maxGames = 30): Moment[] {
  const metas = eventsBetween(now - 3 * 24 * 3_600_000, now)
    .filter((m) => !m.disruption && m.startsAt <= now && (!sportId || m.sportId === sportId));
  const order = [...metas];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const pool: Moment[] = [];
  const have = new Set<CardRarity>();
  for (let i = 0; i < order.length && i < maxGames; i++) {
    for (const m of momentsForEvent(order[i], now)) {
      pool.push(m);
      have.add(m.rarity);
    }
    if (i + 1 >= minGames && have.size === 4) break;
  }
  return pool;
}

/** How many copies of a moment other fans already own, so serials look lived-in. */
export function momentMintedBefore(templateId: string, cap: number): number {
  return createRng(`minted:${templateId}`).int(0, Math.max(0, Math.floor(cap * 0.25)));
}
