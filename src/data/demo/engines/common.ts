// Shared helpers for every demo simulator.
import type { EntryState, EventMeta, EventState, EventStatus, Importance, Play, StatsSection } from '../../types';
import { competitorById } from '../world';

/** A play on the full script timeline, before we cut it at "now". */
export interface TimedPlay {
  at: number;
  clock: string;
  description: string;
  competitorId: string | null;
  importance: Importance;
  tag: string | null;
  scoreAfter: string | null;
}

const scriptCache = new Map<string, unknown>();

/** Scripts are expensive-ish to build, so keep the most recent few hundred. */
export function cachedScript<T>(key: string, build: () => T): T {
  const hit = scriptCache.get(key);
  if (hit !== undefined) return hit as T;
  const value = build();
  scriptCache.set(key, value);
  if (scriptCache.size > 600) {
    const oldest = scriptCache.keys().next().value as string;
    scriptCache.delete(oldest);
  }
  return value;
}

export function statusAt(meta: EventMeta, endsAt: number, now: number): EventStatus {
  if (meta.disruption) return meta.disruption;
  if (now < meta.startsAt) return 'scheduled';
  if (now >= endsAt) return 'finished';
  return 'live';
}

export function progressAt(meta: EventMeta, endsAt: number, now: number): number {
  if (now <= meta.startsAt) return 0;
  if (now >= endsAt) return 1;
  return (now - meta.startsAt) / Math.max(1, endsAt - meta.startsAt);
}

/** Cuts the timeline at `now` and gives each play a stable sequence number. */
export function playsUpTo(meta: EventMeta, timeline: TimedPlay[], now: number): Play[] {
  const out: Play[] = [];
  timeline.forEach((p, i) => {
    if (p.at > now) return;
    out.push({
      id: `${meta.id}#${i + 1}`,
      eventId: meta.id,
      seq: i + 1,
      at: p.at,
      clock: p.clock,
      description: p.description,
      competitorId: p.competitorId,
      importance: p.importance,
      tag: p.tag,
      scoreAfter: p.scoreAfter,
    });
  });
  return out;
}

export function sortTimeline(timeline: TimedPlay[]): TimedPlay[] {
  return timeline.sort((a, b) => a.at - b.at);
}

/** Entries for an event that has not started (or will not). */
export function blankEntries(meta: EventMeta): EntryState[] {
  const isRace = meta.format === 'race';
  return meta.competitorIds.map((id, i) => ({
    competitorId: id,
    role: isRace ? 'entrant' : i === 0 ? 'home' : 'away',
    score: null,
    scoreText: null,
    position: null,
    isWinner: null,
    note: null,
  }));
}

/** A state for postponed or cancelled events. */
export function disruptedState(meta: EventMeta): EventState {
  const word = meta.disruption === 'cancelled' ? 'cancelled' : 'postponed';
  return {
    meta,
    status: meta.disruption ?? 'postponed',
    periodLabel: null,
    progress: 0,
    entries: blankEntries(meta),
    plays: [],
    stats: [{ type: 'note', title: 'Status', text: `This event has been ${word}. Any Calls on it are refunded.` }],
    resultText: meta.disruption === 'cancelled' ? 'Cancelled' : 'Postponed',
    facts: {},
    endsAt: meta.startsAt,
  };
}

export function nameOf(id: string | null | undefined): string {
  return competitorById(id)?.name ?? 'Unknown';
}

export function shortOf(id: string | null | undefined): string {
  return competitorById(id)?.shortName ?? '?';
}

export function strengthOf(id: string | null | undefined): number {
  return competitorById(id)?.strength ?? 0.5;
}

/** Fill "{team} {player} {opp}"-style templates. */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');
}

/** "4:12" from minutes remaining. */
export function mmss(minutes: number): string {
  const total = Math.max(0, Math.round(minutes * 60));
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export function preMatchNote(meta: EventMeta): StatsSection {
  return {
    type: 'note',
    title: 'Before the start',
    text: 'Stats appear here once the action begins. Make your Calls before the start for the best multipliers.',
  };
}

/** Win probability -> fair-ish multiplier with a small house edge, never below 1.05. */
export function priceFromProbability(p: number): number {
  const clamped = Math.min(0.97, Math.max(0.02, p));
  return Math.max(1.05, Math.round((0.92 / clamped) * 100) / 100);
}

/** Softmax-style win chances from strengths. */
export function winChances(strengths: number[], sharpness = 6): number[] {
  const weights = strengths.map((s) => Math.exp(s * sharpness));
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => w / sum);
}
