// The game rules in one place. They mirror the planned server routines exactly,
// so moving to a real database later changes nothing for fans.
import type { CardRarity } from '@/data/types';

export const WELCOME_CLOUT = 1000;
export const WELCOME_TIX = 50;
export const STAKE_MIN = 10;
export const STAKE_MAX = 500;
export const STAKE_CHOICES = [10, 25, 50, 100, 250, 500] as const;
export const PACK_COST = 25;
export const PACK_SIZE = 3;
export const MIN_AGE = 13;
export const COMMENT_MAX = 500;
export const COMMENT_COOLDOWN_MS = 2000;

/** Published odds per card in a pack. */
export const PACK_ODDS: { rarity: CardRarity; chance: number }[] = [
  { rarity: 'common', chance: 0.7 },
  { rarity: 'rare', chance: 0.22 },
  { rarity: 'epic', chance: 0.07 },
  { rarity: 'legendary', chance: 0.01 },
];

export const CLOUT_DISCLAIMER = 'Clout is free play points with no cash value. It can never be bought or cashed out.';
