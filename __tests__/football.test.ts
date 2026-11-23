// The football simulator: real downs, distances and players, and a score that
// always matches its plays and its fantasy stats.
import { finalState, gameStatsFor, simulate } from '@/data/demo/engines';
import { footballSituation, footballTeamNumbers } from '@/data/demo/engines/football';
import { linesUpTo } from '@/data/demo/players/lines';
import { playerById } from '@/data/demo/players/roster';
import { eventsForUtcDay } from '@/data/demo/schedule';
import { getPlayerGame, playLines } from '@/data/playerApi';

const days = [0, 1, 2, 3, 4, 5].map((i) => Date.parse('2026-11-16T00:00:00Z') + i * 86_400_000);
const games = days.flatMap((d) => eventsForUtcDay(d)).filter((m) => m.sportId === 'american_football' && !m.disruption);

describe('football simulator', () => {
  it('has games to check', () => expect(games.length).toBeGreaterThan(10));

  it('scores exactly what its plays say', () => {
    for (const meta of games) {
      const f = finalState(meta);
      for (const [side, id] of meta.competitorIds.entries()) {
        const mine = f.plays.filter((p) => p.competitorId === id);
        const points = mine.filter((p) => p.tag === 'TD').length * 6 + mine.filter((p) => p.tag === 'PAT').length
          + mine.filter((p) => p.tag === 'FG').length * 3 + mine.filter((p) => p.tag === 'SAF').length * 2
          + mine.filter((p) => p.tag === '2PT' && p.scoreAfter).length * 2;
        expect(points).toBe(f.entries[side].score);
      }
      expect(f.entries.some((e) => e.isWinner)).toBe(true);
    }
  });

  it('credits touchdowns, field goals and extra points to the right players', () => {
    for (const meta of games) {
      const f = finalState(meta);
      const lines = linesUpTo('american_football', gameStatsFor(meta).events);
      const sum = (key: string) => [...lines.values()].reduce((a, l) => a + (l[key] ?? 0), 0);
      const tds = f.plays.filter((p) => p.tag === 'TD').length;
      expect(sum('rushTd') + sum('recTd') + sum('defTd')).toBe(tds);
      expect(sum('fg3') + sum('fg4') + sum('fg5')).toBe(f.plays.filter((p) => p.tag === 'FG').length);
      expect(sum('pat')).toBe(f.plays.filter((p) => p.tag === 'PAT').length);
      expect(sum('passCmp')).toBe(sum('rec'));
      expect(sum('passYds')).toBe(sum('recYds'));
    }
  });

  it('keeps every snap on the field with a real down and distance', () => {
    for (const meta of games.slice(0, 6)) {
      for (const p of finalState(meta).plays) {
        const s = p.football;
        if (!s) continue;
        expect(s.yardLine).toBeGreaterThanOrEqual(0);
        expect(s.yardLine).toBeLessThanOrEqual(100);
        if (['run', 'pass', 'sack', 'kneel'].includes(s.kind)) {
          expect(s.down).toBeGreaterThanOrEqual(1);
          expect(s.down).toBeLessThanOrEqual(4);
          expect(s.distance).toBeGreaterThan(0);
          expect(s.personnel).toMatch(/^\d\d$/);
        }
        for (const id of p.playerIds ?? []) expect(playerById(id)).toBeDefined();
      }
    }
  });

  it('looks like real football on average', () => {
    let points = 0;
    let yards = 0;
    for (const meta of games) {
      const f = finalState(meta);
      points += (f.entries[0].score ?? 0) + (f.entries[1].score ?? 0);
      const [h, a] = footballTeamNumbers(meta, f.endsAt);
      yards += h.yards + a.yards;
    }
    const perGame = points / games.length;
    expect(perGame).toBeGreaterThan(32);
    expect(perGame).toBeLessThan(56);
    expect(yards / games.length / 2).toBeGreaterThan(260);
    expect(yards / games.length / 2).toBeLessThan(440);
  });

  it('shows the ball spot and down while live, and nothing before or after', () => {
    const meta = games[0];
    const end = finalState(meta).endsAt;
    expect(footballSituation(meta, meta.startsAt - 1)).toBeNull();
    expect(footballSituation(meta, end + 1)).toBeNull();
    const live = footballSituation(meta, meta.startsAt + 20 * 60_000);
    expect(live).not.toBeNull();
    expect(meta.competitorIds).toContain(live!.offenseId);
  });

  it('is the same every time', () => {
    const meta = games[1];
    const at = meta.startsAt + meta.durationMs * 0.6;
    expect(JSON.stringify(simulate(meta, at).plays.slice(-5))).toBe(JSON.stringify(simulate(meta, at).plays.slice(-5)));
  });
});

describe('player pages and feed lines', () => {
  const meta = games[2];
  const end = finalState(meta).endsAt;

  it('builds a performance whose period points add up to the game total', () => {
    const qb = gameStatsFor(meta).lineups[0].playerIds.find((id) => playerById(id)?.pos === 'QB')!;
    const g = getPlayerGame(qb, meta.id, end + 1)!;
    expect(g.played).toBe(true);
    expect(g.points).toBeGreaterThan(0);
    expect(g.periodPoints.reduce((a, b) => a + b, 0)).toBeCloseTo(g.points, 1);
    expect(g.tix).toBe(Math.max(0, Math.round(g.points)));
    expect(g.plays.length).toBeGreaterThan(5);
    expect(g.headline).toMatch(/yds/);
    expect(getPlayerGame(qb, 'nope', end)).toBeNull();
  });

  it('writes a running line for every player in every play', () => {
    const f = finalState(meta);
    const lines = playLines(meta, f.plays);
    const withPlayers = f.plays.filter((p) => p.playerIds?.length);
    expect(lines.size).toBe(withPlayers.length);
    const catchPlay = withPlayers.find((p) => p.football?.kind === 'pass' && p.playerRoles?.[0] === 'rec')!;
    const [receiver, passer] = lines.get(catchPlay.id)!;
    expect(receiver.text).toMatch(/^\d+ yd, \d+ rec$/);
    expect(passer.text).toMatch(/^-?\d+ yd, \d+\/\d+$/);
  });
});
