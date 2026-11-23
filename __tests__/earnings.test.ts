import { buildBoard, fanScore, myCardEarnings } from '@/data/demo/ranking';
import { FANS } from '@/data/demo/fans';
import { SEASON_START } from '@/data/demo/season';
import { dailyEarnings, earningsSummary, periodStart, recentEarnings, topEarners } from '@/logic/earnings';

const NOW = Date.parse('2026-11-23T18:00:00Z');
const H = 3_600_000;
const row = (reason: string, amount: number, hoursAgo: number, ref: string | null = null) =>
  ({ id: `${reason}-${hoursAgo}-${amount}`, currency: 'tix' as const, amount, reason, at: NOW - hoursAgo * H, ref });

const LEDGER = [
  row('card_win', 4, 1, 'c1'), row('card_win', 10, 3, 'c2'), row('card_fantasy', 23, 5, 'c3'), row('card_fantasy', 7, 30, 'c3'),
  row('set_reward', 200, 50, 'soccer'), row('quick_sell', 6, 2, 'c8,c9'), row('pack_standard', -25, 6, 'p1'),
  row('player_card', -40, 7, 'c3'), row('gate_check', 11, 4), row('card_win', 2, 24 * 9, 'c1'),
  { id: 'clout', currency: 'clout' as const, amount: 500, reason: 'prediction_win', at: NOW - H, ref: 'p9' },
];

describe('card earnings', () => {
  it('adds up what cards earned, sold for, and cost in a period', () => {
    const s = earningsSummary(LEDGER, periodStart('week', NOW, SEASON_START), NOW);
    expect(s.bySource).toEqual({ card_win: 14, card_fantasy: 30, set_reward: 200, quick_sell: 6 });
    expect(s.earned).toBe(244);
    expect(s.spent).toBe(65);
    expect(s.net).toBe(244 + 6 - 65);
    expect(s.payouts).toBe(5);
    // The Gate Check bonus and Clout never count as card earnings.
    expect(earningsSummary(LEDGER, periodStart('today', NOW, SEASON_START), NOW).earned).toBe(37);
  });

  it('splits the last seven days by UTC day, oldest first', () => {
    const days = dailyEarnings(LEDGER, NOW, 7);
    expect(days).toHaveLength(7);
    expect(days[6].total).toBe(37);
    expect(days.reduce((a, d) => a + d.total, 0)).toBe(244);
  });

  it('ranks the top-earning cards and lists recent payouts newest first', () => {
    expect(topEarners(LEDGER, 0, NOW, 2)).toEqual([{ cardId: 'c3', total: 30, payouts: 2 }, { cardId: 'c2', total: 10, payouts: 1 }]);
    const recent = recentEarnings(LEDGER, 3);
    expect(recent.map((r) => r.reason)).toEqual(['card_win', 'quick_sell', 'card_win']);
  });

  it('feeds your own score on the card earnings leaderboard', () => {
    expect(myCardEarnings(LEDGER, 'week', NOW)).toBe(244);
    expect(myCardEarnings(LEDGER, 'today', NOW)).toBe(37);
  });
});

describe('card earnings leaderboard', () => {
  it('ranks fans by Tix earned, separately from Clout', () => {
    const tix = buildBoard('week', { kind: 'global' }, NOW, null, 'tix');
    const clout = buildBoard('week', { kind: 'global' }, NOW, null);
    expect(tix.metric).toBe('tix');
    expect(tix.top.length).toBeGreaterThan(10);
    for (let i = 1; i < tix.top.length; i++) expect(tix.top[i - 1].score).toBeGreaterThanOrEqual(tix.top[i].score);
    expect(tix.top[0].cards).toBeGreaterThan(0);
    expect(clout.top[0].cards).toBeNull();
    // Fewer people collect cards than make Calls, and tiers stay on the Clout board.
    expect(tix.ranked).toBeLessThan(clout.ranked);
    expect(tix.next).toBeNull();
    // Card earnings are smaller numbers than Clout won.
    expect(tix.top[0].score).toBeLessThan(clout.top[0].score);
  });

  it('is the same on every phone and places you by your own earnings', () => {
    const fan = FANS[5];
    expect(fanScore(fan, 'season', null, NOW, 'tix')).toBe(fanScore(fan, 'season', null, NOW, 'tix'));
    const me = { username: 'me', displayName: 'Me', avatarSeed: 'me', favoriteSportId: null, score: 244, refScore: 100,
      checkpointScore: 0, winRate: 0, streak: 0, cards: 30 };
    const board = buildBoard('week', { kind: 'global' }, NOW, me, 'tix');
    expect(board.me?.rank).not.toBeNull();
    expect(board.me?.cards).toBe(30);
    const nobody = buildBoard('week', { kind: 'global' }, NOW, { ...me, score: 0 }, 'tix');
    expect(nobody.me?.rank).toBeNull();
  });
});
