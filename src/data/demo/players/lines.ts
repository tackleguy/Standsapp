// Adding up a game's stat events into per-player lines and fantasy points.
import { fantasyPoints } from '@/logic/fantasy';

import { sportStats } from './sports';
import type { GameStats, StatEvent, StatLine } from './types';

/** Adds one event's stats into a line (in place). Max keys keep the biggest value. */
export function addInto(line: StatLine, add: StatLine, maxKeys: readonly string[] = []): StatLine {
  for (const key of Object.keys(add)) {
    const v = add[key];
    if (maxKeys.includes(key)) line[key] = Math.max(line[key] ?? 0, v);
    else line[key] = (line[key] ?? 0) + v;
  }
  return line;
}

/** Every player's line from the events up to and including `upTo`. */
export function linesUpTo(sportId: string, events: StatEvent[], upTo = Number.MAX_SAFE_INTEGER): Map<string, StatLine> {
  const maxKeys = sportStats(sportId).maxKeys ?? [];
  const out = new Map<string, StatLine>();
  for (const e of events) {
    if (e.at > upTo) break;
    let line = out.get(e.playerId);
    if (!line) { line = {}; out.set(e.playerId, line); }
    addInto(line, e.stats, maxKeys);
  }
  return out;
}

/** One player's line up to `upTo`. */
export function lineOf(sportId: string, gs: GameStats, playerId: string, upTo = Number.MAX_SAFE_INTEGER): StatLine {
  const maxKeys = sportStats(sportId).maxKeys ?? [];
  const line: StatLine = {};
  for (const e of gs.events) {
    if (e.at > upTo) break;
    if (e.playerId === playerId) addInto(line, e.stats, maxKeys);
  }
  return line;
}

/** Fantasy points for a line in a sport. */
export function pointsOf(sportId: string, line: StatLine): number {
  return fantasyPoints(sportStats(sportId).fantasy, line);
}

/** A player's fantasy points in each period, up to `upTo`. */
export function pointsByPeriod(sportId: string, gs: GameStats, playerId: string, upTo = Number.MAX_SAFE_INTEGER): number[] {
  const def = sportStats(sportId);
  const out = gs.periods.map(() => 0);
  for (const e of gs.events) {
    if (e.at > upTo) break;
    if (e.playerId !== playerId || e.period < 0 || e.period >= out.length) continue;
    out[e.period] += fantasyPoints(def.fantasy, e.stats);
  }
  return out.map((v) => Math.round(v * 100) / 100);
}
