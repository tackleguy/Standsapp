// Prediction math, shared by the screen preview and the settle step.
import { STAKE_MAX, STAKE_MIN } from './rules';

/** What a fan would get back, shown before they confirm. Mirrors the server: floor(stake * multiplier). */
export function potentialPayout(stake: number, multiplier: number): number {
  return Math.floor(stake * multiplier);
}

/** A stake the server would accept, or an explanation of why not. */
export function validateStake(stake: number, balance: number): string | null {
  if (!Number.isFinite(stake) || !Number.isInteger(stake)) return 'Pick a whole number of Clout.';
  if (stake < STAKE_MIN || stake > STAKE_MAX) return `Stake must be between ${STAKE_MIN} and ${STAKE_MAX} Clout.`;
  if (stake > balance) return 'Not enough Clout.';
  return null;
}

/** Keeps a typed or picked stake inside the allowed range. */
export function clampStake(stake: number): number {
  if (!Number.isFinite(stake)) return STAKE_MIN;
  return Math.min(STAKE_MAX, Math.max(STAKE_MIN, Math.round(stake)));
}

export interface RecordSummary {
  made: number;
  settled: number;
  won: number;
  winRate: number; // 0..100
  net: number; // Clout won minus Clout staked on settled calls
}

export function summarizeRecord(
  predictions: { status: 'open' | 'won' | 'lost' | 'void'; stake: number; payout: number | null }[],
): RecordSummary {
  const settled = predictions.filter((p) => p.status === 'won' || p.status === 'lost');
  const won = settled.filter((p) => p.status === 'won').length;
  const net = settled.reduce((a, p) => a + (p.payout ?? 0) - p.stake, 0);
  return {
    made: predictions.length,
    settled: settled.length,
    won,
    winRate: settled.length === 0 ? 0 : Math.round((won / settled.length) * 100),
    net,
  };
}
