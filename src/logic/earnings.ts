// What your Stand Cards have earned, worked out from your Tix ledger. Pure
// functions over the ledger, so the server can produce the same report later.
import { DAY } from '@/lib/format';

/** Where card Tix come from. The first three count as "earned by your cards". */
export const EARNING_SOURCES = [
  { reason: 'card_win', label: 'Win bonuses', detail: 'Paid when a card\'s team or athlete wins', icon: 'trophy' },
  { reason: 'card_fantasy', label: 'Fantasy points', detail: 'Player and team cards score from their games', icon: 'stats-chart' },
  { reason: 'set_reward', label: 'Set rewards', detail: 'Finishing a sport\'s set', icon: 'albums' },
  { reason: 'quick_sell', label: 'Quick sells', detail: 'Cards you sold back for Tix', icon: 'pricetag' },
] as const;

export type EarningReason = (typeof EARNING_SOURCES)[number]['reason'];

/** Card earnings proper: what cards earned by playing, not by being sold. */
export const CARD_EARNED: readonly string[] = ['card_win', 'card_fantasy', 'set_reward'];

/** Tix spent on cards: packs and chosen player or team cards. */
export function isCardSpend(reason: string): boolean {
  return reason.startsWith('pack_') || reason === 'player_card' || reason === 'team_card' || reason === 'pack';
}

export type EarningsPeriod = 'today' | 'week' | 'season';

export interface LedgerLine { currency: 'clout' | 'tix'; amount: number; reason: string; at: number; ref: string | null }

const utcDay = (t: number) => Math.floor(t / DAY) * DAY;

/** Start of a period, the same windows as the leaderboards: UTC day, rolling 7 days, season. */
export function periodStart(period: EarningsPeriod, now: number, seasonStart: number): number {
  if (period === 'today') return utcDay(now);
  if (period === 'week') return now - 7 * DAY;
  return seasonStart;
}

export interface EarningsSummary {
  /** Tix your cards earned (win bonuses, fantasy points, set rewards). */
  earned: number;
  bySource: Record<EarningReason, number>;
  /** Tix spent on packs and cards. */
  spent: number;
  /** Everything in (earned + quick sells) minus what you spent. */
  net: number;
  /** How many separate payouts landed. */
  payouts: number;
}

export function earningsSummary(ledger: LedgerLine[], from: number, now: number): EarningsSummary {
  const bySource = { card_win: 0, card_fantasy: 0, set_reward: 0, quick_sell: 0 } as Record<EarningReason, number>;
  let spent = 0;
  let payouts = 0;
  for (const l of ledger) {
    if (l.currency !== 'tix' || l.at < from || l.at > now) continue;
    if (l.reason in bySource) {
      bySource[l.reason as EarningReason] += l.amount;
      if (CARD_EARNED.includes(l.reason)) payouts++;
    } else if (isCardSpend(l.reason) && l.amount < 0) spent += -l.amount;
  }
  const earned = bySource.card_win + bySource.card_fantasy + bySource.set_reward;
  return { earned, bySource, spent, net: earned + bySource.quick_sell - spent, payouts };
}

/** Card earnings for each of the last `days` UTC days, oldest first. */
export function dailyEarnings(ledger: LedgerLine[], now: number, days = 7): { day: number; total: number }[] {
  const today = utcDay(now);
  const out = Array.from({ length: days }, (_, i) => ({ day: today - (days - 1 - i) * DAY, total: 0 }));
  for (const l of ledger) {
    if (l.currency !== 'tix' || !CARD_EARNED.includes(l.reason) || l.at > now) continue;
    const idx = Math.floor((utcDay(l.at) - out[0].day) / DAY);
    if (idx >= 0 && idx < days) out[idx].total += l.amount;
  }
  return out;
}

/** The cards that have earned the most, by card id, with how many payouts each. */
export function topEarners(ledger: LedgerLine[], from: number, now: number, limit = 5): { cardId: string; total: number; payouts: number }[] {
  const map = new Map<string, { total: number; payouts: number }>();
  for (const l of ledger) {
    if (l.currency !== 'tix' || (l.reason !== 'card_win' && l.reason !== 'card_fantasy') || !l.ref || l.at < from || l.at > now) continue;
    const cur = map.get(l.ref) ?? { total: 0, payouts: 0 };
    cur.total += l.amount;
    cur.payouts++;
    map.set(l.ref, cur);
  }
  return [...map.entries()].map(([cardId, v]) => ({ cardId, ...v }))
    .sort((a, b) => b.total - a.total || b.payouts - a.payouts || a.cardId.localeCompare(b.cardId)).slice(0, limit);
}

/** The latest earnings and quick sells, newest first. */
export function recentEarnings<T extends LedgerLine>(ledger: T[], limit = 20): T[] {
  return ledger.filter((l) => l.currency === 'tix' && l.amount > 0 && (CARD_EARNED.includes(l.reason) || l.reason === 'quick_sell'))
    .sort((a, b) => b.at - a.at).slice(0, limit);
}
