// Simulated fans who fill chats, Sections, and leaderboards in the demo.
// They are clearly invented and are labelled as demo fans in the app.
import { SPORTS } from '@/config/sports';
import { createRng } from '@/lib/random';

import type { Fan } from '../types';
import { FAN_WORDS_A, FAN_WORDS_B, FIRST_NAMES, SURNAMES } from './names';

const FAN_COUNT = 90;

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
