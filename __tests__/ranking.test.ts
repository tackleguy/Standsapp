import { recentCallsFor, fanProfile } from '@/data/demo/fanProfile';
import { FANS, ORIGINAL_FAN_COUNT, syntheticFan } from '@/data/demo/fans';
import {
  buildBoard, countdown, fanScore, myScore, nextWeekCheckpoint, rankedPlayers, resolveFan, tierFor, totalPlayers,
  weekCheckpoint, TOP_COUNT, type MeInput,
} from '@/data/demo/ranking';
import { DEMO_SECTIONS } from '@/data/demo/sections';

const NOW = Date.parse('2026-11-23T15:20:00Z'); // a Monday afternoon
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function me(score: number, refScore = score): MeInput {
  return { username: 'me', displayName: 'Me', avatarSeed: 'me', favoriteSportId: 'soccer', score, refScore,
    checkpointScore: 0, winRate: 50, streak: 0 };
}

describe('ranking model', () => {
  it('keeps the original fans identical while growing the pool', () => {
    expect(FANS.length).toBeGreaterThanOrEqual(200);
    expect(FANS[0].id).toBe('fan_0');
    expect(new Set(FANS.map((f) => f.username)).size).toBe(FANS.length);
    // Section members only ever come from the original fans.
    for (const s of DEMO_SECTIONS) for (const id of s.memberIds) expect(Number(id.split('_')[1])).toBeLessThan(ORIGINAL_FAN_COUNT);
  });

  it('is deterministic', () => {
    const a = buildBoard('week', { kind: 'global' }, NOW, me(250));
    const b = buildBoard('week', { kind: 'global' }, NOW, me(250));
    expect(a).toEqual(b);
    expect(syntheticFan('x', 'x')).toEqual(syntheticFan('x', 'x'));
  });

  it('has a big, slowly growing population', () => {
    const players = totalPlayers(NOW);
    expect(players).toBeGreaterThan(40_000);
    expect(players).toBeLessThan(70_000);
    expect(totalPlayers(NOW + DAY)).toBeGreaterThanOrEqual(players);
    expect(rankedPlayers('today', null, NOW)).toBeLessThan(rankedPlayers('week', null, NOW));
    expect(rankedPlayers('week', null, NOW)).toBeLessThan(rankedPlayers('season', null, NOW));
  });

  it('ranks the named top in order with consecutive ranks', () => {
    const board = buildBoard('week', { kind: 'global' }, NOW, null);
    expect(board.top.length).toBeLessThanOrEqual(TOP_COUNT);
    board.top.forEach((e, i) => {
      expect(e.rank).toBe(i + 1);
      if (i > 0) expect(board.top[i - 1].score).toBeGreaterThanOrEqual(e.score);
    });
  });

  it('turns higher scores into better ranks (monotonic)', () => {
    let last = Infinity;
    for (const score of [5, 40, 120, 300, 700, 1500, 3000, 6000, 20000]) {
      const rank = buildBoard('week', { kind: 'global' }, NOW, me(score)).me?.rank ?? Infinity;
      expect(rank).toBeLessThanOrEqual(last);
      last = rank;
    }
    expect(last).toBe(1);
    expect(buildBoard('week', { kind: 'global' }, NOW, me(0)).me?.rank).toBeNull();
  });

  it('puts fans around you when you are outside the top', () => {
    const board = buildBoard('week', { kind: 'global' }, NOW, me(150));
    const mine = board.me!;
    expect(mine.rank).toBeGreaterThan(TOP_COUNT);
    expect(board.around.some((e) => e.isMe)).toBe(true);
    const ranks = board.around.map((e) => e.rank ?? 0);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    for (const e of board.around) {
      if ((e.rank ?? 0) < mine.rank!) expect(e.score).toBeGreaterThanOrEqual(mine.score);
      if ((e.rank ?? 0) > mine.rank!) expect(e.score).toBeLessThanOrEqual(mine.score);
      if (!e.isMe) expect(resolveFan(e.id)?.username).toBe(e.username);
    }
    expect(board.next).not.toBeNull();
    expect(board.next!.score).toBeGreaterThan(0);
  });

  it('keeps a fan from "around you" at the same rank on their profile', () => {
    const board = buildBoard('week', { kind: 'global' }, NOW, me(150));
    const neighbour = board.around.find((e) => !e.isMe)!;
    const week = fanProfile(neighbour.id, NOW)!.standings.find((s) => s.period === 'week')!;
    expect(Math.abs((week.rank ?? 0) - (neighbour.rank ?? 0))).toBeLessThanOrEqual(2);
    expect(Math.abs(week.score - neighbour.score)).toBeLessThanOrEqual(2);
  });

  it('inserts you into the top when you are good enough', () => {
    const board = buildBoard('week', { kind: 'global' }, NOW, me(50_000));
    expect(board.top[0].isMe).toBe(true);
    expect(board.top.map((e) => e.rank)).toEqual(board.top.map((_, i) => i + 1));
  });

  it('gives tiers by percentile', () => {
    expect(tierFor(1, 10_000)).toBe('legend');
    expect(tierFor(200, 10_000)).toBe('diamond');
    expect(tierFor(900, 10_000)).toBe('platinum');
    expect(tierFor(2_000, 10_000)).toBe('gold');
    expect(tierFor(4_000, 10_000)).toBe('silver');
    expect(tierFor(9_000, 10_000)).toBe('bronze');
    expect(tierFor(null, 10_000)).toBe('bronze');
  });

  it('measures movement and marks newcomers', () => {
    const climbed = buildBoard('week', { kind: 'global' }, NOW, me(900, 300)).me!;
    expect(typeof climbed.movement === 'number' && climbed.movement > 0).toBe(true);
    expect(buildBoard('week', { kind: 'global' }, NOW, me(300, 0)).me!.movement).toBe('new');
  });

  it('ticks fans up smoothly through the day', () => {
    const fan = FANS.find((f) => fanScore(f, 'today', null, NOW) > 0)!;
    let prev = 0;
    for (let t = NOW - 6 * HOUR; t <= NOW; t += 60_000) {
      const s = fanScore(fan, 'today', null, t);
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
  });

  it('ranks a group exactly, including you', () => {
    const ids = FANS.slice(0, 8).map((f) => f.id);
    const board = buildBoard('season', { kind: 'group', fanIds: ids }, NOW, me(1));
    expect(board.top).toHaveLength(9);
    expect(board.top.some((e) => e.isMe)).toBe(true);
  });

  it('scores you with the same rule as the weekly total', () => {
    const ledger = [
      { id: 'a', currency: 'clout' as const, amount: 120, reason: 'prediction_win', at: NOW - 2 * HOUR, ref: 'p1' },
      { id: 'b', currency: 'clout' as const, amount: 80, reason: 'prediction_win', at: NOW - 3 * DAY, ref: 'p2' },
      { id: 'c', currency: 'clout' as const, amount: 999, reason: 'prediction_win', at: NOW - 9 * DAY, ref: 'p3' },
      { id: 'd', currency: 'clout' as const, amount: -50, reason: 'prediction', at: NOW - HOUR, ref: 'p1' },
    ];
    const preds = [{ id: 'p1', sportId: 'soccer' }, { id: 'p2', sportId: 'f1' }, { id: 'p3', sportId: 'soccer' }];
    // Same as weeklyCloutWon in the store: wins in the last 7 days.
    expect(myScore(ledger, preds, 'week', null, NOW)).toBe(200);
    expect(myScore(ledger, preds, 'today', null, NOW)).toBe(120);
    expect(myScore(ledger, preds, 'season', 'soccer', NOW)).toBe(1119);
  });

  it('locks tiers on Mondays and counts down', () => {
    expect(new Date(weekCheckpoint(NOW)).toISOString()).toBe('2026-11-23T00:00:00.000Z');
    expect(new Date(nextWeekCheckpoint(NOW)).toISOString()).toBe('2026-11-30T00:00:00.000Z');
    expect(countdown(2 * DAY + 14 * HOUR + 5 * 60_000)).toBe('2d 14h');
    expect(countdown(5 * HOUR + 12 * 60_000)).toBe('5h 12m');
  });

  it('builds fan profiles from real settled Calls', () => {
    const profile = fanProfile(FANS[3].id, NOW)!;
    expect(profile.standings).toHaveLength(3);
    expect(profile.favoriteTeams.length).toBeGreaterThan(0);
    const calls = recentCallsFor(FANS[3], NOW, 8);
    for (const c of calls) {
      expect(['won', 'lost', 'void']).toContain(c.outcome);
      if (c.outcome === 'won') expect(c.payout).toBeGreaterThanOrEqual(c.stake);
      if (c.outcome === 'lost') expect(c.payout).toBe(0);
    }
    expect(fanProfile('syn~week~global~12345', NOW)?.synthetic).toBe(true);
    expect(fanProfile('nobody', NOW)).toBeNull();
  });

  it('is fast enough for a phone', () => {
    const t0 = Date.now();
    for (let i = 0; i < 5; i++) buildBoard('season', { kind: 'global' }, NOW + i * 20_000, me(400));
    for (let i = 0; i < 5; i++) buildBoard('today', { kind: 'sport', sportId: 'soccer' }, NOW + i * 20_000, me(40));
    expect(Date.now() - t0).toBeLessThan(4000);
  });
});
