// Road-race stage simulator: breakaways, gaps, climbs, and a finish.
import { MINUTE } from '@/lib/format';
import { createRng } from '@/lib/random';

import type { EntryState, EventMeta, EventState, StatsSection } from '../../types';
import type { GameStats } from '../players/types';
import { competitorById } from '../world';
import {
  cachedScript, disruptedState, mmss, nameOf, playsUpTo, preMatchNote, progressAt, sortTimeline, statusAt,
  strengthOf, type TimedPlay, emptyGameStats,
} from './common';

type Profile = 'flat' | 'hilly' | 'mountain';

interface CyclingScript {
  distance: number;
  profile: Profile;
  rideMs: number;
  breakaway: number[];
  breakFormsKm: number;
  catchKm: number | null; // null: the break survives
  maxGapSec: number;
  finish: { d: number; gapSec: number }[];
  endsAt: number;
  timeline: TimedPlay[];
}

function kmAt(meta: EventMeta, s: CyclingScript, now: number): number {
  return Math.max(0, Math.min(s.distance, ((now - meta.startsAt) / s.rideMs) * s.distance));
}

function timeAtKm(meta: EventMeta, s: Pick<CyclingScript, 'distance' | 'rideMs'>, km: number): number {
  return Math.round(meta.startsAt + (km / s.distance) * s.rideMs);
}

function gapAt(s: CyclingScript, km: number): number {
  if (km < s.breakFormsKm) return 0;
  if (s.catchKm !== null && km >= s.catchKm) return 0;
  const peakKm = s.distance * 0.45;
  if (km <= peakKm) return s.maxGapSec * ((km - s.breakFormsKm) / Math.max(1, peakKm - s.breakFormsKm));
  const endKm = s.catchKm ?? s.distance;
  const endGap = s.catchKm === null ? s.maxGapSec * 0.25 : 0;
  return s.maxGapSec - (s.maxGapSec - endGap) * ((km - peakKm) / Math.max(1, endKm - peakKm));
}

function buildScript(meta: EventMeta): CyclingScript {
  const rng = createRng(`cycling:${meta.id}`);
  const ids = meta.competitorIds;
  const strengths = ids.map((id) => strengthOf(id));
  const profile: Profile = rng.pick(['flat', 'flat', 'hilly', 'mountain'] as const);
  const distance = rng.int(150, 205);
  const rideMs = meta.durationMs;
  const breakSize = rng.int(3, 6);
  const weakerFirst = ids.map((_, i) => i).sort((a, b) => strengths[a] - strengths[b] + rng.float(-0.25, 0.25));
  const breakaway = weakerFirst.slice(0, breakSize);
  const survives = rng.chance(profile === 'hilly' ? 0.4 : profile === 'flat' ? 0.2 : 0.25);
  const catchKm = survives ? null : distance - rng.int(3, 28);
  const maxGapSec = rng.int(150, 420);
  const breakFormsKm = rng.int(8, 25);

  const finishOrder: { d: number; gapSec: number }[] = [];
  const others = ids.map((_, i) => i).filter((i) => !(survives && breakaway.includes(i)));
  const scored = others.map((d) => ({ d, v: strengths[d] + rng.normal(0, profile === 'flat' ? 0.35 : 0.18) })).sort((a, b) => b.v - a.v);
  if (survives) {
    const breakOrder = [...breakaway].sort((a, b) => strengths[b] + rng.float(-0.2, 0.2) - strengths[a]);
    breakOrder.forEach((d, i) => finishOrder.push({ d, gapSec: i === 0 ? 0 : rng.int(0, 25) + i * 3 }));
  }
  const pelotonGap = survives ? Math.round(maxGapSec * 0.25) : 0;
  scored.forEach(({ d }, i) => {
    let gap = pelotonGap;
    if (profile === 'mountain') gap += Math.round(i * rng.float(4, 14));
    else if (profile === 'hilly') gap += i < 25 ? Math.round(Math.max(0, i - 3) * rng.float(0, 4)) : 40 + i * 3;
    else gap += i < 22 ? 0 : 12 + i;
    finishOrder.push({ d, gapSec: gap });
  });
  finishOrder.sort((a, b) => a.gapSec - b.gapSec);
  for (let i = 1; i < finishOrder.length; i++) {
    if (finishOrder[i].gapSec < finishOrder[i - 1].gapSec) finishOrder[i].gapSec = finishOrder[i - 1].gapSec;
  }

  const base = { distance, rideMs };
  const name = (d: number) => nameOf(ids[d]);
  const tl: TimedPlay[] = [];
  const kmLabel = (km: number) => `${Math.round(distance - km)} km to go`;
  tl.push({ at: meta.startsAt, clock: '0 km', importance: 1, tag: 'START', competitorId: null,
    description: `The flag drops! ${distance} km of ${profile} racing ahead on ${meta.title.replace(/^Stage \d+: /, '')}.`, scoreAfter: null });
  tl.push({ at: timeAtKm(meta, base, breakFormsKm), clock: kmLabel(breakFormsKm), importance: 2, tag: 'BREAK', competitorId: null,
    description: `A break of ${breakSize} goes clear: ${breakaway.map(name).join(', ')}.`, scoreAfter: null });
  const partial = { ...base, breakFormsKm, catchKm, maxGapSec } as CyclingScript;
  for (let km = 30; km < (catchKm ?? distance) - 10; km += 30) {
    tl.push({ at: timeAtKm(meta, base, km), clock: kmLabel(km), importance: 1, tag: 'GAP', competitorId: null,
      description: `Time check: the break leads the peloton by ${mmss(gapAt(partial, km) / 60)}.`, scoreAfter: null });
  }
  const sprintKm = Math.round(distance * 0.55);
  tl.push({ at: timeAtKm(meta, base, sprintKm), clock: kmLabel(sprintKm), importance: 1, tag: 'SPRINT', competitorId: ids[breakaway[0]],
    description: `${name(breakaway[0])} takes the intermediate sprint points.`, scoreAfter: null });
  if (profile !== 'flat') {
    [0.3, 0.7].forEach((f) => {
      const km = Math.round(distance * f);
      const d = rng.pick(breakaway);
      tl.push({ at: timeAtKm(meta, base, km), clock: kmLabel(km), importance: 1, tag: 'KOM', competitorId: ids[d],
        description: `${name(d)} crests the climb first and collects mountain points.`, scoreAfter: null });
    });
  }
  if (rng.chance(0.35)) {
    const km = rng.int(40, distance - 20);
    const d = rng.int(0, ids.length - 1);
    tl.push({ at: timeAtKm(meta, base, km), clock: kmLabel(km), importance: 2, tag: 'CRASH', competitorId: ids[d],
      description: `Crash in the peloton! ${name(d)} goes down but is back on the bike.`, scoreAfter: null });
  }
  if (catchKm !== null) {
    tl.push({ at: timeAtKm(meta, base, catchKm), clock: kmLabel(catchKm), importance: 3, tag: 'CATCH', competitorId: null,
      description: `The break is caught with ${Math.round(distance - catchKm)} km to go! All together.`, scoreAfter: null });
  }
  const attacker = finishOrder[Math.min(1, finishOrder.length - 1)].d;
  tl.push({ at: timeAtKm(meta, base, distance - 6), clock: kmLabel(distance - 6), importance: 2, tag: 'ATTACK', competitorId: ids[attacker],
    description: profile === 'flat' ? 'The sprint trains are lining up at the front.' : `${name(attacker)} attacks on the final rise!`, scoreAfter: null });
  tl.push({ at: timeAtKm(meta, base, distance - 1), clock: '1 km to go', importance: 2, tag: 'FLAMME', competitorId: null,
    description: 'Under the flamme rouge — one kilometre to go!', scoreAfter: null });
  const winner = finishOrder[0].d;
  const endsAt = meta.startsAt + rideMs + 3 * MINUTE;
  tl.push({ at: meta.startsAt + rideMs, clock: 'Finish', importance: 3, tag: 'FINAL', competitorId: ids[winner],
    description: `${name(winner)} wins ${meta.title.split(':')[0]}! ${profile === 'flat' && catchKm !== null ? 'A blistering sprint.' : 'A superb ride.'}`,
    scoreAfter: null });
  return { distance, profile, rideMs, breakaway, breakFormsKm, catchKm, maxGapSec, finish: finishOrder, endsAt, timeline: sortTimeline(tl) };
}

function fmtGap(sec: number): string {
  return sec <= 0 ? 's.t.' : `+${mmss(sec / 60)}`;
}

export function simulateCycling(meta: EventMeta, now: number): EventState {
  if (meta.disruption) return disruptedState(meta);
  const s = cachedScript(`cycling:${meta.id}`, () => buildScript(meta));
  const status = statusAt(meta, s.endsAt, now);
  const progress = progressAt(meta, s.endsAt, now);
  const ids = meta.competitorIds;
  const finished = status === 'finished' || now >= meta.startsAt + s.rideMs;
  const km = kmAt(meta, s, now);
  const gap = gapAt(s, km);
  const breakActive = status === 'live' && km >= s.breakFormsKm && gap > 0;

  let order: { d: number; text: string }[];
  if (finished) order = s.finish.map((f, i) => ({ d: f.d, text: i === 0 ? 'Winner' : fmtGap(f.gapSec) }));
  else if (breakActive) {
    const rest = ids.map((_, i) => i).filter((i) => !s.breakaway.includes(i)).sort((a, b) => strengthOf(ids[b]) - strengthOf(ids[a]));
    order = [...s.breakaway.map((d) => ({ d, text: 'Breakaway' })), ...rest.map((d) => ({ d, text: `+${mmss(gap / 60)}` }))];
  } else order = ids.map((_, i) => i).sort((a, b) => strengthOf(ids[b]) - strengthOf(ids[a])).map((d) => ({ d, text: 'Peloton' }));

  const entries: EntryState[] = order.map((o, i) => ({
    competitorId: ids[o.d], role: 'entrant', score: null,
    scoreText: status === 'scheduled' ? null : o.text,
    position: status === 'scheduled' ? null : i + 1,
    isWinner: status === 'finished' ? i === 0 : null,
    note: null,
  }));

  const stats: StatsSection[] = [];
  if (progress <= 0) stats.push(preMatchNote(meta));
  stats.push({ type: 'note', title: 'Stage', text: `${s.distance} km · ${s.profile} profile` });
  if (status === 'live' && !finished) {
    stats.push({ type: 'note', title: 'Race situation', text: breakActive
      ? `${s.breakaway.length} riders up the road, ${mmss(gap / 60)} ahead with ${Math.round(s.distance - km)} km to go.`
      : `The peloton is together with ${Math.round(s.distance - km)} km to go.` });
  }
  if (finished) {
    stats.push({ type: 'table', title: 'Stage result', columns: ['Pos', 'Rider', 'Team', 'Gap'],
      rows: s.finish.map((f, i) => ({ key: ids[f.d], competitorId: ids[f.d], emphasis: i < 3,
        cells: [String(i + 1), nameOf(ids[f.d]), competitorById(competitorById(ids[f.d])?.parentId)?.shortName ?? '', i === 0 ? '—' : fmtGap(f.gapSec)] })) });
  }
  return {
    meta, status, progress, entries, stats,
    periodLabel: status === 'live' ? (finished ? 'Finished' : `${Math.round(s.distance - km)} km to go`) : null,
    plays: playsUpTo(meta, s.timeline, now),
    resultText: status === 'finished' ? `${nameOf(ids[s.finish[0].d])} won the stage` : null,
    facts: {
      winnerId: ids[s.finish[0].d],
      podium: s.finish.slice(0, 3).map((f) => ids[f.d]).join(','),
      top6: s.finish.slice(0, 6).map((f) => ids[f.d]).join(','),
      breakSurvived: s.catchKm === null,
    },
    endsAt: s.endsAt,
  };
}

/**
 * Per-player stats for one event (the whole game; readers cut it at "now").
 * TODO(players): attribute every stat to roster players. Until then nobody scores.
 */
export function cyclingGameStats(meta: EventMeta): GameStats {
  return emptyGameStats(meta);
}
