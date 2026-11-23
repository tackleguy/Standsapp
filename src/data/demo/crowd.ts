// How many fans are in the stands on Stands: watching an event, chatting, and
// rating plays. Smooth, seeded curves so every phone sees the same crowd.
import { MINUTE } from '@/lib/format';
import { createRng, hashText } from '@/lib/random';

import type { EventMeta, EventState } from '../types';
import { competitorById } from './world';

/** Peak crowd for a typical event in each sport. */
const SPORT_PEAK: Record<string, number> = {
  f1: 48_000, soccer: 21_000, cricket: 26_000, basketball: 14_000, rugby_union: 9_000, american_football: 31_000,
  baseball: 6_500, ice_hockey: 5_200, rugby_league: 4_800, aussie_rules: 5_600, tennis: 7_400, golf: 6_200,
  motogp: 12_000, indycar: 7_000, mma: 16_000, boxing: 19_000, cycling: 3_900, netball: 2_600,
};

function basePeak(meta: EventMeta): number {
  const rng = createRng(`crowd:${meta.id}`);
  const peak = SPORT_PEAK[meta.sportId] ?? 4_000;
  // Big clubs and strong fields draw bigger crowds; the main league beats the cup.
  const strengths = meta.competitorIds.slice(0, 6).map((id) => competitorById(id)?.strength ?? 0.5);
  const star = strengths.reduce((a, b) => a + b, 0) / Math.max(1, strengths.length);
  const isMainLeague = meta.competitionId.endsWith('.comp0');
  return peak * (0.45 + star * 0.9) * (isMainLeague ? 1 : 0.7) * rng.float(0.6, 1.35);
}

/** A gentle wobble so the number never sits still. */
function wobble(seed: number, now: number): number {
  const t = now / 1000;
  return 1 + 0.025 * Math.sin(t / 7 + seed) + 0.015 * Math.sin(t / 2.3 + seed * 2) + 0.01 * Math.sin(t / 0.9 + seed * 3);
}

/**
 * People watching this event on Stands right now. Builds before the start,
 * climbs through the game, spikes after big moments, and drains after the end.
 */
export function watchersFor(state: Pick<EventState, 'meta' | 'status' | 'progress' | 'endsAt' | 'plays'>, now: number): number {
  const { meta } = state;
  if (state.status === 'postponed' || state.status === 'cancelled') return 0;
  const peak = basePeak(meta);
  let level: number;
  if (now < meta.startsAt) {
    const minsTo = (meta.startsAt - now) / MINUTE;
    if (minsTo > 120) return Math.round(peak * 0.004 + (hashText(meta.id) % 40));
    level = 0.04 + 0.36 * Math.pow(1 - minsTo / 120, 2);
  } else if (now < state.endsAt) {
    // Rises through the game and peaks in the closing stages.
    level = 0.45 + 0.55 * Math.sin(Math.min(1, state.progress * 1.12) * Math.PI / 2);
  } else {
    const minsAfter = (now - state.endsAt) / MINUTE;
    level = Math.max(0.02, 0.6 * Math.exp(-minsAfter / 12));
  }
  // Fresh big moments pull people in.
  let spike = 0;
  for (let i = state.plays.length - 1; i >= 0 && i >= state.plays.length - 6; i--) {
    const p = state.plays[i];
    const minsAgo = (now - p.at) / MINUTE;
    if (p.importance === 3 && minsAgo >= 0 && minsAgo < 6) spike += 0.18 * Math.exp(-minsAgo / 2.2);
  }
  return Math.max(3, Math.round(peak * level * (1 + spike) * wobble(hashText(meta.id) % 100, now)));
}

/** Of those watching, how many are in the chat. */
export function chattersFor(watchers: number): number {
  return Math.max(1, Math.round(watchers * 0.085));
}

/** "18.4K", "912" */
export function crowdLabel(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

/**
 * How the Stands crowd has called it so far: how many fans made the call and the
 * share on each option. Shares follow the odds (favourites draw more picks), with
 * a seeded lean so every call has its own personality.
 */
export function callCrowd(
  call: { id: string; opensAt: number; closesAt: number; options: { id: string; multiplier: number }[] },
  sportId: string,
  now: number,
): { total: number; shares: Record<string, number> } {
  const rng = createRng(`callcrowd:${call.id}`);
  const peak = (SPORT_PEAK[sportId] ?? 4_000) * 0.12 * rng.float(0.45, 1.5);
  const span = Math.max(1, call.closesAt - call.opensAt);
  const frac = Math.min(1, Math.max(0, (now - call.opensAt) / span));
  const total = now < call.opensAt ? 0 : Math.round(peak * (0.06 + 0.94 * Math.sqrt(frac)) * wobble(hashText(call.id) % 50, now / 20));
  const weights = call.options.map((o) => Math.pow(1 / Math.max(1.01, o.multiplier), 0.85) * rng.float(0.75, 1.3));
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => (w / sum) * 100);
  const shares: Record<string, number> = {};
  // Round so the shares add up to exactly 100.
  const floors = raw.map(Math.floor);
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => ({ i, rem: v - Math.floor(v) })).sort((a, b) => b.rem - a.rem);
  for (const { i } of order) { if (left <= 0) break; floors[i]++; left--; }
  call.options.forEach((o, i) => { shares[o.id] = floors[i]; });
  return { total, shares };
}

