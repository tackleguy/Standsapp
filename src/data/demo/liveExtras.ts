// Extras for the live game screen: win probability now and over the game,
// the crowd's pick, scorers and cards. All derived from the simulators, so they
// always agree with the score.
import { createRng, hashText } from '@/lib/random';
import {
  asPercents, pregameProbability, sportHasDraws, winProbabilityFor, type ProbabilityContext, type WinProb,
} from '@/logic/winProbability';

import type { EventMeta, EventState } from '../types';
import { simulate } from './engines';
import { H2H_CONFIGS } from './engines/h2hSports';
import { competitorById } from './world';

export function probabilityContext(sportId: string): ProbabilityContext {
  return {
    strength: (id) => competitorById(id)?.strength ?? 0.5,
    homeEdge: H2H_CONFIGS[sportId]?.homeEdge ?? 0.04,
  };
}

/** Win probability right now; null for races and fields. */
export function eventWinProbability(state: EventState): WinProb | null {
  return winProbabilityFor(state, probabilityContext(state.meta.sportId));
}

export interface WinPoint {
  /** 0 at the start, 1 at the finish. */
  t: number;
  home: number;
  draw: number;
  away: number;
}

export interface WinMarker {
  t: number;
  playId: string;
  competitorId: string | null;
  tag: string | null;
  clock: string;
}

const SAMPLES = 60;
const sampleCache = new Map<string, WinPoint>();

function sampleAt(meta: EventMeta, at: number, start: number, span: number, key: string): WinPoint | null {
  const hit = sampleCache.get(key);
  if (hit) return hit;
  const p = eventWinProbability(simulate(meta, at));
  if (!p) return null;
  const point = { t: Math.min(1, Math.max(0, (at - start) / span)), ...p };
  sampleCache.set(key, point);
  if (sampleCache.size > 5000) sampleCache.delete(sampleCache.keys().next().value as string);
  return point;
}

const MARKER_SKIP = new Set(['START', 'FINAL', 'PERIOD', 'HALF', 'OVER', 'ROUND', 'ROUND_END', 'INNINGS', 'GAP', 'TOSS']);

/**
 * Win probability through the game so far, plus markers for the big moments.
 * Past samples never change, so each one is computed once and remembered.
 */
export function winProbabilitySeries(state: EventState, now: number): { points: WinPoint[]; markers: WinMarker[] } | null {
  const { meta } = state;
  if (meta.format === 'race' || state.status === 'scheduled' || meta.disruption) return null;
  const start = meta.startsAt;
  const end = state.endsAt;
  const span = Math.max(1, end - start);
  const upTo = Math.min(now, end);
  const points: WinPoint[] = [];
  const pre = pregameProbability(meta.sportId, competitorById(meta.competitorIds[0])?.strength ?? 0.5,
    competitorById(meta.competitorIds[1])?.strength ?? 0.5, probabilityContext(meta.sportId).homeEdge);
  const first = eventWinProbability(simulate(meta, start - 1));
  points.push({ t: 0, ...(first ?? pre) });
  const times = new Set<number>();
  for (let i = 1; i <= SAMPLES; i++) {
    const at = start + (span * i) / SAMPLES;
    if (at <= upTo) times.add(Math.round(at));
  }
  // Extra samples just after scores, so the line jumps where the game turned.
  for (const p of state.plays) {
    if (p.importance >= 2 && p.scoreAfter && p.at > start && p.at <= upTo) times.add(p.at + 1);
  }
  for (const at of [...times].sort((a, b) => a - b)) {
    const pt = sampleAt(meta, at, start, span, `${meta.id}:${at}`);
    if (pt) points.push(pt);
  }
  if (state.status === 'live') {
    const nowP = eventWinProbability(state);
    if (nowP) points.push({ t: Math.min(1, (now - start) / span), ...nowP });
  }
  const markers: WinMarker[] = state.plays
    .filter((p) => p.importance === 3 && !MARKER_SKIP.has(p.tag ?? ''))
    .map((p) => ({ t: Math.min(1, Math.max(0, (p.at - start) / span)), playId: p.id, competitorId: p.competitorId, tag: p.tag, clock: p.clock }));
  return { points, markers };
}

/**
 * Who Stands fans are backing, in whole percentages. Follows the odds, with a
 * pull toward the bigger club and a little seeded noise.
 */
export function crowdPick(meta: EventMeta): { home: number; draw: number; away: number; votes: number } | null {
  if (meta.format === 'race' || meta.competitorIds.length !== 2) return null;
  const [h, a] = meta.competitorIds;
  const p = pregameProbability(meta.sportId, competitorById(h)?.strength ?? 0.5, competitorById(a)?.strength ?? 0.5,
    probabilityContext(meta.sportId).homeEdge);
  const rng = createRng(`pick:${meta.id}`);
  const lean = rng.float(-0.08, 0.08);
  const draws = sportHasDraws(meta.sportId);
  // Fans over-back favourites and under-back draws.
  const home = Math.max(0.03, Math.pow(p.home, 0.8) + lean);
  const away = Math.max(0.03, Math.pow(p.away, 0.8) - lean);
  const draw = draws ? p.draw * 0.6 : 0;
  const total = home + away + draw;
  const pct = asPercents({ home: home / total, draw: draw / total, away: away / total }, draws);
  return { ...pct, votes: 140 + (hashText(meta.id) % 2600) };
}

const SCORING_TAGS = new Set(['GOAL', 'TRY', 'TD', 'HR', 'WALKOFF', 'DROP', 'FG', 'SUPER']);
const NAME = /\b([A-Z]\. [A-Z][A-Za-z'’-]+)/;

export interface Scorer {
  name: string;
  clock: string;
  tag: string;
}

/** Scorers per side (from the play-by-play), for under the scoreboard. */
export function scorersFor(state: EventState): [Scorer[], Scorer[]] {
  const [homeId, awayId] = state.meta.competitorIds;
  const out: [Scorer[], Scorer[]] = [[], []];
  // Big-scoring sports would list dozens of names: only the headline scores count.
  const tags = state.meta.sportId === 'basketball' || state.meta.sportId === 'netball' || state.meta.sportId === 'aussie_rules'
    ? new Set<string>() : SCORING_TAGS;
  for (const p of state.plays) {
    if (!p.tag || !tags.has(p.tag) || !p.competitorId) continue;
    if (state.meta.sportId === 'american_football' && p.tag === 'FG') continue;
    const name = NAME.exec(p.description)?.[1];
    if (!name) continue;
    if (p.competitorId === homeId) out[0].push({ name, clock: p.clock, tag: p.tag });
    else if (p.competitorId === awayId) out[1].push({ name, clock: p.clock, tag: p.tag });
  }
  return out;
}

/** Red cards (soccer) shown on each side of the scoreboard. */
export function redCardsFor(state: EventState): [number, number] {
  const [homeId, awayId] = state.meta.competitorIds;
  const count = (id: string) => state.plays.filter((p) => p.tag === 'RED' && p.competitorId === id).length;
  return [count(homeId), count(awayId)];
}
