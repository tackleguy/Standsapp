// A fan's public profile: standings, tier, form, favourite teams, and their recent
// Calls. The Calls are made on real finished events in the simulated world and
// settled by the same rules as yours, so a "won" here really did win.
import { DAY, MINUTE } from '@/lib/format';
import { createRng, hashText } from '@/lib/random';
import { potentialPayout } from '@/logic/predictions';
import { STAKE_CHOICES } from '@/logic/rules';

import type { Fan } from '../types';
import { callsForEvent, outcomeFor, viewCall } from './calls';
import { finalState, simulate } from './engines';
import { fanSkill } from './fans';
import {
  fanForm, fanSeasonWins, fanStandings, lockedTier, nextWeekCheckpoint, resolveFan, type Period, type TierId,
} from './ranking';
import { eventsBetween } from './schedule';
import { SEASON_START } from './season';
import { participantsFor } from './world';

export interface FanCall {
  id: string;
  eventId: string;
  eventTitle: string;
  sportId: string;
  question: string;
  pick: string;
  stake: number;
  multiplier: number;
  outcome: 'won' | 'lost' | 'void';
  /** Clout returned: the payout on a win, the stake on a refund, 0 on a loss. */
  payout: number;
  settledAt: number;
}

export interface FanProfile {
  fan: Fan;
  synthetic: boolean;
  tier: TierId;
  standings: { period: Period; rank: number | null; ranked: number; score: number }[];
  winRate: number;
  streak: number;
  bestStreak: number;
  callsMade: number;
  joinedAt: number;
  favoriteTeams: string[];
  recentCalls: FanCall[];
  tiersUpdateAt: number;
}

/** Recent settled Calls on real events from the last two days, newest first. */
export function recentCallsFor(fan: Fan, now: number, limit = 8): FanCall[] {
  const skill = fanSkill(fan.id);
  const metas = eventsBetween(now - 2 * DAY, now - 20 * MINUTE).filter((m) => {
    const roll = hashText(`plays:${fan.id}:${m.id}`) % 100;
    return roll < (m.sportId === fan.favoriteSportId ? 30 : 2);
  });
  const out: FanCall[] = [];
  for (const meta of metas.reverse()) {
    if (out.length >= limit) break;
    const state = simulate(meta, now);
    if (state.status !== 'finished' && state.status !== 'cancelled' && state.status !== 'postponed') continue;
    const calls = callsForEvent(meta).filter((c) => !c.livePriced);
    if (calls.length === 0) continue;
    const rng = createRng(`fancall:${fan.id}:${meta.id}`);
    const call = rng.chance(0.6) ? calls[0] : rng.pick(calls);
    const final = finalState(meta);
    const winning = state.status === 'finished' ? viewCall(call, final, now).winningOptionId : null;
    // Better fans pick the right answer more often; everyone gets it wrong sometimes.
    const others = call.options.filter((o) => o.id !== winning);
    const option = winning && rng.chance(0.38 + skill * 0.4)
      ? call.options.find((o) => o.id === winning) ?? call.options[0]
      : others.length ? rng.pick(others) : call.options[0];
    const outcome = outcomeFor(call, { optionId: option.id }, final);
    const stake = rng.pick(STAKE_CHOICES.slice(0, 2 + Math.round(skill * 3)));
    out.push({
      id: `${fan.id}:${call.id}`,
      eventId: meta.id,
      eventTitle: meta.title,
      sportId: meta.sportId,
      question: call.question,
      pick: option.label,
      stake,
      multiplier: option.multiplier,
      outcome,
      payout: outcome === 'won' ? potentialPayout(stake, option.multiplier) : outcome === 'void' ? stake : 0,
      settledAt: state.status === 'finished' ? final.endsAt : meta.startsAt,
    });
  }
  return out.sort((a, b) => b.settledAt - a.settledAt);
}

/** One or two teams (or athletes) the fan follows in their favourite sport. */
function favoriteTeams(fan: Fan): string[] {
  const field = participantsFor(fan.favoriteSportId);
  if (field.length === 0) return [];
  const rng = createRng(`faves:${fan.id}`);
  // Fans lean towards the stronger sides, like real life.
  const ranked = [...field].sort((a, b) => b.strength - a.strength);
  const pick = () => ranked[Math.floor(Math.pow(rng.next(), 1.6) * ranked.length)].id;
  const first = pick();
  const second = pick();
  return rng.chance(0.45) && second !== first ? [first, second] : [first];
}

export function fanProfile(id: string, now: number): FanProfile | null {
  const fan = resolveFan(id);
  if (!fan) return null;
  const form = fanForm(fan, now);
  const wins = fanSeasonWins(fan, now);
  const rng = createRng(`joined:${fan.id}`);
  const joinedAt = SEASON_START - rng.int(-60, 420) * DAY;
  return {
    fan,
    synthetic: id.startsWith('syn~'),
    tier: lockedTier(fan, now),
    standings: fanStandings(fan, now),
    winRate: form.winRate,
    streak: form.streak,
    bestStreak: form.bestStreak,
    callsMade: Math.round(wins / Math.max(0.2, form.winRate / 100)),
    joinedAt: Math.min(joinedAt, now - 3 * DAY),
    favoriteTeams: favoriteTeams(fan),
    recentCalls: recentCallsFor(fan, now),
    tiersUpdateAt: nextWeekCheckpoint(now),
  };
}
