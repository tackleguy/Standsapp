// Game-by-game tennis simulator: best of three sets with tiebreaks.
import { MINUTE } from '@/lib/format';
import { createRng, type Rng } from '@/lib/random';

import type { EntryState, EventMeta, EventState, StatsSection } from '../../types';
import type { GameStats, StatLine } from '../players/types';
import {
  cachedScript, disruptedState, impactOf, nameOf, playsUpTo, preMatchNote, progressAt, shortOf, sortTimeline, statusAt,
  strengthOf, type TimedPlay,
} from './common';

interface Game {
  at: number; set: number; winner: 0 | 1; server: 0 | 1; tiebreak: string | null;
  /** The feed says the server hit an ace in this game. */
  aceLine?: boolean;
  /** Held to love (no points lost, so no double faults). */
  love?: boolean;
}

/** One athlete's stat increments at one moment. `side` is 0 or 1 (meta.competitorIds order). */
interface Feat { at: number; set: number; side: 0 | 1; stats: StatLine }

interface TennisScript {
  games: Game[];
  firstServer: 0 | 1;
  endsAt: number;
  timeline: TimedPlay[];
  aces: [number, number];
  doubleFaults: [number, number];
  firstServe: [number, number];
  /** Every athlete stat (games, breaks, sets, aces, double faults, the win), oldest first. */
  feats: Feat[];
}

const HOLD_LINES = [
  '{name} holds serve to 15.', '{name} holds to 30 with a big serve out wide.', '{name} saves a break point and holds.',
  'Comfortable hold for {name}.', '{name} holds after a long deuce game.', '{name} closes out the game with an ace.',
  '{name} holds with a forehand winner down the line.', 'Quick hold for {name}.',
];

const mentionsAce = (text: string) => /\bace\b/.test(text);

function buildScript(meta: EventMeta): TennisScript {
  const rng = createRng(`tennis:${meta.id}`);
  // Commentary wording only; its own seed so it can never change a result.
  const detail = createRng(`tennis-detail:${meta.id}`);
  const ids = meta.competitorIds;
  const s = [strengthOf(ids[0]), strengthOf(ids[1])];
  const firstServer: 0 | 1 = rng.chance(0.5) ? 0 : 1;
  const games: Game[] = [];
  const tl: TimedPlay[] = [];
  const feats: Feat[] = [];
  const name = (p: number) => nameOf(ids[p]);
  // Both athletes, main one first.
  const pair = (p: number) => [ids[p], ids[1 - p]];
  let t = meta.startsAt + 3 * MINUTE;
  let server = firstServer;
  const setsWon = [0, 0];
  let set = 0;
  tl.push({ at: meta.startsAt, clock: 'Warm-up', importance: 1, tag: 'START', competitorId: ids[firstServer],
    description: `${name(firstServer)} wins the toss and will serve first.`, scoreAfter: null,
    playerIds: pair(firstServer), playerRoles: ['serve', 'return'], headline: 'Wins the toss', impact: impactOf(0.5), period: 0 });

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
          description: `Tiebreak in set ${set + 1}! Nerves of steel needed.`, scoreAfter: null,
          playerIds: [ids[0], ids[1]], playerRoles: ['player', 'player'], headline: 'Tiebreak',
          impact: impactOf(4.5 + (set === 2 ? 1 : 0)), period: set });
      } else {
        const ret = (1 - server) as 0 | 1;
        const hold = Math.min(0.93, Math.max(0.5, 0.73 + (s[server] - s[ret]) * 0.35));
        winner = rng.chance(hold) ? server : ret;
        t += Math.round(rng.float(3.2, 6.5) * MINUTE);
      }
      g[winner]++;
      const game: Game = { at: t, set, winner, server, tiebreak };
      games.push(game);
      const loser = (1 - winner) as 0 | 1;
      const isBreak = !tiebreak && winner !== server;
      feats.push({ at: t, set, side: winner, stats: isBreak ? { gw: 1, brk: 1 } : { gw: 1 } });
      feats.push({ at: t, set, side: loser, stats: { gl: 1 } });
      // Pure arithmetic (no random draw), so working it out here changes nothing.
      const winsSet = (g[winner] >= 6 && g[winner] - g[loser] >= 2) || g[winner] === 7;
      const score = `${g[0]}-${g[1]}`;
      const clock = `Set ${set + 1} ${score}`;
      if (isBreak) {
        const lead = g[winner] > g[1 - winner] ? `to lead ${g[winner]}-${g[1 - winner]}`
          : g[winner] === g[1 - winner] ? `to level at ${g[winner]}-${g[winner]}` : `to trail ${g[winner]}-${g[1 - winner]}`;
        tl.push({ at: t, clock, importance: 2, tag: 'BREAK', competitorId: ids[winner],
          description: `Break! ${name(winner)} breaks ${name(server)} ${lead}.`, scoreAfter: score,
          playerIds: pair(winner), playerRoles: ['return', 'serve'], headline: winsSet ? 'Breaks for the set' : 'Break of serve',
          impact: impactOf(4.4 + (winsSet ? 1.6 : g[winner] >= 5 ? 0.8 : 0) + (g[0] + g[1] >= 8 ? 0.5 : 0) + (set === 2 ? 0.8 : 0)),
          period: set });
      } else if (!tiebreak) {
        // Same draw as always (so no result changes); every hold now shows in the feed.
        const special = rng.chance(0.06);
        const description = special ? `${name(winner)} holds to love with an ace down the T.`
          : detail.pick(HOLD_LINES).replace('{name}', name(winner));
        game.aceLine = mentionsAce(description);
        game.love = special;
        tl.push({ at: t, clock, importance: 1, tag: 'HOLD', competitorId: ids[winner], description, scoreAfter: score,
          playerIds: pair(winner), playerRoles: ['serve', 'return'], headline: game.aceLine ? 'Ace' : winsSet ? 'Holds for the set' : 'Holds serve',
          impact: impactOf(1.4 + (winsSet ? 1.4 : 0) + (game.aceLine ? 0.6 : 0) + (set === 2 ? 0.4 : 0) + (g[0] + g[1] >= 10 ? 0.4 : 0)),
          period: set });
      }
      setDone = winsSet;
      if (setDone) {
        setsWon[winner]++;
        const ordinal = ['first', 'second', 'third'][set];
        const line = tiebreak ? `7-6 (${tiebreak})` : `${g[winner]}-${g[1 - winner]}`;
        const matchOver = setsWon[winner] === 2;
        tl.push({ at: t + 1, clock, importance: 3, tag: matchOver ? 'FINAL' : 'SET', competitorId: ids[winner],
          description: matchOver
            ? `GAME, SET AND MATCH! ${name(winner)} wins ${setsWon[winner]}-${setsWon[1 - winner]} in sets.`
            : `${name(winner)} takes the ${ordinal} set ${line}.`,
          scoreAfter: `${setsWon[0]}-${setsWon[1]}`,
          playerIds: pair(winner), playerRoles: ['won', 'lost'], headline: matchOver ? 'Wins the match' : 'Takes the set',
          impact: impactOf(matchOver ? (setsWon[loser] === 1 ? 9.9 : 9.4) : 7 + (tiebreak ? 0.5 : 0)), period: set });
        feats.push({ at: t + 1, set, side: winner, stats: matchOver ? { sw: 1, win: 1 } : { sw: 1 } });
        if (!matchOver) t += 2 * MINUTE;
        set++;
      } else if (g[winner] === 5 && g[1 - winner] <= 4 && setsWon[winner] === 1 && rng.chance(0.4)) {
        tl.push({ at: t + 2, clock, importance: 2, tag: 'MATCHPOINT', competitorId: ids[winner],
          description: `${name(winner)} is a game away from victory.`, scoreAfter: null,
          playerIds: pair(winner), playerRoles: ['leads', 'trails'], headline: 'A game from victory', impact: impactOf(4), period: set });
      }
      if ((g[0] + g[1]) % 2 === 1) t += 90_000; // changeover
      server = (1 - server) as 0 | 1;
    }
  }
  const total = games.length;
  const aces: [number, number] = [Math.round(total * (0.25 + s[0] * 0.25)), Math.round(total * (0.25 + s[1] * 0.25))];
  const doubleFaults: [number, number] = [rng.int(1, 6), rng.int(1, 6)];
  // Serve stats come from their own seed, after every result is settled.
  const serve = serveFeats(games, aces, doubleFaults, createRng(`players:${meta.id}`));
  return {
    games, firstServer, endsAt: t + 2 * MINUTE, timeline: sortTimeline(tl),
    aces, doubleFaults,
    firstServe: [rng.int(56, 72), rng.int(56, 72)],
    // Stable sort: an ace that closes out a game comes just before the game is credited.
    feats: [...serve, ...feats].sort((a, b) => a.at - b.at),
  };
}

/** Picks one index by weight, or -1 when every weight is 0. */
function pickWeighted(rng: Rng, weights: number[]): number {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return -1;
  let x = rng.next() * sum;
  let last = -1;
  for (let i = 0; i < weights.length; i++) {
    if (weights[i] <= 0) continue;
    last = i;
    x -= weights[i];
    if (x < 0) return i;
  }
  return last; // only reached through rounding
}

/**
 * Aces and double faults, spread over each athlete's own service games (and
 * tiebreaks, where both serve). The totals are the ones the Stats tab has always
 * shown; a game the feed says ended with an ace always has one.
 */
function serveFeats(games: Game[], aces: [number, number], doubleFaults: [number, number], rng: Rng): Feat[] {
  const out: Feat[] = [];
  for (const p of [0, 1] as const) {
    const slots = games.filter((g) => g.tiebreak || g.server === p);
    // Aces: at least one in every game the feed says closed with an ace.
    const aceCount = slots.map((g): number => (g.aceLine && g.server === p && !g.tiebreak ? 1 : 0));
    const mentioned = aceCount.reduce((a, b) => a + b, 0);
    for (let left = Math.max(aces[p], mentioned) - mentioned; left > 0; left--) {
      // Up to 3 a game; held games and tiebreaks get more than games that are broken.
      const i = pickWeighted(rng, slots.map((g, k) => (aceCount[k] >= 3 ? 0 : g.tiebreak ? 1.5 : g.winner === p ? 1 : 0.4)));
      if (i < 0) break;
      aceCount[i]++;
    }
    // Double faults: never in a love hold, at most one in a hold or tiebreak (two
    // if there is no other room), two in a game that gets broken (and those games
    // are likelier to have them).
    const dfCount = slots.map(() => 0);
    const dfWeights = (holdCap: number) => slots.map((g, j) => {
      const cap = g.love ? 0 : g.tiebreak || g.winner === p ? holdCap : 2;
      return dfCount[j] >= cap ? 0 : g.tiebreak ? 0.8 : g.winner === p ? 1 : 2.5;
    });
    for (let k = 0; k < doubleFaults[p]; k++) {
      let i = pickWeighted(rng, dfWeights(1));
      if (i < 0) i = pickWeighted(rng, dfWeights(2));
      if (i < 0) break;
      dfCount[i]++;
    }
    slots.forEach((g, k) => {
      // Inside the game: a service game lasts at least 3.2 minutes, a tiebreak 12.
      const span = g.tiebreak ? 11.5 * MINUTE : 3 * MINUTE;
      const inGame = () => g.at - Math.round(rng.float(5_000, span));
      for (let a = 0; a < aceCount[k]; a++) {
        const closing = a === 0 && g.aceLine && g.server === p && !g.tiebreak;
        out.push({ at: closing ? g.at : inGame(), set: g.set, side: p, stats: { aces: 1 } });
      }
      for (let d = 0; d < dfCount[k]; d++) out.push({ at: inGame(), set: g.set, side: p, stats: { df: 1 } });
    });
  }
  return out.sort((a, b) => a.at - b.at);
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

/** How many of one stat an athlete has up to `now`. */
function featTotal(feats: Feat[], side: 0 | 1, key: string, now: number): number {
  let total = 0;
  for (const f of feats) {
    if (f.at > now) break;
    if (f.side === side) total += f.stats[key] ?? 0;
  }
  return total;
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
      // Counted as they happen, so they always match the players' own stats.
      { label: 'Aces', home: featTotal(s.feats, 0, 'aces', now), away: featTotal(s.feats, 1, 'aces', now) },
      { label: 'Double faults', home: featTotal(s.feats, 0, 'df', now), away: featTotal(s.feats, 1, 'df', now) },
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
 * Per-player stats for one event (the whole match; readers cut it at "now").
 * The athletes are the players: games won and lost as each game finishes,
 * breaks of serve, aces and double faults inside their service games, sets as
 * they are won, and the win at match point. Same script as the scoreboard, so
 * it always agrees with the score and the feed.
 */
export function tennisGameStats(meta: EventMeta): GameStats {
  const s = cachedScript(`tennis:${meta.id}`, () => buildScript(meta));
  const ids = meta.competitorIds;
  const setCount = s.games.length ? s.games[s.games.length - 1].set + 1 : 0;
  return {
    periods: Array.from({ length: setCount }, (_, i) => `Set ${i + 1}`),
    lineups: ids.map((id) => ({ competitorId: id, playerIds: [id] })),
    events: s.feats.map((f) => ({ at: f.at, period: f.set, playerId: ids[f.side], stats: f.stats })),
  };
}
