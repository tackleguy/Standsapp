// Simulated fans who fill chats, Sections, and leaderboards in the preview season.
// They are invented; the app says so once, on Today and in Settings.
import { SPORTS } from '@/config/sports';
import { createRng, hashText } from '@/lib/random';

import type { Fan } from '../types';
import { FAN_WORDS_A, FAN_WORDS_B, FIRST_NAMES, SURNAMES } from './names';

/** Named fans who chat, run Sections, and fill the top of the leaderboards. */
export const FAN_COUNT = 260;
/** The first fans ever generated; Section memberships are drawn from these so they never shift. */
export const ORIGINAL_FAN_COUNT = 90;

function buildFans(): Fan[] {
  const rng = createRng('fans:v1');
  const used = new Set<string>();
  const fans: Fan[] = [];
  for (let i = 0; i < FAN_COUNT; i++) {
    let username = '';
    do {
      const style = rng.int(0, 2);
      const a = rng.pick(FAN_WORDS_A);
      const b = rng.pick(FAN_WORDS_B);
      username = style === 0 ? `${a}_${b}` : style === 1 ? `${a}${b}${rng.int(1, 99)}` : `the_${a}_${b}`;
    } while (used.has(username) || username.length > 20);
    used.add(username);
    const first = rng.pick(FIRST_NAMES);
    fans.push({
      id: `fan_${i}`,
      username,
      displayName: `${first} ${rng.pick(SURNAMES)[0]}.`,
      avatarSeed: `fan-${i}-${username}`,
      favoriteSportId: rng.pick(SPORTS.filter((s) => s.launchWave === 1 || rng.chance(0.3))).id,
    });
  }
  return fans;
}

export const FANS: Fan[] = buildFans();
const byId = new Map(FANS.map((f) => [f.id, f]));

export function fanById(id: string): Fan | undefined {
  return byId.get(id);
}

/** Fans who would plausibly be in the chat for a given sport. */
export function fansForSport(sportId: string): Fan[] {
  const keen = FANS.filter((f) => f.favoriteSportId === sportId);
  const others = FANS.filter((f) => f.favoriteSportId !== sportId).slice(0, 30);
  return [...keen, ...others];
}

/** How good each fan is at Calls (affects the leaderboard). */
export function fanSkill(id: string): number {
  return createRng(`skill:${id}`).float(0.2, 1);
}

/** How often a fan plays Calls, 0.3 (now and then) to 1 (every game). */
export function fanActivity(id: string): number {
  return createRng(`activity:${id}`).float(0.3, 1);
}

const HANDLE_TAILS = ['fc', 'hq', 'szn', 'xi', 'tv', 'live', 'pod', 'zone', 'club', 'nation'] as const;

/**
 * A believable fan made from a seed (used for the long tail of the leaderboards,
 * beyond the named fans). Same seed, same fan, on every phone.
 */
export function syntheticFan(seed: string, id: string): Fan {
  const rng = createRng(`synthetic:${seed}`);
  const first = rng.pick(FIRST_NAMES);
  const last = rng.pick(SURNAMES);
  const style = rng.int(0, 4);
  const username = (style === 0 ? `${first}${last.slice(0, 4)}${rng.int(1, 99)}`
    : style === 1 ? `${rng.pick(FAN_WORDS_A)}_${rng.pick(FAN_WORDS_B)}${rng.int(1, 9)}`
      : style === 2 ? `${first}_${rng.pick(HANDLE_TAILS)}`
        : style === 3 ? `${rng.pick(FAN_WORDS_A)}${last.slice(0, 3)}`
          : `${first[0]}${last}${rng.int(10, 99)}`).toLowerCase().slice(0, 20);
  return {
    id,
    username,
    displayName: rng.chance(0.3) ? `${first} ${last}` : `${first} ${last[0]}.`,
    avatarSeed: `syn-${hashText(seed)}`,
    favoriteSportId: rng.pick(SPORTS.filter((s) => s.launchWave === 1 || rng.chance(0.35))).id,
  };
}
