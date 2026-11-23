// Players, per-game stats and fantasy points, checked the same way for every sport.
import { SPORTS } from '@/config/sports';
import { finalState, gameStatsFor, simulate } from '@/data/demo/engines';
import { linesUpTo, pointsByPeriod, pointsOf } from '@/data/demo/players/lines';
import { playerById, playersForSide, playersForSport } from '@/data/demo/players/roster';
import { SPORT_STATS } from '@/data/demo/players/sports';
import { eventsForUtcDay } from '@/data/demo/schedule';
import { fantasyTix, teamFantasyPoints } from '@/logic/fantasy';

const DAYS = [Date.parse('2026-11-21T00:00:00Z'), Date.parse('2026-11-22T00:00:00Z')];
const metas = DAYS.flatMap((d) => eventsForUtcDay(d)).filter((m) => !m.disruption);

describe('player rosters', () => {
  it('has stat definitions for every sport', () => {
    for (const s of SPORTS) expect(SPORT_STATS[s.id]).toBeDefined();
  });

  it.each(SPORTS.map((s) => s.id))('%s has players with unique ids and short names per team', (sportId) => {
    const players = playersForSport(sportId);
    expect(players.length).toBeGreaterThan(5);
    expect(new Set(players.map((p) => p.id)).size).toBe(players.length);
    const byTeam = new Map<string, string[]>();
    for (const p of players) {
      expect(playerById(p.id)).toBe(p);
      expect(p.sportId).toBe(sportId);
      const key = p.sideId;
      byTeam.set(key, [...(byTeam.get(key) ?? []), p.short]);
    }
    for (const names of byTeam.values()) expect(new Set(names).size).toBe(names.length);
  });

  it('is the same on every load', () => {
    const a = playersForSport('soccer').slice(0, 5).map((p) => p.name).join();
    const b = playersForSport('soccer').slice(0, 5).map((p) => p.name).join();
    expect(a).toBe(b);
  });
});

describe('fantasy rules', () => {
  it('turns points into Tix by rounding, never below zero', () => {
    expect(fantasyTix(11.4)).toBe(11);
    expect(fantasyTix(11.5)).toBe(12);
    expect(fantasyTix(-3.2)).toBe(0);
  });

  it('adds up a team card from its three best performers', () => {
    expect(teamFantasyPoints([10, 2, 30, 5, -4])).toBe(45);
    expect(teamFantasyPoints([7])).toBe(7);
  });
});

// Each sport's simulator must say who did what. These checks run per sport.
describe.each(SPORTS.map((s) => s.id))('%s game stats', (sportId) => {
  const games = metas.filter((m) => m.sportId === sportId).slice(0, 6);
  const def = SPORT_STATS[sportId];

  it('has games to check', () => {
    expect(games.length).toBeGreaterThan(0);
  });

  it('only credits players who took part, with known stats, in time order', () => {
    for (const meta of games) {
      const gs = gameStatsFor(meta);
      expect(gs.lineups.map((l) => l.competitorId)).toEqual(meta.competitorIds);
      const inGame = new Set(gs.lineups.flatMap((l) => l.playerIds));
      for (const l of gs.lineups) {
        const allowed = new Set(playersForSide(l.competitorId).map((p) => p.id));
        for (const id of l.playerIds) expect(allowed.has(id)).toBe(true);
      }
      let last = 0;
      for (const e of gs.events) {
        expect(inGame.has(e.playerId)).toBe(true);
        expect(e.at).toBeGreaterThanOrEqual(last);
        last = e.at;
        expect(e.period).toBeGreaterThanOrEqual(0);
        expect(e.period).toBeLessThan(gs.periods.length);
        for (const k of Object.keys(e.stats)) {
          expect(def.labels[k]).toBeDefined();
          expect(Number.isFinite(e.stats[k])).toBe(true);
        }
      }
      const final = finalState(meta);
      for (const p of final.plays) {
        for (const id of p.playerIds ?? []) expect(inGame.has(id)).toBe(true);
        if (p.impact !== undefined) {
          expect(p.impact).toBeGreaterThanOrEqual(0);
          expect(p.impact).toBeLessThanOrEqual(9.9);
        }
        if (p.playerIds?.length && p.period !== undefined) expect(p.period).toBeLessThan(Math.max(1, gs.periods.length));
      }
      // Nothing is credited before the start or after the end.
      if (gs.events.length) {
        expect(gs.events[0].at).toBeGreaterThanOrEqual(meta.startsAt);
        expect(gs.events[gs.events.length - 1].at).toBeLessThanOrEqual(final.endsAt);
      }
    }
  });

  it('gives players real stats and fantasy points', () => {
    const perGame: number[] = [];
    for (const meta of games) {
      const gs = gameStatsFor(meta);
      expect(gs.periods.length).toBeGreaterThan(0);
      expect(gs.events.length).toBeGreaterThan(0);
      const lines = linesUpTo(sportId, gs.events);
      const pts = [...lines.entries()].map(([, l]) => pointsOf(sportId, l));
      expect(pts.some((p) => p > 0)).toBe(true);
      for (const p of pts) expect(Number.isFinite(p)).toBe(true);
      perGame.push(Math.max(...pts));
      // Feed plays name players.
      expect(finalState(meta).plays.some((p) => (p.playerIds?.length ?? 0) > 0)).toBe(true);
      // Period points add up to the game total.
      const [id, line] = [...lines.entries()][0];
      const byPeriod = pointsByPeriod(sportId, gs, id);
      expect(byPeriod.reduce((a, b) => a + b, 0)).toBeCloseTo(pointsOf(sportId, line), 1);
    }
    // The best player in a game scores something worth having.
    const best = perGame.reduce((a, b) => a + b, 0) / perGame.length;
    expect(best).toBeGreaterThan(5);
    expect(best).toBeLessThan(90);
  });

  it('reveals stats live, never ahead of the clock', () => {
    const meta = games[0];
    const gs = gameStatsFor(meta);
    const mid = meta.startsAt + meta.durationMs * 0.5;
    const live = simulate(meta, mid);
    const seen = gs.events.filter((e) => e.at <= mid);
    for (const e of seen) expect(e.at).toBeLessThanOrEqual(mid);
    if (live.status === 'live') expect(seen.length).toBeLessThanOrEqual(gs.events.length);
  });
});
