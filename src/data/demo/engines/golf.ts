// Hole-by-hole golf simulator: one tournament round per event, with a live leaderboard.
import { formatTime, formatToPar, MINUTE } from '@/lib/format';
import { createRng } from '@/lib/random';

import type { EntryState, EventMeta, EventState, StatsSection } from '../../types';
import type { GameStats } from '../players/types';
import {
  cachedScript, disruptedState, nameOf, playsUpTo, preMatchNote, progressAt, sortTimeline, statusAt,
  strengthOf, type TimedPlay, emptyGameStats,
} from './common';

const PARS = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 3, 4, 5, 4, 4, 3, 4, 5];
const HOLE_MS = 13 * MINUTE;
const GROUP_GAP_MS = 11 * MINUTE;
const GROUP_SIZE = 3;

interface HoleResult { at: number; hole: number; toPar: number }

interface GolfScript {
  round: number;
  ids: string[];
  prior: number[]; // to-par before today
  teeTimes: number[];
  holes: HoleResult[][]; // per player
  endsAt: number;
  timeline: TimedPlay[];
}

function holeScore(rng: ReturnType<typeof createRng>, par: number, skill: number): number {
  if (par === 3 && rng.chance(0.002)) return -2; // hole-in-one
  const roll = rng.next();
  const eagle = par === 5 ? 0.03 + skill * 0.02 : 0.004;
  const birdie = 0.15 + skill * 0.1 + (par === 5 ? 0.12 : 0);
  const bogey = 0.19 - skill * 0.08;
  const double = 0.035 - skill * 0.015;
  if (roll < eagle) return -2;
  if (roll < eagle + birdie) return -1;
  if (roll < eagle + birdie + bogey) return 1;
  if (roll < eagle + birdie + bogey + double) return 2;
  return 0;
}

function buildScript(meta: EventMeta): GolfScript {
  const rng = createRng(`golf:${meta.id}`);
  const round = Number(/Round (\d)/.exec(meta.title)?.[1] ?? 1);
  const tournamentSeed = meta.title.split('·')[0];
  const ids = meta.competitorIds;
  const prior = ids.map((id) => {
    const r = createRng(`golfprior:${tournamentSeed}:${id}:${Math.floor(meta.startsAt / (4 * 86_400_000))}`);
    let total = 0;
    for (let i = 1; i < round; i++) total += Math.round(r.normal(-1 - strengthOf(id) * 4, 6));
    return total;
  });
  // Leaders tee off last, the way tournaments work.
  const teeOrder = ids.map((_, i) => i).sort((a, b) => prior[b] - prior[a] || strengthOf(ids[a]) - strengthOf(ids[b]));
  const teeTimes = new Array(ids.length).fill(0);
  teeOrder.forEach((p, i) => { teeTimes[p] = meta.startsAt + Math.floor(i / GROUP_SIZE) * GROUP_GAP_MS; });
  const holes: HoleResult[][] = ids.map((id, p) => PARS.map((par, h) => ({
    at: teeTimes[p] + (h + 1) * HOLE_MS + Math.round(rng.float(-90_000, 90_000)),
    hole: h + 1,
    toPar: holeScore(rng, par, strengthOf(id)),
  })));
  const endsAt = Math.max(...holes.map((list) => list[list.length - 1].at)) + 5 * MINUTE;

  // Walk the round in time order to write the commentary and spot lead changes.
  const tl: TimedPlay[] = [];
  const all = holes.flatMap((list, p) => list.map((h) => ({ ...h, p }))).sort((a, b) => a.at - b.at);
  const running = [...prior];
  let leader = prior.indexOf(Math.min(...prior));
  const contenders = new Set(teeOrder.slice(-12));
  tl.push({ at: meta.startsAt, clock: 'Round start', importance: 1, tag: 'START', competitorId: null,
    description: `Round ${round} is under way at ${meta.venue}. ${nameOf(ids[leader])} starts as the leader at ${formatToPar(prior[leader])}.`,
    scoreAfter: null });
  for (const h of all) {
    running[h.p] += h.toPar;
    const who = nameOf(ids[h.p]);
    const clock = `Hole ${h.hole}`;
    const par = PARS[h.hole - 1];
    if (h.toPar === -2 && par === 3) {
      tl.push({ at: h.at, clock, importance: 3, tag: 'ACE', competitorId: ids[h.p],
        description: `HOLE-IN-ONE! ${who} aces the par-3 ${h.hole}th!`, scoreAfter: formatToPar(running[h.p]) });
    } else if (h.toPar === -2) {
      tl.push({ at: h.at, clock, importance: 3, tag: 'EAGLE', competitorId: ids[h.p],
        description: `Eagle! ${who} holes out for a 3 on the par-5 ${h.hole}th.`, scoreAfter: formatToPar(running[h.p]) });
    } else if (h.toPar === -1 && contenders.has(h.p)) {
      tl.push({ at: h.at, clock, importance: 1, tag: 'BIRDIE', competitorId: ids[h.p],
        description: `Birdie for ${who} at ${h.hole}. Moves to ${formatToPar(running[h.p])}.`, scoreAfter: formatToPar(running[h.p]) });
    } else if (h.toPar >= 2 && contenders.has(h.p)) {
      tl.push({ at: h.at, clock, importance: 2, tag: 'DOUBLE', competitorId: ids[h.p],
        description: `Trouble! ${who} makes a double bogey at ${h.hole} and drops to ${formatToPar(running[h.p])}.`, scoreAfter: formatToPar(running[h.p]) });
    }
    const best = Math.min(...running);
    if (running[leader] > best) {
      const newLeader = running.indexOf(best);
      if (running.filter((r) => r === best).length === 1) {
        tl.push({ at: h.at + 1, clock, importance: 3, tag: 'LEAD', competitorId: ids[newLeader],
          description: `${nameOf(ids[newLeader])} takes the outright lead at ${formatToPar(best)}!`, scoreAfter: null });
      }
      leader = newLeader;
    }
  }
  const finalBest = Math.min(...running);
  const winner = running.indexOf(finalBest);
  tl.push({ at: endsAt - 1, clock: 'Final', importance: 3, tag: 'FINAL', competitorId: ids[winner],
    description: round === 4
      ? `${nameOf(ids[winner])} wins the ${meta.title.split('·')[0].trim()} at ${formatToPar(finalBest)}!`
      : `${nameOf(ids[winner])} leads after round ${round} at ${formatToPar(finalBest)}.`,
    scoreAfter: null });
  return { round, ids, prior, teeTimes, holes, endsAt, timeline: sortTimeline(tl) };
}

export function simulateGolf(meta: EventMeta, now: number): EventState {
  if (meta.disruption) return disruptedState(meta);
  const s = cachedScript(`golf:${meta.id}`, () => buildScript(meta));
  const status = statusAt(meta, s.endsAt, now);
  const progress = progressAt(meta, s.endsAt, now);
  const finished = status === 'finished';
  const rows = s.ids.map((id, p) => {
    const done = s.holes[p].filter((h) => h.at <= now);
    const today = done.reduce((a, h) => a + h.toPar, 0);
    return { id, p, thru: done.length, today, total: s.prior[p] + today };
  }).sort((a, b) => a.total - b.total || b.thru - a.thru);

  const positions = rows.map((r) => 1 + rows.filter((o) => o.total < r.total).length);
  const entries: EntryState[] = rows.map((r, i) => {
    const tied = rows.filter((o) => o.total === r.total).length > 1;
    const note = status === 'scheduled' ? `Tee ${formatTime(s.teeTimes[r.p])}`
      : r.thru === 18 ? 'F' : r.thru === 0 ? `Tee ${formatTime(s.teeTimes[r.p])}` : `Thru ${r.thru}`;
    return {
      competitorId: r.id, role: 'entrant', score: r.total,
      scoreText: `${tied && status !== 'scheduled' ? 'T' : ''}${formatToPar(r.total)}`,
      position: positions[i], isWinner: finished ? i === 0 : null, note,
    };
  });

  const stats: StatsSection[] = [];
  if (progress <= 0) stats.push(preMatchNote(meta));
  stats.push({
    type: 'table', title: `Leaderboard · Round ${s.round}`, columns: ['Pos', 'Player', 'Today', 'Thru', 'Total'],
    rows: rows.map((r, i) => ({ key: r.id, competitorId: r.id, emphasis: i < 3,
      cells: [String(positions[i]), nameOf(r.id), r.thru === 0 ? '–' : formatToPar(r.today), r.thru === 18 ? 'F' : String(r.thru), formatToPar(r.total)] })),
  });
  stats.push({ type: 'note', title: 'Course', text: `${meta.venue} · Par 72 · ${s.ids.length} players · groups of ${GROUP_SIZE}` });

  const leader = rows[0];
  const finalRows = s.ids.map((id, p) => ({ id, total: s.prior[p] + s.holes[p].reduce((a, h) => a + h.toPar, 0) }))
    .sort((a, b) => a.total - b.total);
  return {
    meta, status, progress, entries, stats,
    periodLabel: status === 'live' ? `Round ${s.round} · ${nameOf(leader.id)} leads ${formatToPar(leader.total)}` : null,
    plays: playsUpTo(meta, s.timeline, now),
    resultText: finished ? `${nameOf(rows[0].id)} ${s.round === 4 ? 'won' : 'leads'} at ${formatToPar(rows[0].total)}` : null,
    facts: { winnerId: finalRows[0].id, top6: finalRows.slice(0, 6).map((r) => r.id).join(','), podium: finalRows.slice(0, 3).map((r) => r.id).join(',') },
    endsAt: s.endsAt,
  };
}

/**
 * Per-player stats for one event (the whole game; readers cut it at "now").
 * TODO(players): attribute every stat to roster players. Until then nobody scores.
 */
export function golfGameStats(meta: EventMeta): GameStats {
  return emptyGameStats(meta);
}
