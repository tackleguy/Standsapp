// Baseball and cricket players: every box score adds up to the real score, the
// feed names the players who were credited, and adding players changed no result.
import { finalState, gameStatsFor, simulate } from '@/data/demo/engines';
import { linesUpTo } from '@/data/demo/players/lines';
import { playerById } from '@/data/demo/players/roster';
import type { GameStats, StatLine } from '@/data/demo/players/types';
import { eventsForUtcDay } from '@/data/demo/schedule';
import type { EventMeta, EventState, StatsSection } from '@/data/types';
import { hashText } from '@/lib/random';

const DAY = 86_400_000;
const DAYS = Array.from({ length: 7 }, (_, i) => Date.parse('2026-11-18T00:00:00Z') + i * DAY);
const metas = DAYS.flatMap((d) => eventsForUtcDay(d)).filter((m) => !m.disruption);
const baseball = metas.filter((m) => m.sportId === 'baseball');
const cricket = metas.filter((m) => m.sportId === 'cricket');

/** Each side's players' stats added together, up to a moment. */
function sideTotals(meta: EventMeta, upTo = Number.MAX_SAFE_INTEGER): StatLine[] {
  const gs = gameStatsFor(meta);
  const lines = linesUpTo(meta.sportId, gs.events, upTo);
  return gs.lineups.map((l) => {
    const sum: StatLine = {};
    for (const id of l.playerIds) {
      const line = lines.get(id) ?? {};
      for (const k of Object.keys(line)) sum[k] = (sum[k] ?? 0) + line[k];
    }
    return sum;
  });
}

const n = (l: StatLine, k: string) => l[k] ?? 0;

/** The stat events for one player at exactly one moment, added up. */
function creditedAt(gs: GameStats, playerId: string, at: number): StatLine {
  const out: StatLine = {};
  for (const e of gs.events) {
    if (e.at !== at || e.playerId !== playerId) continue;
    for (const k of Object.keys(e.stats)) out[k] = (out[k] ?? 0) + e.stats[k];
  }
  return out;
}

function table(state: EventState, title: string) {
  return state.stats.find((s): s is Extract<StatsSection, { type: 'table' }> => s.type === 'table' && s.title === title);
}

function compare(state: EventState, label: string) {
  for (const s of state.stats) {
    if (s.type !== 'compare') continue;
    const item = s.items.find((i) => i.label === label);
    if (item) return item;
  }
  throw new Error(`No ${label}`);
}

/** Line score row cells for a side (0 home, 1 away): [..., R, H, E]. */
function lineScore(state: EventState, side: number) {
  const row = table(state, 'Line score')!.rows.find((r) => r.key === (side === 0 ? 'home' : 'away'))!;
  const c = row.cells;
  return { r: Number(c[c.length - 3]), h: Number(c[c.length - 2]) };
}

describe('baseball players', () => {
  it('has games to check', () => {
    expect(baseball.length).toBeGreaterThan(20);
  });

  it('adds up to the line score: runs, hits, home runs and strikeouts', () => {
    for (const meta of baseball) {
      const f = finalState(meta);
      const sides = sideTotals(meta);
      sides.forEach((mine, side) => {
        const theirs = sides[1 - side];
        const label = side === 0 ? 'home' : 'away';
        expect(n(mine, 'r')).toBe(f.entries[side].score);
        expect(n(mine, 'r')).toBe(lineScore(f, side).r);
        expect(n(mine, 'h')).toBe(lineScore(f, side).h);
        expect(n(mine, 'b1') + n(mine, 'b2') + n(mine, 'b3') + n(mine, 'hr')).toBe(n(mine, 'h'));
        expect(n(mine, 'hr')).toBe(compare(f, 'Home runs')[label]);
        expect(n(mine, 'kp')).toBe(compare(f, 'Strikeouts (pitching)')[label]);
        // What the hitters did is what the other side's pitchers allowed.
        expect(n(mine, 'h')).toBe(n(theirs, 'ha'));
        expect(n(mine, 'bb')).toBe(n(theirs, 'bba'));
        expect(n(mine, 'so')).toBe(n(theirs, 'kp'));
        expect(n(mine, 'rbi')).toBeLessThanOrEqual(n(mine, 'r'));
        expect(n(theirs, 'er')).toBeLessThanOrEqual(n(mine, 'r'));
        // Three outs an inning (the side that loses on a walk-off may not finish its last one).
        const walkOffLoser = /walk-off/.test(f.resultText ?? '') && side === 1;
        if (!walkOffLoser) expect(n(mine, 'outs') % 3).toBe(0);
        expect(n(mine, 'outs')).toBeGreaterThanOrEqual(24);
      });
      // One winning pitcher, from the winning side; saves only for the winners, never to the same pitcher.
      const winner = f.entries.findIndex((e) => e.isWinner);
      expect(n(sides[winner], 'w')).toBe(1);
      expect(n(sides[1 - winner], 'w') + n(sides[1 - winner], 'sv')).toBe(0);
      const lines = linesUpTo('baseball', gameStatsFor(meta).events);
      for (const [id, line] of lines) {
        expect(n(line, 'w') + n(line, 'sv')).toBeLessThanOrEqual(1);
        const pos = playerById(id)?.pos ?? '';
        if (n(line, 'w') || n(line, 'sv') || n(line, 'kp')) expect(['SP', 'RP']).toContain(pos);
      }
    }
  });

  it('matches the scoreboard at every moment of the game', () => {
    for (const meta of baseball.slice(0, 8)) {
      const end = finalState(meta).endsAt;
      for (let i = 0; i <= 12; i++) {
        const now = meta.startsAt + ((end - meta.startsAt) * i) / 12;
        const state = simulate(meta, now);
        const sides = sideTotals(meta, now);
        sides.forEach((mine, side) => {
          expect(n(mine, 'r')).toBe(state.entries[side].score ?? 0);
          if (state.progress > 0) {
            expect(n(mine, 'h')).toBe(lineScore(state, side).h);
            expect(n(mine, 'kp')).toBe(compare(state, 'Strikeouts (pitching)')[side === 0 ? 'home' : 'away']);
          }
        });
      }
    }
  });

  it('names the credited players in every big play, at that moment', () => {
    let checked = 0;
    for (const meta of baseball) {
      const gs = gameStatsFor(meta);
      for (const p of finalState(meta).plays) {
        if (!p.playerIds?.length) continue;
        expect(p.playerIds.length).toBe(p.playerRoles?.length);
        for (const id of p.playerIds) expect(p.description).toContain(playerById(id)!.short);
        const [first, second] = p.playerIds;
        if (p.tag === 'HR' || p.tag === 'RUN' || p.tag === 'WALKOFF') {
          const bat = creditedAt(gs, first, p.at);
          expect(n(bat, 'rbi') + n(bat, 'r')).toBeGreaterThan(0);
          if (p.tag === 'HR') expect(n(bat, 'hr')).toBe(1);
          expect(Object.keys(creditedAt(gs, second, p.at)).length).toBeGreaterThan(0); // the pitcher
          expect(p.headline).toBeTruthy();
          checked++;
        } else if (p.tag === 'K' && p.headline !== 'Strikeouts' && p.headline !== 'Walk-off loss') {
          expect(n(creditedAt(gs, first, p.at), 'kp')).toBe(1);
          expect(n(creditedAt(gs, second, p.at), 'so')).toBe(1);
          checked++;
        } else if (p.tag === 'DP' && p.headline === 'Double play') {
          expect(n(creditedAt(gs, first, p.at), 'outs')).toBe(2);
          expect(n(creditedAt(gs, second, p.at), 'ab')).toBe(1);
          checked++;
        }
        if (p.period !== undefined && /^(Top|Bot) (\d+)/.test(p.clock)) {
          expect(p.period).toBe(Number(/(\d+)/.exec(p.clock)![1]) - 1);
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('has a batting order of nine and a pitching staff, inning by inning', () => {
    for (const meta of baseball) {
      const gs = gameStatsFor(meta);
      expect(gs.periods.slice(0, 9)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
      for (const l of gs.lineups) {
        const pos = l.playerIds.map((id) => playerById(id)!.pos);
        expect(pos.slice(0, 9).every((x) => x !== 'SP' && x !== 'RP')).toBe(true);
        expect(pos[9]).toBe('SP');
      }
    }
  });
});

describe('cricket players', () => {
  it('has games to check', () => {
    expect(cricket.length).toBeGreaterThan(20);
  });

  it('adds up to each innings: batters plus extras, bowlers, wickets and balls', () => {
    for (const meta of cricket) {
      const f = finalState(meta);
      const sides = sideTotals(meta);
      const firstSide = f.facts.battingFirst === 'home' ? 0 : 1;
      const extrasNotes = f.stats.filter((s) => s.type === 'note' && s.title === 'Extras and run rate');
      const extras = [0, 0];
      extrasNotes.forEach((s, i) => {
        const side = i === 0 ? firstSide : 1 - firstSide;
        extras[side] = Number(/Extras (\d+)/.exec((s as { text: string }).text)![1]);
      });
      sides.forEach((mine, side) => {
        const theirs = sides[1 - side];
        const total = f.entries[side].score ?? 0;
        const text = f.entries[side].scoreText ?? '';
        const wickets = /all out/.test(text) ? 10 : Number(/\/(\d+)/.exec(text)?.[1] ?? 0);
        const [, ov, ball] = /\((\d+)\.(\d) ov\)/.exec(text)!;
        // Batters' runs plus extras (wides) make the total; the bowlers conceded all of it.
        expect(n(mine, 'runs') + extras[side]).toBe(total);
        expect(n(theirs, 'rc')).toBe(total);
        // Every dismissal is a batter out; bowlers get all but the run outs.
        expect(n(mine, 'out')).toBe(wickets);
        expect(n(theirs, 'wkts') + n(theirs, 'ro')).toBe(wickets);
        expect(n(theirs, 'ct') + n(theirs, 'st') + n(theirs, 'ro')).toBeLessThanOrEqual(wickets);
        // Every legal ball was faced by a batter and bowled by a bowler.
        expect(n(mine, 'balls')).toBe(Number(ov) * 6 + Number(ball));
        expect(n(theirs, 'bb')).toBe(n(mine, 'balls'));
      });
      expect(n(sides[0], 'sixes') + n(sides[1], 'sixes')).toBe(f.facts.totalSixes);
      // T20: nobody bowls more than four overs, and a playing XI each.
      const lines = linesUpTo('cricket', gameStatsFor(meta).events);
      for (const [, line] of lines) expect(n(line, 'bb')).toBeLessThanOrEqual(24);
      for (const l of gameStatsFor(meta).lineups) expect(l.playerIds).toHaveLength(11);
    }
  });

  it('matches the scoreboard at every moment of the match', () => {
    for (const meta of cricket.slice(0, 8)) {
      const end = finalState(meta).endsAt;
      for (let i = 0; i <= 12; i++) {
        const now = meta.startsAt + ((end - meta.startsAt) * i) / 12;
        const state = simulate(meta, now);
        const sides = sideTotals(meta, now);
        sides.forEach((_, side) => {
          expect(n(sides[1 - side], 'rc')).toBe(state.entries[side].score ?? 0);
        });
      }
    }
  });

  it('names the credited players in every boundary and wicket, at that moment', () => {
    let checked = 0;
    for (const meta of cricket) {
      const gs = gameStatsFor(meta);
      for (const p of finalState(meta).plays) {
        if (!p.playerIds?.length) continue;
        expect(p.playerIds.length).toBe(p.playerRoles?.length);
        for (const id of p.playerIds) expect(p.description).toContain(playerById(id)!.short);
        if (p.tag === 'SIX' || p.tag === 'FOUR') {
          expect(n(creditedAt(gs, p.playerIds[0], p.at), p.tag === 'SIX' ? 'sixes' : 'fours')).toBe(1);
          expect(n(creditedAt(gs, p.playerIds[1], p.at), 'rc')).toBe(p.tag === 'SIX' ? 6 : 4);
          checked++;
        } else if (p.tag === 'WICKET') {
          const roles = p.playerRoles ?? [];
          const batter = p.playerIds[roles.indexOf('bat')];
          expect(n(creditedAt(gs, batter, p.at), 'out')).toBe(1);
          if (roles.includes('bowl')) expect(n(creditedAt(gs, p.playerIds[roles.indexOf('bowl')], p.at), 'wkts')).toBe(1);
          if (roles.includes('field')) {
            const f = creditedAt(gs, p.playerIds[roles.indexOf('field')], p.at);
            expect(n(f, 'ct') + n(f, 'st') + n(f, 'ro')).toBe(1);
          }
          checked++;
        } else if (p.tag === 'FIFTY') {
          expect(n(linesUpTo('cricket', gs.events, p.at).get(p.playerIds[0]) ?? {}, 'runs')).toBeGreaterThanOrEqual(50);
        }
      }
    }
    expect(checked).toBeGreaterThan(500);
  });
});

describe('determinism', () => {
  it('builds the same players, stats and feed on every phone', () => {
    const sample = [...baseball.slice(0, 4), ...cricket.slice(0, 4)];
    const freshRun = () => {
      let out: string[] = [];
      jest.isolateModules(() => {
        const engines = jest.requireActual<typeof import('@/data/demo/engines')>('@/data/demo/engines');
        out = sample.map((m) => JSON.stringify([engines.gameStatsFor(m), engines.finalState(m).plays]));
      });
      return out;
    };
    const a = freshRun();
    const b = freshRun();
    expect(a).toEqual(b);
    expect(a).toEqual(sample.map((m) => JSON.stringify([gameStatsFor(m), finalState(m).plays])));
  });
});

/** Everything that decides a score, a result or a Call, with player names left out. */
function fingerprint(meta: EventMeta): number {
  const f = finalState(meta);
  const mids = [0.25, 0.5, 0.75].map((x) => simulate(meta, meta.startsAt + meta.durationMs * x));
  const numbers = f.stats.map((s) => (s.type === 'table'
    ? [s.title, s.rows.map((r) => r.cells.slice(meta.sportId === 'cricket' ? 1 : 0))]
    : s.type === 'compare' ? [s.title, s.items] : [s.title, s.text]));
  return hashText(JSON.stringify([
    f.endsAt, f.resultText, f.facts,
    f.entries.map((e) => [e.score, e.scoreText, e.isWinner]),
    f.plays.map((p) => [p.at, p.clock, p.tag, p.importance, p.competitorId, p.scoreAfter]),
    mids.map((s) => [s.status, s.periodLabel, s.entries.map((e) => [e.score, e.scoreText, e.note])]),
    numbers,
  ]));
}

// Recorded from the simulators before players were added (commit 9014e54): scores,
// results, Call facts, play times and tags, live scoreboards and the final box score
// numbers must all stay exactly the same.
const BEFORE_PLAYERS: [string, string, number][] = [
  ['baseball-2026-11-18-00', 'Coral Coast Spikes won 3-2 (walk-off)', 1906075440],
  ['baseball-2026-11-18-01', 'Saltmarsh Cardinals Club won 4-3', 2624169230],
  ['baseball-2026-11-18-02', 'Thornbury Grays won 5-4', 2236219810],
  ['baseball-2026-11-18-03', 'Kingsmead Owls won 6-1', 3303357464],
  ['baseball-2026-11-18-04', 'Westbrook Barons won 9-4', 3734939033],
  ['baseball-2026-11-19-00', 'Hollowmere Engineers won 10-4', 642739739],
  ['baseball-2026-11-19-01', 'Stonehaven Drillers won 8-5', 721922120],
  ['baseball-2026-11-19-02', 'Copperfield Mariners won 3-2', 1831180556],
  ['baseball-2026-11-19-03', 'Riverton Skippers won 4-3', 1950662336],
  ['baseball-2026-11-19-04', 'Oakhurst Canaries won 5-1', 1019254387],
  ['baseball-2026-11-20-00', 'Westbrook Barons won 5-3', 1269844636],
  ['baseball-2026-11-20-01', 'Kingsmead Owls won 6-2', 117917691],
  ['baseball-2026-11-20-02', 'Coral Coast Spikes won 5-4', 2487057923],
  ['baseball-2026-11-20-03', 'Saltmarsh Cardinals Club won 6-5', 4132434647],
  ['baseball-2026-11-20-04', 'Stonehaven Drillers won 7-5', 1187150653],
  ['baseball-2026-11-21-00', 'Oakhurst Canaries won 3-2', 1028219729],
  ['baseball-2026-11-21-01', 'Westbrook Barons won 6-3', 2160110725],
  ['baseball-2026-11-21-02', 'Blackwater Clippers won 10-1', 386229484],
  ['baseball-2026-11-21-03', 'Kingsmead Owls won 5-4 (walk-off)', 433521447],
  ['baseball-2026-11-21-04', 'Saltmarsh Cardinals Club won 2-0', 322546672],
  ['baseball-2026-11-22-00', 'Coral Coast Spikes won 4-3', 3816758708],
  ['baseball-2026-11-22-01', 'Oakhurst Canaries won 4-3', 2747716655],
  ['baseball-2026-11-22-02', 'Westbrook Barons won 5-1', 3043686004],
  ['baseball-2026-11-22-03', 'Blackwater Clippers won 9-8', 606566697],
  ['baseball-2026-11-22-04', 'Kingsmead Owls won 3-2 (walk-off)', 539415447],
  ['baseball-2026-11-23-00', 'Mistral Bay Sox won 7-6 (walk-off)', 1137223498],
  ['baseball-2026-11-23-01', 'Hollowmere Engineers won 5-2', 3200004222],
  ['baseball-2026-11-23-02', 'Saltmarsh Cardinals Club won 3-1', 79433981],
  ['baseball-2026-11-23-03', 'Coral Coast Spikes won 2-0', 1379257324],
  ['baseball-2026-11-23-04', 'Bramblewick Pioneers won 2-1', 505519311],
  ['baseball-2026-11-24-00', 'Kingsmead Owls won 7-3', 3693406454],
  ['baseball-2026-11-24-01', 'Copperfield Mariners won 5-4 (walk-off)', 3220597089],
  ['baseball-2026-11-24-02', 'Mistral Bay Sox won 5-4 (walk-off)', 3508950178],
  ['baseball-2026-11-24-03', 'Oakhurst Canaries won 9-4', 68857077],
  ['baseball-2026-11-24-04', 'Westbrook Barons won 6-4', 648227941],
  ['cricket-2026-11-18-00', 'Cobalt Sound Stars won by 6 wickets', 3485268528],
  ['cricket-2026-11-18-01', 'Tidewater Strikers won by 7 wickets', 3454560024],
  ['cricket-2026-11-18-02', 'Hollowmere Warriors won by 5 wickets', 4245934717],
  ['cricket-2026-11-18-03', 'Glenmore Titans won by 25 runs', 541399972],
  ['cricket-2026-11-18-04', 'Windmere Royals won by 8 wickets', 951726911],
  ['cricket-2026-11-18-05', 'Ashford Vale Giants won by 12 runs', 3681047784],
  ['cricket-2026-11-18-06', 'Highveld Hurricanes won by 4 wickets', 3281244807],
  ['cricket-2026-11-18-07', 'Orchard Reach Falcons won by 23 runs', 2046434565],
  ['cricket-2026-11-18-08', 'Saltmarsh Knights won by 26 runs', 3082760062],
  ['cricket-2026-11-18-09', 'Cedar Point Chargers won by 5 wickets', 650036368],
  ['cricket-2026-11-18-10', 'Glenmore Titans won by 7 wickets', 3131028351],
  ['cricket-2026-11-18-11', 'Cobalt Sound Stars won by 10 wickets', 1497462321],
  ['cricket-2026-11-18-12', 'Silverlake Kings won by 8 wickets', 2804610474],
  ['cricket-2026-11-19-00', 'Orchard Reach Falcons won by 35 runs', 2647919163],
  ['cricket-2026-11-19-01', 'Granite Falls Sixers won by 5 wickets', 3969537263],
  ['cricket-2026-11-19-02', 'Ashford Vale Giants won by 8 wickets', 3475470396],
  ['cricket-2026-11-19-03', 'Cobalt Sound Stars won by 35 runs', 803328423],
  ['cricket-2026-11-19-05', 'Silverlake Kings won by 8 wickets', 4236798974],
  ['cricket-2026-11-19-06', 'Orchard Reach Falcons won by 44 runs', 1370051240],
  ['cricket-2026-11-19-07', 'Saltmarsh Knights won by 4 wickets', 324393545],
  ['cricket-2026-11-19-08', 'Cobalt Sound Stars won by 64 runs', 1476789722],
  ['cricket-2026-11-19-09', 'Highveld Hurricanes won by 19 runs', 4058716731],
  ['cricket-2026-11-19-10', 'Silverlake Kings won by 3 wickets', 777931138],
  ['cricket-2026-11-19-11', 'Glenmore Titans won by 6 runs', 946619924],
  ['cricket-2026-11-19-12', 'Ashford Vale Giants won by 9 runs', 4092837273],
  ['cricket-2026-11-19-13', 'Cobalt Sound Stars won by 28 runs', 1566411988],
  ['cricket-2026-11-20-00', 'Saltmarsh Knights won by 2 wickets', 2068300154],
  ['cricket-2026-11-20-01', 'Silverlake Kings won by 82 runs', 1050150842],
  ['cricket-2026-11-20-02', 'Windmere Royals won by 5 runs', 1170030867],
  ['cricket-2026-11-20-03', 'Glenmore Titans won by 53 runs', 3780927813],
  ['cricket-2026-11-20-04', 'Orchard Reach Falcons won by 22 runs', 4213201745],
  ['cricket-2026-11-20-05', 'Ashford Vale Giants won by 44 runs', 189350787],
  ['cricket-2026-11-20-06', 'Cedar Point Chargers won by 5 runs', 2121692120],
  ['cricket-2026-11-20-07', 'Saltmarsh Knights won by 35 runs', 3197707765],
  ['cricket-2026-11-20-08', 'Glenmore Titans won by 102 runs', 3393689700],
  ['cricket-2026-11-20-09', 'Hollowmere Warriors won by 6 wickets', 2138542167],
  ['cricket-2026-11-20-10', 'Orchard Reach Falcons won by 6 wickets', 2802970142],
  ['cricket-2026-11-20-11', 'Silverlake Kings won by 32 runs', 1395587837],
  ['cricket-2026-11-20-12', 'Ashford Vale Giants won by 10 runs', 3342302517],
  ['cricket-2026-11-20-13', 'Glenmore Titans won by 46 runs', 2577188177],
];

describe('results are unchanged by adding players', () => {
  const byId = new Map(metas.map((m) => [m.id, m]));
  it.each(BEFORE_PLAYERS)('%s: %s', (id, result, expected) => {
    const meta = byId.get(id)!;
    expect(finalState(meta).resultText).toBe(result);
    expect(fingerprint(meta)).toBe(expected);
  });
});
