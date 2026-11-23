// Tennis, MMA and boxing: the athletes are the players. Their stats must agree
// with the score, the result, the feed and the Stats tab, and crediting them must
// not change any result.
import { finalState, gameStatsFor, simulate } from '@/data/demo/engines';
import { lineOf, linesUpTo, pointsOf } from '@/data/demo/players/lines';
import type { GameStats, StatLine } from '@/data/demo/players/types';
import { eventMetaById, eventsForUtcDay } from '@/data/demo/schedule';
import type { EventMeta, EventState, Play } from '@/data/types';
import { hashText } from '@/lib/random';

const DAY = 86_400_000;
const DAYS = Array.from({ length: 7 }, (_, i) => Date.parse('2026-11-17T00:00:00Z') + i * DAY);
const metas = DAYS.flatMap((d) => eventsForUtcDay(d)).filter((m) => !m.disruption);
const sport = (id: string) => metas.filter((m) => m.sportId === id);
const n = (l: StatLine, key: string) => l[key] ?? 0;

/** One row of a Stats tab comparison, as [home, away]. */
function compare(state: EventState, label: string): [number, number] {
  for (const s of state.stats) {
    if (s.type !== 'compare') continue;
    const item = s.items.find((i) => i.label === label);
    if (item) return [item.home, item.away];
  }
  throw new Error(`No "${label}" in the Stats tab of ${state.meta.id}`);
}

/** Each athlete's line at `upTo`, in meta.competitorIds order. */
function sides(meta: EventMeta, gs: GameStats, upTo?: number): [StatLine, StatLine] {
  return [lineOf(meta.sportId, gs, meta.competitorIds[0], upTo), lineOf(meta.sportId, gs, meta.competitorIds[1], upTo)];
}

/** Games each athlete has on the scoreboard ("6 3 7" -> 16). */
const gamesOnBoard = (state: EventState) =>
  state.entries.map((e) => (e.scoreText ?? '').split(' ').filter(Boolean).reduce((a, v) => a + Number(v), 0));

describe('tennis players', () => {
  const matches = sport('tennis');

  it('has matches to check', () => {
    expect(matches.length).toBeGreaterThan(10);
  });

  it('credits games, breaks, sets and the win to match the final score and Stats tab', () => {
    for (const meta of matches) {
      const final = finalState(meta);
      const gs = gameStatsFor(meta);
      expect(gs.lineups).toEqual(meta.competitorIds.map((id) => ({ competitorId: id, playerIds: [id] })));
      expect(gs.periods).toEqual(Array.from({ length: Number(final.facts.sets) }, (_, i) => `Set ${i + 1}`));
      const lines = sides(meta, gs);
      const games = gamesOnBoard(final);
      const breaks = compare(final, 'Breaks of serve');
      const aces = compare(final, 'Aces');
      const dfs = compare(final, 'Double faults');
      [0, 1].forEach((p) => {
        const l = lines[p];
        expect(n(l, 'gw')).toBe(games[p]);
        expect(n(l, 'gl')).toBe(games[1 - p]);
        expect(n(l, 'sw')).toBe(final.entries[p].score);
        expect(n(l, 'win')).toBe(final.entries[p].isWinner ? 1 : 0);
        expect(n(l, 'brk')).toBe(breaks[p]);
        expect(n(l, 'aces')).toBe(aces[p]);
        expect(n(l, 'df')).toBe(dfs[p]);
      });
      expect(n(lines[0], 'gw') + n(lines[1], 'gw')).toBe(final.facts.totalGames);
    }
  });

  it('credits each game the moment it ends, in the right set, as the scoreboard shows it', () => {
    for (const meta of matches.slice(0, 8)) {
      const gs = gameStatsFor(meta);
      for (const e of gs.events.filter((x) => x.stats.gw || x.stats.sw)) {
        const p = meta.competitorIds.indexOf(e.playerId);
        const board = simulate(meta, e.at);
        const before = simulate(meta, e.at - 1);
        if (e.stats.gw) {
          expect(n(sides(meta, gs, e.at)[p], 'gw')).toBe(gamesOnBoard(board)[p]);
          expect(gamesOnBoard(before)[p]).toBe(gamesOnBoard(board)[p] - 1);
          // The set this game belongs to is the one the scoreboard is in.
          expect(board.entries[p].scoreText?.split(' ').length).toBe(e.period + 1);
        }
        if (e.stats.sw) expect(n(sides(meta, gs, e.at)[p], 'sw')).toBe(board.entries[p].score);
      }
    }
  });

  it('puts aces and double faults inside the athlete\'s own service games, and the feed\'s aces where it says', () => {
    for (const meta of matches) {
      const final = finalState(meta);
      const gs = gameStatsFor(meta);
      const ends = [...new Set(gs.events.filter((e) => e.stats.gw).map((e) => e.at))];
      for (const e of gs.events.filter((x) => x.stats.aces || x.stats.df)) {
        const k = ends.findIndex((at) => at >= e.at);
        expect(k).toBeGreaterThanOrEqual(0);
        if (k > 0) expect(e.at).toBeGreaterThan(ends[k - 1]);
        // Who served that game: the holder, or the one broken. Neither means a tiebreak (both serve).
        const game = final.plays.find((p) => p.at === ends[k] && (p.tag === 'HOLD' || p.tag === 'BREAK'));
        if (game) expect(game.tag === 'HOLD' ? game.playerIds?.[0] : game.playerIds?.[1]).toBe(e.playerId);
      }
      for (const play of final.plays.filter((p) => p.tag === 'HOLD' && /\bace\b/.test(p.description))) {
        expect(gs.events.some((e) => e.at === play.at && e.playerId === play.playerIds?.[0] && e.stats.aces)).toBe(true);
        expect(play.headline).toBe('Ace');
      }
    }
  });

  it('names the athletes in the feed', () => {
    for (const meta of matches) {
      const final = finalState(meta);
      for (const play of final.plays) {
        expect(play.playerIds?.length).toBe(2);
        expect(play.playerRoles?.length).toBe(2);
        expect(play.headline).toBeTruthy();
        expect(play.period).toBeDefined();
        if (play.competitorId) expect(play.playerIds?.[0]).toBe(play.competitorId);
      }
      const last = final.plays[final.plays.length - 1];
      expect(last.tag).toBe('FINAL');
      expect(last.playerIds?.[0]).toBe(meta.competitorIds[final.entries.findIndex((e) => e.isWinner)]);
    }
  });
});

const finishRoundOf = (final: EventState) => {
  const m = / R(\d+)$/.exec(final.entries.find((e) => e.isWinner)?.scoreText ?? '');
  return m ? Number(m[1]) : null;
};

describe.each(['mma', 'boxing'])('%s players', (sportId) => {
  const fights = sport(sportId);
  const mma = sportId === 'mma';
  const strikesLabel = mma ? 'Significant strikes' : 'Punches landed';

  it('has fights to check', () => {
    expect(fights.length).toBeGreaterThan(sportId === 'mma' ? 10 : 5);
  });

  it('credits the engine\'s winner, method and round', () => {
    for (const meta of fights) {
      const final = finalState(meta);
      const gs = gameStatsFor(meta);
      const w = final.entries.findIndex((e) => e.isWinner);
      const [win, lose] = [sides(meta, gs)[w], sides(meta, gs)[1 - w]];
      const finish = final.facts.method !== 'Decision';
      expect(n(win, 'win')).toBe(1);
      expect(n(lose, 'win')).toBe(0);
      expect(n(win, 'fin')).toBe(finish ? 1 : 0);
      expect(n(lose, 'fin')).toBe(0);
      if (finish) expect(gs.periods.length).toBe(finishRoundOf(final));
      expect(n(win, 'r1')).toBe(finish && finishRoundOf(final) === 1 ? 1 : 0);
      expect(n(lose, 'r1')).toBe(0);
      expect(gs.periods).toEqual(Array.from({ length: gs.periods.length }, (_, i) => `R${i + 1}`));
      expect(final.plays.filter((p) => p.tag === 'ROUND').length).toBe(gs.periods.length);
      // The result is credited when the feed announces it.
      const announced = final.plays.find((p) => p.tag === 'FINAL') as Play;
      const credited = gs.events.find((e) => e.stats.win);
      expect(credited?.at).toBe(announced.at);
      expect(credited?.playerId).toBe(announced.playerIds?.[0]);
      if (finish && final.facts.method === 'Submission') expect(n(win, 'sa')).toBeGreaterThan(0);
    }
  });

  it('matches the Stats tab and the feed, live and at the end', () => {
    for (const meta of fights) {
      const final = finalState(meta);
      const gs = gameStatsFor(meta);
      const checkpoints = [
        ...final.plays.filter((p) => p.tag === 'ROUND' || p.tag === 'ROUND_END').map((p) => p.at + 90_000),
        final.endsAt,
      ];
      for (const t of checkpoints) {
        const state = simulate(meta, t);
        const lines = sides(meta, gs, t);
        expect(lines.map((l) => n(l, 'ss'))).toEqual(compare(state, strikesLabel));
        expect(lines.map((l) => n(l, 'kd'))).toEqual(compare(state, 'Knockdowns'));
        if (mma) expect(lines.map((l) => n(l, 'td'))).toEqual(compare(state, 'Takedowns'));
      }
      for (const play of final.plays) {
        const credited = (key: string) => gs.events.some((e) => e.at === play.at && e.playerId === play.playerIds?.[0] && e.stats[key]);
        if (play.tag === 'KNOCKDOWN') expect(credited('kd')).toBe(true);
        if (/takedown… and gets it/.test(play.description)) expect(credited('td')).toBe(true);
        if (/threatens a guillotine/.test(play.description)) expect(credited('sa')).toBe(true);
        if (play.competitorId && play.playerIds) expect(play.playerIds[0]).toBe(play.competitorId);
      }
      if (!mma) for (const e of gs.events) expect(e.stats.td ?? e.stats.sa).toBeUndefined();
    }
  });

  it('only credits action inside the rounds', () => {
    for (const meta of fights) {
      const final = finalState(meta);
      const gs = gameStatsFor(meta);
      const starts = final.plays.filter((p) => p.tag === 'ROUND').map((p) => p.at);
      const ends = final.plays.filter((p) => p.tag === 'ROUND_END').map((p) => p.at);
      const finalPlay = final.plays.find((p) => p.tag === 'FINAL') as Play;
      const roundMin = mma ? 5 : 3;
      // The last round ends at the stoppage, or after its full time on a decision.
      ends.push(final.facts.method === 'Decision' ? starts[starts.length - 1] + roundMin * 60_000 : finalPlay.at);
      for (const e of gs.events) {
        if (e.stats.win) continue;
        expect(e.at).toBeGreaterThan(starts[e.period]);
        expect(e.at).toBeLessThanOrEqual(ends[e.period]);
      }
      for (const play of final.plays.filter((p) => p.playerIds?.length)) {
        expect(play.headline).toBeTruthy();
        expect(play.playerRoles?.length).toBe(play.playerIds?.length);
        expect(play.period).toBeGreaterThanOrEqual(0);
        expect(play.period).toBeLessThan(gs.periods.length);
      }
    }
  });
});

describe('fantasy points', () => {
  it.each([
    ['tennis', 22, 34, 10],
    ['mma', 22, 36, 13],
    ['boxing', 20, 38, 15],
  ])('%s: winners score well, losers a handful', (sportId, winLo, winHi, loseHi) => {
    const winners: number[] = [];
    const losers: number[] = [];
    for (const meta of sport(sportId)) {
      const final = finalState(meta);
      const lines = linesUpTo(sportId, gameStatsFor(meta).events);
      const w = final.entries.findIndex((e) => e.isWinner);
      winners.push(pointsOf(sportId, lines.get(meta.competitorIds[w]) ?? {}));
      losers.push(pointsOf(sportId, lines.get(meta.competitorIds[1 - w]) ?? {}));
    }
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(winners)).toBeGreaterThan(winLo);
    expect(avg(winners)).toBeLessThan(winHi);
    expect(avg(losers)).toBeLessThan(loseHi);
    // The winner nearly always outscores the loser.
    expect(winners.filter((v, i) => v > losers[i]).length).toBeGreaterThanOrEqual(winners.length * 0.9);
  });
});

describe('same on every phone', () => {
  it('builds the same stats and feed from scratch every time', () => {
    const ids = [...sport('tennis').slice(0, 3), ...sport('mma').slice(0, 3), ...sport('boxing').slice(0, 2)].map((m) => m.id);
    const freshRun = () => {
      let out = '';
      jest.isolateModules(() => {
        const engines = jest.requireActual<typeof import('@/data/demo/engines')>('@/data/demo/engines');
        const schedule = jest.requireActual<typeof import('@/data/demo/schedule')>('@/data/demo/schedule');
        out = JSON.stringify(ids.map((id) => {
          const meta = schedule.eventMetaById(id) as EventMeta;
          return [engines.gameStatsFor(meta), engines.finalState(meta).plays, engines.finalState(meta).stats];
        }));
      });
      return out;
    };
    const a = freshRun();
    expect(a.length).toBeGreaterThan(1000);
    expect(freshRun()).toBe(a);
  });
});

// Recorded before athletes were credited (commit 9014e54): result text, facts,
// end time, scoreboard, number of plays and a fingerprint of every play's time,
// clock, tag, importance, competitor, score and text. Then the Stats tab totals
// that must still be the same: tennis aces and double faults (home, away), and
// fight strikes (home, away).
const BEFORE: [string, string, Record<string, unknown>, number, string, number, number, number[]][] = [
  ['tennis-2026-11-20-00', 'Yara Lindqvist won 2-1', { winner: 'home', sets: 3, totalGames: 24 }, 1795144244345, '2|6 3 6|true,1|1 6 2|false', 29, 191400682, [12, 10, 6, 1]],
  ['tennis-2026-11-20-08', 'Felix Vantongeren won 2-1', { winner: 'away', sets: 3, totalGames: 29 }, 1795180034871, '1|6 4 3|false,2|4 6 6|true', 34, 1366693544, [12, 12, 4, 6]],
  ['tennis-2026-11-20-16', 'Elias Kingsley won 2-0', { winner: 'away', sets: 2, totalGames: 16 }, 1795208595280, '0|1 3|false,2|6 6|true', 19, 2656217081, [6, 7, 2, 2]],
  ['tennis-2026-11-21-04', 'Pablo Achterberg won 2-0', { winner: 'away', sets: 2, totalGames: 26 }, 1795245955919, '0|6 6|false,2|7 7|true', 29, 1470109775, [10, 12, 4, 6]],
  ['tennis-2026-11-21-13', 'Elias Kingsley won 2-0', { winner: 'away', sets: 2, totalGames: 18 }, 1795280288067, '0|2 4|false,2|6 6|true', 22, 2515833903, [6, 8, 3, 1]],
  ['tennis-2026-11-22-00', 'Pablo Achterberg won 2-0', { winner: 'away', sets: 2, totalGames: 17 }, 1795313509945, '0|3 2|false,2|6 6|true', 20, 2514314193, [7, 8, 5, 6]],
  ['tennis-2026-11-22-08', 'Imani Whitlock won 2-0', { winner: 'home', sets: 2, totalGames: 15 }, 1795346573734, '2|6 6|true,0|2 1|false', 18, 2067830163, [7, 5, 5, 5]],
  ['tennis-2026-11-22-16', 'Priya Lachance won 2-0', { winner: 'home', sets: 2, totalGames: 22 }, 1795382754358, '2|7 6|true,0|5 4|false', 25, 1657686937, [8, 7, 5, 1]],
  ['tennis-2026-11-23-04', 'Imani Whitlock won 2-0', { winner: 'home', sets: 2, totalGames: 18 }, 1795419294154, '2|6 6|true,0|3 3|false', 21, 154882509, [9, 6, 5, 6]],
  ['tennis-2026-11-23-12', 'Pablo Achterberg won 2-0', { winner: 'away', sets: 2, totalGames: 19 }, 1795453096024, '0|4 3|false,2|6 6|true', 22, 4069807522, [7, 8, 3, 1]],
  ['mma-2026-11-20-00', 'Talia Ransome won by Submission', { winner: 'away', method: 'Submission', distance: false }, 1795136937843.4106, 'null|L|false,null|W · SUB R1|true', 6, 3921192802, [8, 8]],
  ['mma-2026-11-20-03', 'Elena Pemberton won by unanimous decision', { winner: 'home', method: 'Decision', distance: true }, 1795143240000, 'null|W · UD|true,null|L|false', 17, 241748345, [53, 67]],
  ['mma-2026-11-20-06', 'Mateo Gearhart won by unanimous decision', { winner: 'away', method: 'Decision', distance: true }, 1795206240000, 'null|L|false,null|W · UD|true', 15, 1797387042, [58, 64]],
  ['mma-2026-11-21-00', 'Nico Nakashima won by Submission', { winner: 'away', method: 'Submission', distance: false }, 1795224096750.3223, 'null|L|false,null|W · SUB R3|true', 16, 3731481334, [55, 58]],
  ['mma-2026-11-21-03', 'Kofi Cheval won by Submission', { winner: 'home', method: 'Submission', distance: false }, 1795228780479.4556, 'null|W · SUB R1|true,null|L|false', 4, 3804013391, [11, 10]],
  ['mma-2026-11-21-06', 'Olivia Northcott won by unanimous decision', { winner: 'home', method: 'Decision', distance: true }, 1795292640000, 'null|W · UD|true,null|L|false', 13, 2298671928, [66, 53]],
  ['mma-2026-11-22-00', 'Tomas Merriman won by KO/TKO', { winner: 'away', method: 'KO/TKO', distance: false }, 1795309790750.7869, 'null|L|false,null|W · KO R1|true', 7, 3808834899, [12, 12]],
  ['mma-2026-11-22-03', 'Callum Whitlock won by unanimous decision', { winner: 'home', method: 'Decision', distance: true }, 1795316040000, 'null|W · UD|true,null|L|false', 11, 1529322579, [67, 64]],
  ['mma-2026-11-22-07', 'Kofi Cheval won by unanimous decision', { winner: 'home', method: 'Decision', distance: true }, 1795380840000, 'null|W · UD|true,null|L|false', 14, 3776875164, [59, 57]],
  ['mma-2026-11-23-01', 'Olivia Northcott won by Submission', { winner: 'home', method: 'Submission', distance: false }, 1795397880431.703, 'null|W · SUB R1|true,null|L|false', 5, 3195273300, [4, 4]],
  ['boxing-2026-11-20-00', 'Kai Castell won by unanimous decision', { winner: 'home', method: 'Decision', distance: true }, 1795211160000, 'null|W · UD|true,null|L|false', 42, 3929810858, [239, 213]],
  ['boxing-2026-11-20-01', 'Luka Northcott won by KO/TKO', { winner: 'away', method: 'KO/TKO', distance: false }, 1795214245350.8533, 'null|L|false,null|W · KO R8|true', 32, 969637582, [155, 186]],
  ['boxing-2026-11-20-02', 'Felix Oyelaran won by unanimous decision', { winner: 'away', method: 'Decision', distance: true }, 1795218840000, 'null|L|false,null|W · UD|true', 49, 2060738009, [223, 293]],
  ['boxing-2026-11-21-00', 'Pablo Zabala won by unanimous decision', { winner: 'home', method: 'Decision', distance: true }, 1795297560000, 'null|W · UD|true,null|L|false', 43, 1203096782, [245, 213]],
  ['boxing-2026-11-21-01', 'Hugo Cortese won by unanimous decision', { winner: 'home', method: 'Decision', distance: true }, 1795301160000, 'null|W · UD|true,null|L|false', 44, 305606245, [206, 231]],
  ['boxing-2026-11-21-02', 'Tomas Wexley won by unanimous decision', { winner: 'away', method: 'Decision', distance: true }, 1795305240000, 'null|L|false,null|W · UD|true', 50, 929286817, [296, 223]],
  ['boxing-2026-11-22-00', 'Aiden Vantongeren won by KO/TKO', { winner: 'home', method: 'KO/TKO', distance: false }, 1795382714924.7363, 'null|W · KO R5|true,null|L|false', 23, 2884610718, [102, 94]],
  ['boxing-2026-11-22-01', 'Callum Yardley won by KO/TKO', { winner: 'home', method: 'KO/TKO', distance: false }, 1795387241800.285, 'null|W · KO R9|true,null|L|false', 41, 3538045974, [184, 183]],
];

describe('results did not change', () => {
  it.each(BEFORE)('%s', (id, resultText, facts, endsAt, scores, playCount, playsHash, totals) => {
    const meta = eventMetaById(id) as EventMeta;
    const final = finalState(meta);
    expect(final.resultText).toBe(resultText);
    expect(final.facts).toEqual(facts);
    expect(final.endsAt).toBe(endsAt);
    expect(final.entries.map((e) => `${e.score}|${e.scoreText}|${e.isWinner}`).join(',')).toBe(scores);
    expect(final.plays.length).toBe(playCount);
    const fingerprint = final.plays
      .map((p) => `${p.at}|${p.clock}|${p.tag}|${p.importance}|${p.competitorId}|${p.scoreAfter}|${p.description}`)
      .join('\n');
    expect(hashText(fingerprint)).toBe(playsHash);
    const now = meta.sportId === 'tennis'
      ? [...compare(final, 'Aces'), ...compare(final, 'Double faults')]
      : compare(final, meta.sportId === 'mma' ? 'Significant strikes' : 'Punches landed');
    expect(now).toEqual(totals);
  });
});
