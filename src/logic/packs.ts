// Stand Card packs: published odds, rolled fairly.
import type { CardRarity, CardTemplate } from '@/data/types';

import { PACK_ODDS } from './rules';

/** Turns a random number in [0, 1) into a rarity using the published odds. */
export function rollRarity(roll: number): CardRarity {
  let acc = 0;
  for (const o of PACK_ODDS) {
    acc += o.chance;
    if (roll < acc) return o.rarity;
  }
  return 'legendary';
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

export function oddsText(chance: number): string {
  return `${Math.round(chance * 100)}%`;
}
