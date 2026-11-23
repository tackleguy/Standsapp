import { eventWinProbability, winProbabilitySeries } from '@/data/demo/liveExtras';
import { finalState, liveClock, simulate } from '@/data/demo/engines';
import { H2H_CONFIGS } from '@/data/demo/engines/h2hSports';
import { eventsForUtcDay } from '@/data/demo/schedule';
import {
  asPercents, cricketBattingFirstWins, inPlayProbability, normalCdf, parseInnings, pregameProbability, tennisProbability,
} from '@/logic/winProbability';

const sum = (p: { home: number; draw: number; away: number }) => p.home + p.draw + p.away;
const DAY = Date.parse('2026-11-23T00:00:00Z');

describe('win probability maths', () => {
  it('has a sane normal curve', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 5);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3);
  });

  it('favours the stronger side before the start, with draws only where they happen', () => {
    const soccer = pregameProbability('soccer', 0.85, 0.35);
    expect(sum(soccer)).toBeCloseTo(1, 6);
    expect(soccer.home).toBeGreaterThan(soccer.away);
    expect(soccer.draw).toBeGreaterThan(0.1);
    const hoops = pregameProbability('basketball', 0.35, 0.85);
    expect(hoops.draw).toBe(0);
    expect(hoops.away).toBeGreaterThan(hoops.home);
  });

  it('moves with the score and the clock', () => {
    const base = { sportId: 'soccer', homeStrength: 0.5, awayStrength: 0.5, homeEdge: 0 };
    const level = inPlayProbability({ ...base, lead: 0, remaining: 0.5 });
    const ahead = inPlayProbability({ ...base, lead: 1, remaining: 0.5 });
    const aheadLate = inPlayProbability({ ...base, lead: 1, remaining: 0.05 });
    expect(level.home).toBeCloseTo(level.away, 6);
    expect(ahead.home).toBeGreaterThan(level.home);
    expect(aheadLate.home).toBeGreaterThan(ahead.home);
    expect(inPlayProbability({ ...base, lead: 2, remaining: 0 }).home).toBeCloseTo(1, 6);
    expect(inPlayProbability({ ...base, lead: 0, remaining: 0 }).draw).toBeCloseTo(1, 6);
  });

  it('never leaves a draw in sports that play to a winner', () => {
    const p = inPlayProbability({ sportId: 'ice_hockey', homeStrength: 0.6, awayStrength: 0.4, lead: 0, remaining: 0 });
    expect(p.draw).toBe(0);
    expect(p.home).toBeGreaterThan(0.5);
    expect(sum(p)).toBeCloseTo(1, 6);
    const nba = inPlayProbability({ sportId: 'basketball', homeStrength: 0.5, awayStrength: 0.5, lead: -12, remaining: 0.1 });
    expect(nba.away).toBeGreaterThan(0.9);
  });

  it('handles tennis and cricket', () => {
    expect(tennisProbability(2, 0, 0, 0, 0.5, 0.5).home).toBe(1);
    expect(tennisProbability(1, 0, 3, 1, 0.5, 0.5).home).toBeGreaterThan(0.75);
    expect(parseInnings('165/5 (20.0 ov)')).toEqual({ runs: 165, wickets: 5, balls: 120 });
    expect(parseInnings('98 (17.3 ov)')).toEqual({ runs: 98, wickets: 10, balls: 105 });
    expect(parseInnings('Yet to bat')).toBeNull();
    const first = { runs: 170, wickets: 6, balls: 120 };
    expect(cricketBattingFirstWins(first, { runs: 171, wickets: 3, balls: 100 }, true, 0.5, 0.5)).toBe(0);
    expect(cricketBattingFirstWins(first, { runs: 150, wickets: 4, balls: 120 }, true, 0.5, 0.5)).toBe(1);
    const easy = cricketBattingFirstWins(first, { runs: 150, wickets: 2, balls: 96 }, true, 0.5, 0.5);
    const hard = cricketBattingFirstWins(first, { runs: 120, wickets: 7, balls: 96 }, true, 0.5, 0.5);
    expect(easy).toBeLessThan(hard);
  });

  it('rounds to whole percentages that add up to 100', () => {
    const pct = asPercents({ home: 0.333, draw: 0.333, away: 0.334 }, true);
    expect(pct.home + pct.draw + pct.away).toBe(100);
    const two = asPercents({ home: 0.6, draw: 0, away: 0.4 }, false);
    expect(two).toEqual({ home: 60, draw: 0, away: 40 });
  });
});

describe('win probability on simulated games', () => {
  const metas = eventsForUtcDay(DAY).filter((m) => !m.disruption && m.format !== 'race');

  it('is certain once a game is over and sensible while it is live', () => {
    for (const meta of metas.slice(0, 40)) {
      const fin = finalState(meta);
      const p = eventWinProbability(fin);
      expect(p).not.toBeNull();
      expect(Math.max(p!.home, p!.draw, p!.away)).toBe(1);
      const mid = simulate(meta, meta.startsAt + (fin.endsAt - meta.startsAt) / 2);
      const q = eventWinProbability(mid)!;
      expect(sum(q)).toBeCloseTo(1, 6);
      for (const v of [q.home, q.draw, q.away]) expect(v).toBeGreaterThanOrEqual(0);
    }
  });

  it('builds a history through the game with big moments marked', () => {
    const meta = metas.find((m) => m.sportId === 'soccer')!;
    const fin = finalState(meta);
    const series = winProbabilitySeries(fin, fin.endsAt + 1)!;
    expect(series.points.length).toBeGreaterThan(30);
    for (let i = 1; i < series.points.length; i++) expect(series.points[i].t).toBeGreaterThanOrEqual(series.points[i - 1].t);
    const goals = fin.plays.filter((p) => p.tag === 'GOAL').length;
    expect(series.markers.filter((m) => m.tag === 'GOAL')).toHaveLength(goals);
  });
});

describe('richer play-by-play', () => {
  it('adds minor plays that never carry a score', () => {
    const detailTags = new Set(Object.values(H2H_CONFIGS).flatMap((c) => (c.detail ?? []).map((d) => d.tag)));
    const meta = eventsForUtcDay(DAY).find((m) => m.sportId === 'basketball' && !m.disruption)!;
    const fin = finalState(meta);
    const minor = fin.plays.filter((p) => p.tag !== null && detailTags.has(p.tag));
    expect(minor.length).toBeGreaterThan(30);
    for (const p of minor) expect(p.scoreAfter).toBeNull();
    // The final score is still the sum of the scoring plays.
    const home = fin.entries.find((e) => e.role === 'home')!;
    expect(fin.facts.homeScore).toBe(home.score);
  });

  it('ticks the game clock between refreshes and stops outside the game', () => {
    const meta = eventsForUtcDay(DAY).find((m) => m.sportId === 'basketball' && !m.disruption)!;
    expect(liveClock(meta, meta.startsAt - 1000)).toBeNull();
    const t = meta.startsAt + 5 * 60_000;
    const a = liveClock(meta, t);
    const b = liveClock(meta, t + 4000);
    expect(a).toMatch(/^Q1 \d+:\d\d$/);
    expect(a).not.toBe(b);
    expect(simulate(meta, t).periodLabel).toBe(a);
  });
});
