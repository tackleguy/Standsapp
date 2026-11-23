// Game-by-game tennis simulator: best of three sets with tiebreaks.
import { MINUTE } from '@/lib/format';
import { createRng } from '@/lib/random';

import type { EntryState, EventMeta, EventState, StatsSection } from '../../types';
import type { GameStats } from '../players/types';
import {
  cachedScript, disruptedState, nameOf, playsUpTo, preMatchNote, progressAt, shortOf, sortTimeline, statusAt,
  strengthOf, type TimedPlay, emptyGameStats,
} from './common';

interface Game { at: number; set: number; winner: 0 | 1; server: 0 | 1; tiebreak: string | null }

interface TennisScript {
  games: Game[];
  firstServer: 0 | 1;
  endsAt: number;
  timeline: TimedPlay[];
  aces: [number, number];
  doubleFaults: [number, number];
  firstServe: [number, number];
}

const HOLD_LINES = [
  '{name} holds serve to 15.', '{name} holds to 30 with a big serve out wide.', '{name} saves a break point and holds.',
  'Comfortable hold for {name}.', '{name} holds after a long deuce game.', '{name} closes out the game with an ace.',
  '{name} holds with a forehand winner down the line.', 'Quick hold for {name}.',
];

function buildScript(meta: EventMeta): TennisScript {
  const rng = createRng(`tennis:${meta.id}`);
  // Commentary wording only; its own seed so it can never change a result.
  const detail = createRng(`tennis-detail:${meta.id}`);
  const ids = meta.competitorIds;
  const s = [strengthOf(ids[0]), strengthOf(ids[1])];
  const firstServer: 0 | 1 = rng.chance(0.5) ? 0 : 1;
  const games: Game[] = [];
  const tl: TimedPlay[] = [];
  const name = (p: number) => nameOf(ids[p]);
  let t = meta.startsAt + 3 * MINUTE;
  let server = firstServer;
  const setsWon = [0, 0];
  let set = 0;
  tl.push({ at: meta.startsAt, clock: 'Warm-up', importance: 1, tag: 'START', competitorId: ids[firstServer],
    description: `${name(firstServer)} wins the toss and will serve first.`, scoreAfter: null });

  while (setsWon[0] < 2 && setsWon[1] < 2) {
    const g = [0, 0];
    let setDone = false;
    while (!setDone) {
      let winner: 0 | 1;
      let tiebreak: string | null = null;
      if (g[0] === 6 && g[1] === 6) {
        winner = rng.chance(0.5 + (s[0] - s[1]) * 0.5) ? 0 : 1;
        const loserPts = rng.chance(0.3) ? rng.int(6, 9) : rng.int(0, 5);
        const winPts = loserPts >= 6 ? loserPts + 2 : 7;
        tiebreak = winner === 0 ? `${winPts}-${loserPts}` : `${loserPts}-${winPts}`;
        t += 12 * MINUTE;
        tl.push({ at: t - 12 * MINUTE + 1, clock: `Set ${set + 1} 6-6`, importance: 2, tag: 'TIEBREAK', competitorId: null,
          description: `Tiebreak in set ${set + 1}! Nerves of steel needed.`, scoreAfter: null });
      } else {
        const ret = (1 - server) as 0 | 1;
        const hold = Math.min(0.93, Math.max(0.5, 0.73 + (s[server] - s[ret]) * 0.35));
        winner = rng.chance(hold) ? server : ret;
        t += Math.round(rng.float(3.2, 6.5) * MINUTE);
      }
      g[winner]++;
      games.push({ at: t, set, winner, server, tiebreak });
      const score = `${g[0]}-${g[1]}`;
      const clock = `Set ${set + 1} ${score}`;
      if (!tiebreak && winner !== server) {
        const lead = g[winner] > g[1 - winner] ? `to lead ${g[winner]}-${g[1 - winner]}`
          : g[winner] === g[1 - winner] ? `to level at ${g[winner]}-${g[winner]}` : `to trail ${g[winner]}-${g[1 - winner]}`;
        tl.push({ at: t, clock, importance: 2, tag: 'BREAK', competitorId: ids[winner],
          description: `Break! ${name(winner)} breaks ${name(server)} ${lead}.`, scoreAfter: score });
      } else if (!tiebreak) {
        // Same draw as always (so no result changes); every hold now shows in the feed.
        const special = rng.chance(0.06);
        tl.push({ at: t, clock, importance: 1, tag: 'HOLD', competitorId: ids[winner],
          description: special ? `${name(winner)} holds to love with an ace down the T.`
            : detail.pick(HOLD_LINES).replace('{name}', name(winner)), scoreAfter: score });
      }
      setDone = (g[winner] >= 6 && g[winner] - g[1 - winner] >= 2) || g[winner] === 7;
      if (setDone) {
        setsWon[winner]++;
        const ordinal = ['first', 'second', 'third'][set];
        const line = tiebreak ? `7-6 (${tiebreak})` : `${g[winner]}-${g[1 - winner]}`;
        const matchOver = setsWon[winner] === 2;
        tl.push({ at: t + 1, clock, importance: 3, tag: matchOver ? 'FINAL' : 'SET', competitorId: ids[winner],
          description: matchOver
            ? `GAME, SET AND MATCH! ${name(winner)} wins ${setsWon[winner]}-${setsWon[1 - winner]} in sets.`
            : `${name(winner)} takes the ${ordinal} set ${line}.`,
          scoreAfter: `${setsWon[0]}-${setsWon[1]}` });
        if (!matchOver) t += 2 * MINUTE;
        set++;
      } else if (g[winner] === 5 && g[1 - winner] <= 4 && setsWon[winner] === 1 && rng.chance(0.4)) {
        tl.push({ at: t + 2, clock, importance: 2, tag: 'MATCHPOINT', competitorId: ids[winner],
          description: `${name(winner)} is a game away from victory.`, scoreAfter: null });
      }
      if ((g[0] + g[1]) % 2 === 1) t += 90_000; // changeover
      server = (1 - server) as 0 | 1;
    }
  }
  const total = games.length;
  return {
    games, firstServer, endsAt: t + 2 * MINUTE, timeline: sortTimeline(tl),
    aces: [Math.round(total * (0.25 + s[0] * 0.25)), Math.round(total * (0.25 + s[1] * 0.25))],
    doubleFaults: [rng.int(1, 6), rng.int(1, 6)],
    firstServe: [rng.int(56, 72), rng.int(56, 72)],
  };
}

function setScores(games: Game[], now: number): { sets: [number, number][]; tb: (string | null)[] } {
  const sets: [number, number][] = [];
  const tb: (string | null)[] = [];
  for (const g of games) {
    if (g.at > now) break;
    if (!sets[g.set]) { sets[g.set] = [0, 0]; tb[g.set] = null; }
    sets[g.set][g.winner]++;
    if (g.tiebreak) tb[g.set] = g.tiebreak;
  }
  return { sets, tb };
}

export function simulateTennis(meta: EventMeta, now: number): EventState {
  if (meta.disruption) return disruptedState(meta);
  const s = cachedScript(`tennis:${meta.id}`, () => buildScript(meta));
  const status = statusAt(meta, s.endsAt, now);
  const progress = progressAt(meta, s.endsAt, now);
  const ids = meta.competitorIds;
  const { sets } = setScores(s.games, now);
  const isComplete = (set: [number, number]) => {
    const [a, b] = set;
    return (Math.max(a, b) >= 6 && Math.abs(a - b) >= 2) || Math.max(a, b) === 7;
  };
  const setsWon = [0, 1].map((p) => sets.filter((set) => isComplete(set) && set[p] > set[1 - p]).length);
  const finished = status === 'finished';
  const final = setScores(s.games, Infinity);
  const finalWon = [0, 1].map((p) => final.sets.filter((set) => set[p] > set[1 - p]).length);
  const winner = finalWon[0] > finalWon[1] ? 0 : 1;
  const played = s.games.filter((g) => g.at <= now);
  const nextServer = played.length === 0 ? s.firstServer : ((1 - played[played.length - 1].server) as 0 | 1);

  const entries: EntryState[] = ids.map((id, p) => ({
    competitorId: id, role: p === 0 ? 'home' : 'away',
    score: status === 'scheduled' ? null : setsWon[p],
    scoreText: status === 'scheduled' || sets.length === 0 ? null : sets.map((set) => set[p]).join(' '),
    position: null,
    isWinner: finished ? winner === p : null,
    note: status === 'live' && nextServer === p ? 'Serving' : null,
  }));

  const current = sets[sets.length - 1];
  const stats: StatsSection[] = progress <= 0 ? [preMatchNote(meta)] : [
    { type: 'table', title: 'Score', columns: ['Player', 'S1', 'S2', 'S3', 'Sets'],
      rows: ids.map((id, p) => ({ key: id, competitorId: id, emphasis: true,
        cells: [shortOf(id), ...[0, 1, 2].map((i) => (sets[i] ? String(sets[i][p]) : '–')), String(setsWon[p])] })) },
    { type: 'compare', title: 'Match stats', items: [
      { label: 'Aces', home: Math.round(s.aces[0] * progress), away: Math.round(s.aces[1] * progress) },
      { label: 'Double faults', home: Math.round(s.doubleFaults[0] * progress), away: Math.round(s.doubleFaults[1] * progress) },
      { label: '1st serve in', home: s.firstServe[0], away: s.firstServe[1], suffix: '%' },
      { label: 'Breaks of serve', home: played.filter((g) => !g.tiebreak && g.winner === 0 && g.server === 1).length,
        away: played.filter((g) => !g.tiebreak && g.winner === 1 && g.server === 0).length },
      { label: 'Games won', home: played.filter((g) => g.winner === 0).length, away: played.filter((g) => g.winner === 1).length },
    ] },
  ];

  return {
    meta, status, progress, entries, stats,
    periodLabel: status === 'live' ? `Set ${sets.length || 1} · ${current ? `${current[0]}-${current[1]}` : '0-0'}` : null,
    plays: playsUpTo(meta, s.timeline, now),
    resultText: finished ? `${nameOf(ids[winner])} won ${finalWon[winner]}-${finalWon[1 - winner]}` : null,
    facts: { winner: winner === 0 ? 'home' : 'away', sets: final.sets.length, totalGames: s.games.length },
    endsAt: s.endsAt,
  };
}

/**
 * Per-player stats for one event (the whole game; readers cut it at "now").
 * TODO(players): attribute every stat to roster players. Until then nobody scores.
 */
export function tennisGameStats(meta: EventMeta): GameStats {
  return emptyGameStats(meta);
}
