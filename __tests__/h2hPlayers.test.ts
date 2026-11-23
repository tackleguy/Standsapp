// Roster players in the two-sided simulator: soccer, basketball, hockey, both
// rugby codes, Aussie rules and netball. Checks who gets credited with what, that
// the feed names the same players, and that adding players changed no score,
// result or play time.
import { finalState, gameStatsFor } from '@/data/demo/engines';
import { h2hGameStats } from '@/data/demo/engines/h2h';
import { H2H_CONFIGS } from '@/data/demo/engines/h2hSports';
import { linesUpTo, pointsOf } from '@/data/demo/players/lines';
import { playerById, rosterFor } from '@/data/demo/players/roster';
import type { GameStats, StatLine } from '@/data/demo/players/types';
import { eventMetaById, eventsForUtcDay } from '@/data/demo/schedule';
import type { EventMeta } from '@/data/types';
import { hashText } from '@/lib/random';

const SPORTS = ['soccer', 'basketball', 'ice_hockey', 'rugby_union', 'rugby_league', 'aussie_rules', 'netball'];
const n = (l: StatLine | undefined, key: string) => l?.[key] ?? 0;

/** Points on the scoreboard from one player's line. */
const SCORE: Record<string, (l: StatLine) => number> = {
  soccer: (l) => n(l, 'g'),
  basketball: (l) => n(l, 'pts'),
  ice_hockey: (l) => n(l, 'g'),
  rugby_union: (l) => 5 * n(l, 't') + 2 * n(l, 'c') + 3 * n(l, 'p') + 3 * n(l, 'dg'),
  rugby_league: (l) => 4 * n(l, 't') + 2 * n(l, 'g') + n(l, 'fg'),
  aussie_rules: (l) => 6 * n(l, 'g') + n(l, 'b'),
  netball: (l) => n(l, 'g') + n(l, 'ss'),
};

const DAYS = [Date.parse('2026-11-21T00:00:00Z'), Date.parse('2026-11-22T00:00:00Z')];
const metas = DAYS.flatMap((d) => eventsForUtcDay(d)).filter((m) => !m.disruption);
const gamesOf = (sportId: string) => metas.filter((m) => m.sportId === sportId);

/** Every credited line in a game, by player, plus each player's side (0 home, 1 away). */
function sides(sportId: string, gs: GameStats) {
  const lines = linesUpTo(sportId, gs.events);
  const sideOf = new Map<string, number>();
  gs.lineups.forEach((l, side) => l.playerIds.forEach((id) => sideOf.set(id, side)));
  return { lines, sideOf };
}

/** Sum a stat over every game, split by the credited players' positions. */
function byPosition(sportId: string, key: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const meta of gamesOf(sportId)) {
    const lines = linesUpTo(sportId, gameStatsFor(meta).events);
    for (const [id, line] of lines) {
      const pos = playerById(id)!.pos;
      if (n(line, key)) out[pos] = (out[pos] ?? 0) + n(line, key);
    }
  }
  return out;
}

const share = (counts: Record<string, number>, positions: string[]) => {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return positions.reduce((a, p) => a + (counts[p] ?? 0), 0) / Math.max(1, total);
};

function playedOvertime(meta: EventMeta): boolean {
  return finalState(meta).plays.some((p) => p.tag === 'PERIOD' && p.clock === 'End of regulation');
}

describe('results are exactly as before players were added', () => {
  // Recorded from the simulator before roster players were wired in (commit
  // 9014e54): score, winner, end time, number of plays and a fingerprint of every
  // play's time, tag, team, score, clock and importance. American football also
  // keeps its exact descriptions (its players move to their own engine).
  const BEFORE: Record<string, [string, string, number, number, number, number?]> = {
    'soccer-2026-11-14-00': ['6-3', 'home', 1794622920000, 47, 1408681387],
    'soccer-2026-11-19-00': ['1-1', 'draw', 1795055220000, 54, 4255696757],
    'soccer-2026-11-14-01': ['1-1', 'draw', 1794626220000, 50, 2100274846],
    'basketball-2026-11-14-00': ['117-93', 'home', 1794623640000, 173, 311730834],
    'basketball-2026-11-19-00': ['115-110', 'home', 1795055640000, 162, 3116953582],
    'basketball-2026-11-14-11': ['121-122', 'away', 1794677400000, 180, 139336276],
    'basketball-2026-11-18-06': ['122-125', 'away', 1794999000000, 182, 1062347136],
    'ice_hockey-2026-11-14-00': ['3-2', 'home', 1794622560000, 44, 1509741247],
    'ice_hockey-2026-11-19-00': ['6-2', 'home', 1795054560000, 72, 2026385180],
    'ice_hockey-2026-11-15-01': ['2-2', 'home', 1794713760000, 59, 887153900],
    'ice_hockey-2026-11-17-01': ['3-2', 'home', 1794886059036, 56, 1329074867],
    'ice_hockey-2026-11-23-01': ['3-3', 'home', 1795404960000, 60, 3043174293],
    'rugby_union-2026-11-14-00': ['53-14', 'home', 1794624960000, 62, 2953725094],
    'rugby_union-2026-11-19-00': ['12-18', 'away', 1795056960000, 55, 74373155],
    'rugby_union-2026-11-16-08': ['38-38', 'draw', 1794831960000, 77, 4118253056],
    'rugby_league-2026-11-14-00': ['38-18', 'home', 1794645960000, 64, 3975908096],
    'rugby_league-2026-11-19-00': ['6-17', 'away', 1795077960000, 56, 3505423614],
    'aussie_rules-2026-11-14-00': ['75-74', 'home', 1794633960000, 67, 813211799],
    'aussie_rules-2026-11-19-00': ['118-61', 'home', 1795065960000, 74, 171640678],
    'aussie_rules-2026-11-17-02': ['98-98', 'draw', 1794912960000, 64, 2642163164],
    'netball-2026-11-14-00': ['62-56', 'home', 1794641160000, 64, 1105407842],
    'netball-2026-11-19-00': ['65-69', 'away', 1795073160000, 76, 3410645817],
    'american_football-2026-11-14-00': ['34-10', 'home', 1794628200000, 90, 1994008218, 2384155254],
    'american_football-2026-11-19-00': ['27-7', 'home', 1795060200000, 84, 93046232, 2417326527],
  };

  it.each(Object.keys(BEFORE))('%s', (id) => {
    const meta = eventMetaById(id);
    expect(meta).toBeDefined();
    const f = finalState(meta!);
    const [score, winner, endsAt, plays, playsHash, descHash] = BEFORE[id];
    expect(f.entries.map((e) => e.score).join('-')).toBe(score);
    expect(f.facts.winner).toBe(winner);
    expect(f.endsAt).toBe(endsAt);
    expect(f.plays.length).toBe(plays);
    const fingerprint = f.plays.map((p) => `${p.at}|${p.tag}|${p.competitorId}|${p.scoreAfter}|${p.clock}|${p.importance}`).join('\n');
    expect(hashText(fingerprint)).toBe(playsHash);
    if (descHash !== undefined) expect(hashText(f.plays.map((p) => p.description).join('\n'))).toBe(descHash);
  });

  it('leaves American football to its own engine', () => {
    const meta = metas.find((m) => m.sportId === 'american_football')!;
    expect(h2hGameStats(meta).events).toEqual([]);
    expect(finalState(meta).plays.some((p) => p.playerIds)).toBe(false);
  });
});

describe.each(SPORTS)('%s players', (sportId) => {
  const games = gamesOf(sportId);
  const cfg = H2H_CONFIGS[sportId];

  it('has games to check', () => {
    expect(games.length).toBeGreaterThan(3);
  });

  it('credits every point on the scoreboard to a player on that team', () => {
    for (const meta of games) {
      const gs = gameStatsFor(meta);
      const lines = linesUpTo(sportId, gs.events);
      const final = finalState(meta);
      gs.lineups.forEach((lineup, side) => {
        const credited = lineup.playerIds.reduce((a, id) => a + SCORE[sportId](lines.get(id) ?? {}), 0);
        expect(credited).toBe(final.entries[side].score);
      });
    }
  });

  it('names the credited players in the feed and credits them at that moment', () => {
    for (const meta of games) {
      const gs = gameStatsFor(meta);
      const final = finalState(meta);
      const at = new Map<number, Set<string>>();
      for (const e of gs.events) at.set(e.at, (at.get(e.at) ?? new Set()).add(e.playerId));
      for (const p of final.plays) {
        expect(p.description).not.toMatch(/[{}]|\s{2}|\s[.,!]/);
        if (!p.playerIds?.length) continue;
        expect(p.playerRoles?.length).toBe(p.playerIds.length);
        expect(p.headline).toBeTruthy();
        for (const id of p.playerIds) expect(p.description).toContain(playerById(id)!.short);
        // Plays that change the score credit the scorer right then.
        if (p.scoreAfter !== null && p.competitorId) {
          const scorer = p.playerIds.find((id) => playerById(id)!.sideId === p.competitorId);
          expect(scorer && at.get(p.at)?.has(scorer)).toBe(true);
        }
      }
    }
  });

  it('keeps every description to the sport\'s own commentary lines', () => {
    const templates = [
      ...cfg.scoring.flatMap((s) => [...s.templates, ...(s.follow ? [...s.follow.templates, ...s.follow.missTemplates] : [])]),
      ...cfg.flavor.flatMap((f) => f.templates), ...(cfg.detail ?? []).flatMap((f) => f.templates),
      'Clutch! {player} wins it at the death for {team}!', '{team} reshuffle: {player} pushes further forward.',
    ];
    const escape = (s: string) => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
    const patterns = templates.map((t) => new RegExp(`^${escape(t).replace(/\{\w+\}/g, '.+?')}( .+)?$`));
    for (const meta of games.slice(0, 4)) {
      for (const p of finalState(meta).plays) {
        if (!p.playerIds?.length) continue;
        expect(patterns.some((re) => re.test(p.description))).toBe(true);
      }
    }
  });

  it('uses the periods actually played', () => {
    for (const meta of games) {
      const expected = cfg.periods.map((p) => p.short);
      if (playedOvertime(meta)) expected.push('OT');
      expect(gameStatsFor(meta).periods).toEqual(expected);
    }
  });

  it('starts the first-choice players and only brings on bench players', () => {
    for (const meta of games) {
      const gs = gameStatsFor(meta);
      gs.lineups.forEach((lineup) => {
        const ids = new Set(lineup.playerIds);
        const roster = rosterFor(lineup.competitorId);
        for (const p of roster) if (p.depth === 1) expect(ids.has(p.id)).toBe(true);
        expect(ids.size).toBeLessThanOrEqual(roster.length);
      });
    }
  });

  it('is the same every time', () => {
    const meta = games[0];
    const first = JSON.stringify({ stats: gameStatsFor(meta), plays: finalState(meta).plays });
    expect(JSON.stringify(h2hGameStats(meta))).toBe(JSON.stringify(gameStatsFor(meta)));
    let again = '';
    jest.isolateModules(() => {
      // A fresh copy of every module, so nothing comes from a cache.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const engines = require('@/data/demo/engines') as typeof import('@/data/demo/engines');
      again = JSON.stringify({ stats: engines.gameStatsFor(meta), plays: engines.finalState(meta).plays });
    });
    expect(again).toBe(first);
  });

  it('scores fantasy points in a sensible range', () => {
    const starters: number[] = [];
    const best: number[] = [];
    for (const meta of games) {
      const gs = gameStatsFor(meta);
      const lines = linesUpTo(sportId, gs.events);
      const pts = gs.lineups.flatMap((l) => l.playerIds).map((id) => {
        const p = pointsOf(sportId, lines.get(id) ?? {});
        if (playerById(id)!.depth === 1) starters.push(p);
        return p;
      });
      best.push(Math.max(...pts));
    }
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(starters)).toBeGreaterThan(6);
    expect(avg(starters)).toBeLessThan(16);
    expect(avg(best)).toBeGreaterThan(14);
    expect(avg(best)).toBeLessThan(45);
  });
});

describe('overtime and shootouts', () => {
  const credited = (sportId: string, meta: EventMeta) => {
    const gs = gameStatsFor(meta);
    const { lines } = sides(sportId, gs);
    return gs.lineups.map((l) => l.playerIds.reduce((a, id) => a + SCORE[sportId](lines.get(id) ?? {}), 0));
  };

  it('credits basketball overtime points and minutes', () => {
    const meta = eventMetaById('basketball-2026-11-14-11')!;
    const gs = gameStatsFor(meta);
    expect(gs.periods).toEqual(['Q1', 'Q2', 'Q3', 'Q4', 'OT']);
    expect(credited('basketball', meta)).toEqual(finalState(meta).entries.map((e) => e.score));
    const { lines } = sides('basketball', gs);
    for (const l of gs.lineups) expect(l.playerIds.reduce((a, id) => a + n(lines.get(id), 'min'), 0)).toBe(265);
    expect(gs.events.some((e) => e.period === 4)).toBe(true);
  });

  it('credits a sudden-death hockey winner and the shootout goalie', () => {
    const golden = eventMetaById('ice_hockey-2026-11-17-01')!;
    expect(gameStatsFor(golden).periods).toEqual(['P1', 'P2', 'P3', 'OT']);
    expect(credited('ice_hockey', golden)).toEqual(finalState(golden).entries.map((e) => e.score));
    const winner = finalState(golden).plays.filter((p) => p.tag === 'GOAL').pop()!;
    expect(winner.period).toBe(3);
    expect(winner.impact).toBeGreaterThan(7);

    const shootout = eventMetaById('ice_hockey-2026-11-23-01')!;
    const gs = gameStatsFor(shootout);
    const { lines } = sides('ice_hockey', gs);
    const final = finalState(shootout);
    gs.lineups.forEach((l, side) => {
      const goalie = l.playerIds.find((id) => playerById(id)!.pos === 'G')!;
      expect(n(lines.get(goalie), 'w')).toBe(final.entries[side].isWinner ? 1 : 0);
    });
    expect(gs.events[gs.events.length - 1].at).toBeLessThanOrEqual(final.endsAt);
  });
});

describe('who does what', () => {
  it('soccer: keepers make every save, forwards and midfielders score most goals', () => {
    expect(Object.keys(byPosition('soccer', 'sv'))).toEqual(['GK']);
    expect(share(byPosition('soccer', 'g'), ['FW', 'MF'])).toBeGreaterThan(0.8);
    expect(byPosition('soccer', 'a').GK ?? 0).toBe(0);
  });

  it('soccer: minutes, appearances and clean sheets add up', () => {
    for (const meta of gamesOf('soccer')) {
      const gs = gameStatsFor(meta);
      const { lines, sideOf } = sides('soccer', gs);
      const final = finalState(meta);
      const reds = final.plays.filter((p) => p.tag === 'RED');
      gs.lineups.forEach((lineup, side) => {
        const minutes = lineup.playerIds.reduce((a, id) => a + n(lines.get(id), 'min'), 0);
        const red = reds.filter((p) => p.competitorId === lineup.competitorId).length;
        expect(minutes).toBeLessThanOrEqual(11 * 90 + 2);
        expect(minutes).toBeGreaterThanOrEqual(11 * 90 - red * 90 - 2);
        for (const id of lineup.playerIds) expect(n(lines.get(id), 'app')).toBe(1);
        const conceded = final.entries[1 - side].score;
        for (const [id, line] of lines) if (sideOf.get(id) === side && n(line, 'cs')) expect(conceded === 0 || n(line, 'min') < 90).toBe(true);
      });
    }
  });

  it('basketball: a full rotation plays every minute, centers rebound, guards pass', () => {
    for (const meta of gamesOf('basketball')) {
      const gs = gameStatsFor(meta);
      const lines = linesUpTo('basketball', gs.events);
      const total = 240 + (playedOvertime(meta) ? 25 : 0);
      for (const lineup of gs.lineups) {
        expect(lineup.playerIds.reduce((a, id) => a + n(lines.get(id), 'min'), 0)).toBe(total);
        const sum = (k: string) => lineup.playerIds.reduce((a, id) => a + n(lines.get(id), k), 0);
        expect(sum('ast')).toBeLessThanOrEqual(sum('fgm'));
        expect(sum('fgm')).toBeLessThanOrEqual(sum('fga'));
        expect(sum('tpm')).toBeLessThanOrEqual(sum('tpa'));
        expect(sum('ftm')).toBeLessThanOrEqual(sum('fta'));
      }
    }
    const reb = byPosition('basketball', 'reb');
    const ast = byPosition('basketball', 'ast');
    expect(reb.C).toBeGreaterThan(reb.PG * 2);
    expect(ast.PG).toBeGreaterThan(ast.C * 2);
  });

  it('hockey: the starting goalie makes every save and gets the win', () => {
    expect(Object.keys(byPosition('ice_hockey', 'sv'))).toEqual(['G']);
    expect(share(byPosition('ice_hockey', 'g'), ['C', 'LW', 'RW'])).toBeGreaterThan(0.7);
    for (const meta of gamesOf('ice_hockey')) {
      const gs = gameStatsFor(meta);
      const lines = linesUpTo('ice_hockey', gs.events);
      const final = finalState(meta);
      gs.lineups.forEach((lineup, side) => {
        const goalies = lineup.playerIds.filter((id) => playerById(id)!.pos === 'G');
        expect(goalies).toHaveLength(1);
        expect(n(lines.get(goalies[0]), 'w')).toBe(final.entries[side].isWinner ? 1 : 0);
        expect(n(lines.get(goalies[0]), 'ga')).toBe(final.entries[1 - side].score);
      });
    }
  });

  it('rugby union: backs score most tries, forwards make most tackles', () => {
    expect(share(byPosition('rugby_union', 't'), ['WG', 'CE', 'FB', 'FH', 'SH'])).toBeGreaterThan(0.5);
    expect(share(byPosition('rugby_union', 'tkl'), ['PR', 'HK', 'LK', 'FL', 'N8'])).toBeGreaterThan(0.55);
  });

  it('rugby league: halves and the fullback set up most tries', () => {
    expect(share(byPosition('rugby_league', 'ta'), ['HB', 'FE', 'FB', 'HK'])).toBeGreaterThan(0.6);
    expect(share(byPosition('rugby_league', 'tkl'), ['PR', 'HK', 'SR', 'LK'])).toBeGreaterThan(0.6);
  });

  it('Aussie rules: rucks win the hitouts, forwards kick most goals', () => {
    expect(share(byPosition('aussie_rules', 'ho'), ['RUC'])).toBeGreaterThan(0.7);
    expect(share(byPosition('aussie_rules', 'g'), ['FWD'])).toBeGreaterThan(0.5);
  });

  it('netball: only the shooters score, defenders take most intercepts', () => {
    expect(Object.keys(byPosition('netball', 'g')).sort()).toEqual(['GA', 'GS']);
    expect(share(byPosition('netball', 'int'), ['GK', 'GD', 'WD'])).toBeGreaterThan(0.6);
  });
});
