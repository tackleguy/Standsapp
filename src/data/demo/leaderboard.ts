// Weekly Clout-won totals for simulated fans, rolling over the last seven days.
import { DAY } from '@/lib/format';
import { createRng } from '@/lib/random';

import { FANS, fanSkill } from './fans';

/** Clout a demo fan won from Calls on a given UTC day. */
function dailyWinnings(fanId: string, dayIndex: number): number {
  const rng = createRng(`lb:${fanId}:${dayIndex}`);
  if (!rng.chance(0.62)) return 0;
  const skill = fanSkill(fanId);
  return Math.round(rng.int(20, 900) * skill * (0.6 + rng.next()));
}

/** Rolling 7-day Clout won, matching the server's weekly leaderboard rule. */
export function fanWeeklyCloutWon(fanId: string, now: number): number {
  const today = Math.floor(now / DAY);
  const fractionOfToday = (now - today * DAY) / DAY;
  let total = 0;
  for (let d = today - 6; d <= today; d++) {
    const amount = dailyWinnings(fanId, d);
    total += d === today ? Math.round(amount * fractionOfToday) : amount;
  }
  return total;
}

export interface BoardRow {
  userId: string;
  username: string;
  displayName: string;
  avatarSeed: string;
  cloutWon: number;
  isMe: boolean;
}

export function demoBoard(now: number, fanIds?: string[]): BoardRow[] {
  const ids = fanIds ? new Set(fanIds) : null;
  return FANS.filter((f) => !ids || ids.has(f.id)).map((f) => ({
    userId: f.id, username: f.username, displayName: f.displayName, avatarSeed: f.avatarSeed,
    cloutWon: fanWeeklyCloutWon(f.id, now), isMe: false,
  }));
}
