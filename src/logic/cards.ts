// Collection rules: quick sell, duplicates, trade-ups, sets, showcase, and sorting.
// Pure functions, so the server routines can mirror them exactly later.
import type { CardRarity, OwnedCard } from '@/data/types';

import { mintKey } from './packs';
import {
  HOLO_SELL_MULTIPLIER, QUICK_SELL_TIX, SET_REWARD_PER_CARD, SHOWCASE_MAX, TRADE_UP_COUNT,
} from './rules';

export const RARITY_ORDER: CardRarity[] = ['common', 'rare', 'epic', 'legendary'];
const RANK: Record<CardRarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };

export function rarityLabel(r: CardRarity): string {
  return r[0].toUpperCase() + r.slice(1);
}

export function nextRarity(r: CardRarity): CardRarity | null {
  return RARITY_ORDER[RANK[r] + 1] ?? null;
}

export const isHolo = (c: Pick<OwnedCard, 'finish'>) => c.finish === 'holo';
export const isGameDay = (c: Pick<OwnedCard, 'eventId'>) => !!c.eventId;

/** Tix a card is worth when quick sold. */
export function quickSellValue(c: Pick<OwnedCard, 'rarity' | 'finish'>): number {
  return QUICK_SELL_TIX[c.rarity] * (isHolo(c) ? HOLO_SELL_MULTIPLIER : 1);
}

/** Cards that are the same card: same team or athlete, rarity, finish, and edition. */
export function variantKey(c: Pick<OwnedCard, 'templateId' | 'finish' | 'eventId'>): string {
  return mintKey(c.templateId, c.finish ?? 'base', c.eventId ?? null);
}

/** Favorites and showcased cards can never be quick sold or traded up. */
export function isProtected(c: Pick<OwnedCard, 'id' | 'favorite'>, showcase: readonly string[]): boolean {
  return !!c.favorite || showcase.includes(c.id);
}

/** The copy to keep: protected copies first, then the lowest serial. */
function bestCopy(copies: OwnedCard[], showcase: readonly string[]): OwnedCard {
  return [...copies].sort((a, b) =>
    Number(isProtected(b, showcase)) - Number(isProtected(a, showcase)) || a.serial - b.serial)[0];
}

/** Every extra copy that can be quick sold, keeping the best copy of each card. */
export function duplicatesToSell(cards: OwnedCard[], showcase: readonly string[]): OwnedCard[] {
  const out: OwnedCard[] = [];
  for (const group of groupCards(cards, showcase)) {
    if (group.cards.length < 2) continue;
    for (const c of group.cards) if (c.id !== group.top.id && !isProtected(c, showcase)) out.push(c);
  }
  return out;
}

export function totalSellValue(cards: Pick<OwnedCard, 'rarity' | 'finish'>[]): number {
  return cards.reduce((sum, c) => sum + quickSellValue(c), 0);
}

const SCORE: Record<CardRarity, number> = { common: 1, rare: 5, epic: 25, legendary: 100 };
export const SET_SCORE = 100;

/** Collector score: rarer cards count for more, Holo doubles, each finished set adds 100. */
export function collectorScore(cards: Pick<OwnedCard, 'rarity' | 'finish'>[], setsClaimed = 0): number {
  return cards.reduce((sum, c) => sum + SCORE[c.rarity] * (isHolo(c) ? 2 : 1), 0) + setsClaimed * SET_SCORE;
}

export interface CardGroup {
  key: string;
  /** The copy shown in the grid: favorites first, then the lowest serial. */
  top: OwnedCard;
  cards: OwnedCard[];
  newest: number;
}

/** Stacks identical cards together. */
export function groupCards(cards: OwnedCard[], showcase: readonly string[] = []): CardGroup[] {
  const map = new Map<string, OwnedCard[]>();
  for (const c of cards) {
    const k = variantKey(c);
    const list = map.get(k);
    if (list) list.push(c); else map.set(k, [c]);
  }
  return [...map.entries()].map(([key, list]) => ({
    key, cards: list, top: bestCopy(list, showcase), newest: Math.max(...list.map((c) => c.acquiredAt)),
  }));
}

export type CardSort = 'newest' | 'rarity' | 'serial' | 'name' | 'value';

export const SORT_LABELS: Record<CardSort, string> = {
  newest: 'Newest first',
  rarity: 'Rarest first',
  serial: 'Lowest serial',
  name: 'Name A to Z',
  value: 'Quick-sell value',
};

export function sortGroups(groups: CardGroup[], sort: CardSort, nameOf: (competitorId: string) => string): CardGroup[] {
  const byName = (a: CardGroup, b: CardGroup) => nameOf(a.top.competitorId).localeCompare(nameOf(b.top.competitorId));
  const byRarity = (a: CardGroup, b: CardGroup) =>
    RANK[b.top.rarity] - RANK[a.top.rarity] || Number(isHolo(b.top)) - Number(isHolo(a.top));
  const list = [...groups];
  switch (sort) {
    case 'rarity': return list.sort((a, b) => byRarity(a, b) || byName(a, b));
    case 'serial': return list.sort((a, b) => a.top.serial - b.top.serial || byRarity(a, b));
    case 'name': return list.sort((a, b) => byName(a, b) || byRarity(a, b));
    case 'value': return list.sort((a, b) => quickSellValue(b.top) - quickSellValue(a.top) || byName(a, b));
    default: return list.sort((a, b) => b.newest - a.newest);
  }
}

/** Why a trade-up is not allowed, or null when it is. */
export function validateTradeUp(cards: OwnedCard[], showcase: readonly string[]): string | null {
  if (cards.length !== TRADE_UP_COUNT) return `Pick exactly ${TRADE_UP_COUNT} cards.`;
  if (new Set(cards.map((c) => c.id)).size !== cards.length) return `Pick ${TRADE_UP_COUNT} different cards.`;
  const rarity = cards[0].rarity;
  if (cards.some((c) => c.rarity !== rarity)) return `All ${TRADE_UP_COUNT} cards must be the same rarity.`;
  if (!nextRarity(rarity)) return 'Legendary is already the top rarity.';
  if (cards.some((c) => isProtected(c, showcase))) return 'Favorites and showcased cards cannot be traded up.';
  return null;
}

/** Why a card cannot be added to the showcase, or null when it can. */
export function validateShowcaseAdd(showcase: readonly string[], cardId: string): string | null {
  if (showcase.includes(cardId)) return null;
  if (showcase.length >= SHOWCASE_MAX) return `Your showcase holds ${SHOWCASE_MAX} cards. Remove one first.`;
  return null;
}

export interface SetProgress {
  total: number;
  owned: number;
  ownedIds: Set<string>;
  complete: boolean;
  reward: number;
}

/** A sport's set needs one card (any rarity or edition) of every team and athlete. */
export function setProgress(memberIds: string[], cards: Pick<OwnedCard, 'competitorId'>[]): SetProgress {
  const have = new Set(cards.map((c) => c.competitorId));
  const ownedIds = new Set(memberIds.filter((id) => have.has(id)));
  return {
    total: memberIds.length,
    owned: ownedIds.size,
    ownedIds,
    complete: memberIds.length > 0 && ownedIds.size === memberIds.length,
    reward: memberIds.length * SET_REWARD_PER_CARD,
  };
}

/** "soccer-2026-11-23-05" -> the game's UTC date, for the Game Day stamp. */
export function gameDayDate(eventId: string): number | null {
  const m = /-(\d{4}-\d{2}-\d{2})-\d{2}$/.exec(eventId);
  if (!m) return null;
  const ms = Date.parse(`${m[1]}T12:00:00Z`);
  return Number.isNaN(ms) ? null : ms;
}
