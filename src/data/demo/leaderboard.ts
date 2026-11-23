// Weekly Clout-won totals for simulated fans: a thin view over the ranking model,
// kept so older callers see the same numbers as the leaderboards.
import { FANS } from './fans';
import { fanScore } from './ranking';

/** Rolling 7-day Clout won, matching the server's weekly leaderboard rule. */
export function fanWeeklyCloutWon(fanId: string, now: number): number {
  const fan = FANS.find((f) => f.id === fanId);
  return fan ? fanScore(fan, 'week', null, now) : 0;
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
    cloutWon: fanScore(f, 'week', null, now), isMe: false,
  }));
}
