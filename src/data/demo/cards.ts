// Stand Card templates: one per competitor per rarity, all generated art.
import { createRng, hashText } from '@/lib/random';

import type { CardRarity, CardTemplate } from '../types';
import { getWorld } from './world';

export const SEASON = '2026';
export const RARITIES: CardRarity[] = ['common', 'rare', 'epic', 'legendary'];

let cached: CardTemplate[] | null = null;

export function allTemplates(): CardTemplate[] {
  if (cached) return cached;
  cached = getWorld().competitors.flatMap((c) =>
    RARITIES.map((rarity) => ({ id: `${c.id}:${rarity}`, competitorId: c.id, rarity, season: SEASON })));
  return cached;
}

export function templateById(id: string): CardTemplate | undefined {
  const [competitorId, rarity] = id.split(':');
  if (!competitorId || !rarity) return undefined;
  return { id, competitorId, rarity: rarity as CardRarity, season: SEASON };
}

/** How many copies other fans already own, so serial numbers look lived-in. */
export function mintedBefore(templateId: string): number {
  const rarity = templateId.split(':')[1] as CardRarity;
  const cap = rarity === 'legendary' ? 12 : rarity === 'epic' ? 60 : rarity === 'rare' ? 240 : 900;
  return createRng(`minted:${templateId}`).int(0, cap) + (hashText(templateId) % 7);
}

/** Tix a card earns when its competitor wins an event. */
export const CARD_WIN_TIX: Record<CardRarity, number> = { common: 1, rare: 2, epic: 4, legendary: 10 };
