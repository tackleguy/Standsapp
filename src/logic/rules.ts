// The game rules in one place. They mirror the planned server routines exactly,
// so moving to a real database later changes nothing for fans.
import type { CardFinish, CardRarity, PackTypeId } from '@/data/types';

export const WELCOME_CLOUT = 1000;
export const WELCOME_TIX = 50;
export const STAKE_MIN = 10;
export const STAKE_MAX = 500;
export const STAKE_CHOICES = [10, 25, 50, 100, 250, 500] as const;
export const MIN_AGE = 13;
export const COMMENT_MAX = 500;
export const COMMENT_COOLDOWN_MS = 2000;

// ---------- Stand Cards ----------

export type Odds = { rarity: CardRarity; chance: number }[];

const odds = (common: number, rare: number, epic: number, legendary: number): Odds => [
  { rarity: 'common', chance: common },
  { rarity: 'rare', chance: rare },
  { rarity: 'epic', chance: epic },
  { rarity: 'legendary', chance: legendary },
];

/** Published odds per card in a Standard pack. */
export const PACK_ODDS: Odds = odds(0.7, 0.22, 0.07, 0.01);

/** Any card from any pack can come out as a shiny Holo parallel. */
export const HOLO_CHANCE = 0.1;

export interface PackType {
  id: PackTypeId;
  name: string;
  blurb: string;
  /** Price in Tix (0 = free). */
  cost: number;
  size: number;
  /** Odds for every card in the pack... */
  odds: Odds;
  /** ...except the last card, which uses these when the pack has a guarantee. */
  guaranteed: { odds: Odds; label: string } | null;
  /** Whether the fan can pick a sport for the pack. */
  sportChoice: boolean;
}

export const PACK_TYPES: Record<PackTypeId, PackType> = {
  daily: {
    id: 'daily', name: 'Daily Free Pack', blurb: 'One free card every day. A new one arrives at midnight UTC.',
    cost: 0, size: 1, odds: PACK_ODDS, guaranteed: null, sportChoice: true,
  },
  standard: {
    id: 'standard', name: 'Standard Pack', blurb: 'The everyday pack. Three cards from any sport you like.',
    cost: 25, size: 3, odds: PACK_ODDS, guaranteed: null, sportChoice: true,
  },
  premium: {
    id: 'premium', name: 'Premium Pack', blurb: 'Five cards with better odds. The last card is always Rare or better.',
    cost: 75, size: 5, odds: odds(0.6, 0.28, 0.1, 0.02),
    guaranteed: { odds: odds(0, 0.75, 0.2, 0.05), label: 'Rare or better' }, sportChoice: true,
  },
  elite: {
    id: 'elite', name: 'Elite Pack', blurb: 'Three cards, no Commons. The last card is always Epic or better.',
    cost: 150, size: 3, odds: odds(0, 0.6, 0.32, 0.08),
    guaranteed: { odds: odds(0, 0, 0.8, 0.2), label: 'Epic or better' }, sportChoice: true,
  },
  game: {
    id: 'game', name: 'Game Pack', blurb: 'Two Game Day cards from the teams or athletes in one game. On sale only while the game is on.',
    cost: 20, size: 2, odds: odds(0.62, 0.27, 0.09, 0.02), guaranteed: null, sportChoice: false,
  },
};

/** The packs on the Pack Store shelf, in order. Game Packs are listed per game. */
export const SHELF_PACKS: PackTypeId[] = ['daily', 'standard', 'premium', 'elite'];

/** Game Packs open this long before the start and close when the game ends. */
export const GAME_PACK_OPENS_MS = 2 * 60 * 60 * 1000;

/**
 * How many copies of each card exist. `null` means no limit.
 * Holo parallels and Game Day editions are numbered separately.
 */
export const PRINT_RUNS: Record<CardFinish | 'gameDay', Record<CardRarity, number | null>> = {
  base: { common: null, rare: 2000, epic: 500, legendary: 100 },
  holo: { common: 499, rare: 199, epic: 99, legendary: 25 },
  gameDay: { common: 999, rare: 299, epic: 75, legendary: 10 },
};

export function printRun(rarity: CardRarity, finish: CardFinish, gameDay: boolean): number | null {
  return (gameDay ? PRINT_RUNS.gameDay : PRINT_RUNS[finish])[rarity];
}

/** Tix a card earns each time its team or athlete wins an event. */
export const CARD_WIN_TIX: Record<CardRarity, number> = { common: 1, rare: 2, epic: 4, legendary: 10 };
/** Game Day cards earn this many times more when their team wins *their* game. */
export const GAME_DAY_WIN_MULTIPLIER = 2;

/** Tix you get for quick selling a card. Holo cards are worth double. */
export const QUICK_SELL_TIX: Record<CardRarity, number> = { common: 1, rare: 3, epic: 10, legendary: 40 };
export const HOLO_SELL_MULTIPLIER = 2;

/** Trade up: this many cards of one rarity become one card of the next rarity. */
export const TRADE_UP_COUNT = 5;

/** Cards a fan can pin to the showcase on their profile. */
export const SHOWCASE_MAX = 5;

/** Finishing a sport's set pays this many Tix per card in the set. */
export const SET_REWARD_PER_CARD = 10;

export const CLOUT_DISCLAIMER = 'Clout is free play points with no cash value. It can never be bought or cashed out.';
export const TIX_DISCLAIMER = 'Tix are earned by playing (daily Gate Check, winning cards, sets and quick sells). They can never be bought or cashed out, and cards have no cash value.';
