// Stand Card templates: one per competitor per rarity, all generated art.
import { createRng, hashText } from '@/lib/random';
import { parseMintKey } from '@/logic/packs';
import { printRun } from '@/logic/rules';

import type { CardRarity, CardTemplate, Competitor } from '../types';
import { isMomentTemplate, momentMintedBefore, momentRarity } from './moments';
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

/**
 * How many copies other fans already own, so serial numbers look lived-in.
 * Plain cards keep their original numbers; Holo and Game Day runs start lower.
 */
export function mintedBefore(key: string): number {
  const { templateId, finish, eventId } = parseMintKey(key);
  // Chosen player and team cards: how many other fans already hold this one.
  if (templateId.startsWith('player|') || templateId.startsWith('team|')) {
    return createRng(`minted:${templateId}`).int(templateId.startsWith('team|') ? 40 : 3, templateId.startsWith('team|') ? 900 : 400);
  }
  if (isMomentTemplate(templateId)) {
    const r = momentRarity(templateId) ?? 'common';
    const run = printRun(r, finish, !!eventId) ?? 900;
    return momentMintedBefore(key, Math.min(run, 900));
  }
  const rarity = templateId.split(':')[1] as CardRarity;
  const cap = rarity === 'legendary' ? 12 : rarity === 'epic' ? 60 : rarity === 'rare' ? 240 : 900;
  if (finish === 'base' && !eventId) return createRng(`minted:${templateId}`).int(0, cap) + (hashText(templateId) % 7);
  const run = printRun(rarity, finish, !!eventId) ?? cap;
  return createRng(`minted:${key}`).int(0, Math.min(cap, Math.floor(run * 0.3)));
}

/** Every team and athlete in a sport's set, in card-number order. */
export function setMembers(sportId: string): Competitor[] {
  return getWorld().bySport.get(sportId) ?? [];
}

export { CARD_WIN_TIX } from '@/logic/rules';
