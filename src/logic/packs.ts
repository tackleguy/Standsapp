// Stand Card packs: published odds, rolled fairly, numbered within each print run.
import type { CardFinish, CardRarity, CardTemplate, EventStatus } from '@/data/types';

import { GAME_PACK_OPENS_MS, HOLO_CHANCE, PACK_ODDS, printRun, type Odds, type PackType } from './rules';

/** Turns a random number in [0, 1) into a rarity using the given published odds. */
export function rollRarity(roll: number, odds: Odds = PACK_ODDS): CardRarity {
  let acc = 0;
  for (const o of odds) {
    acc += o.chance;
    if (roll < acc) return o.rarity;
  }
  return odds[odds.length - 1]?.rarity ?? 'legendary';
}

/** Turns a random number in [0, 1) into a finish (1 in 10 cards is Holo). */
export function rollFinish(roll: number): CardFinish {
  return roll < HOLO_CHANCE ? 'holo' : 'base';
}

/** The odds used for one card slot of a pack (the last slot may be guaranteed). */
export function oddsForSlot(pack: PackType, index: number): Odds {
  return pack.guaranteed && index === pack.size - 1 ? pack.guaranteed.odds : pack.odds;
}

/** Picks a template of the rolled rarity (falls back to any card, like the server). */
export function pickTemplate(
  templates: CardTemplate[], rarity: CardRarity, random: () => number, sportFilter?: (t: CardTemplate) => boolean,
): CardTemplate | null {
  const pool = templates.filter((t) => (!sportFilter || sportFilter(t)));
  const exact = pool.filter((t) => t.rarity === rarity);
  const source = exact.length > 0 ? exact : pool;
  if (source.length === 0) return null;
  return source[Math.floor(random() * source.length)];
}

/**
 * The print run a card is numbered in. Plain cards keep the template id so serials
 * carry on from before; Holo parallels and Game Day editions get their own runs.
 */
export function mintKey(templateId: string, finish: CardFinish = 'base', eventId: string | null = null): string {
  return `${templateId}${finish === 'holo' ? '+holo' : ''}${eventId ? `@${eventId}` : ''}`;
}

export function parseMintKey(key: string): { templateId: string; finish: CardFinish; eventId: string | null } {
  const [left, eventId] = key.split('@');
  const holo = left.endsWith('+holo');
  return { templateId: holo ? left.slice(0, -'+holo'.length) : left, finish: holo ? 'holo' : 'base', eventId: eventId ?? null };
}

export interface RolledCard {
  templateId: string;
  competitorId: string;
  rarity: CardRarity;
  finish: CardFinish;
  serial: number;
}

/**
 * Rolls every card in a pack. Each card is rolled separately with the published odds,
 * then numbered in its print run. A sold-out Holo run falls back to the plain card;
 * a sold-out card is swapped for another card of the same rarity.
 */
export function rollCards(input: {
  pack: PackType;
  templates: CardTemplate[];
  mint: Record<string, number>;
  random: () => number;
  mintedBefore: (key: string) => number;
  eventId?: string | null;
}): { cards: RolledCard[]; mint: Record<string, number> } | { error: string } {
  const { pack, random } = input;
  const eventId = input.eventId ?? null;
  const mint = { ...input.mint };
  const cards: RolledCard[] = [];
  if (input.templates.length === 0) return { error: 'No cards are available for this pack yet.' };
  for (let i = 0; i < pack.size; i++) {
    const rarity = rollRarity(random(), oddsForSlot(pack, i));
    let finish = rollFinish(random());
    let pool = input.templates;
    let picked: RolledCard | null = null;
    for (let attempt = 0; attempt < 24 && !picked; attempt++) {
      const t = pickTemplate(pool, rarity, random);
      if (!t) break;
      const key = mintKey(t.id, finish, eventId);
      const next = (mint[key] ?? input.mintedBefore(key)) + 1;
      const run = printRun(t.rarity, finish, eventId !== null);
      if (run === null || next <= run) {
        mint[key] = next;
        picked = { templateId: t.id, competitorId: t.competitorId, rarity: t.rarity, finish, serial: next };
      } else if (finish === 'holo') {
        finish = 'base';
      } else {
        pool = pool.filter((x) => x.id !== t.id);
      }
    }
    if (!picked) return { error: 'This pack is sold out right now. Try another pack.' };
    cards.push(picked);
  }
  return { cards, mint };
}

/** Game Packs are on sale from two hours before the start until the game ends. */
export function gamePackOpen(state: { status: EventStatus; meta: { startsAt: number } }, now: number): boolean {
  if (state.status === 'live') return true;
  if (state.status === 'scheduled') return state.meta.startsAt - now <= GAME_PACK_OPENS_MS;
  return false;
}

export function oddsText(chance: number): string {
  if (chance <= 0) return '–';
  const pct = chance * 100;
  return `${pct < 1 ? pct.toFixed(1) : Math.round(pct)}%`;
}
