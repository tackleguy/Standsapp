// Picks the right simulator for each sport.
import type { EventMeta, EventState } from '../../types';
import { planFor } from '../plans';
import type { GameStats } from '../players/types';
import { baseballGameStats, simulateBaseball } from './baseball';
import { combatGameStats, simulateCombat } from './combat';
import { cachedScript, emptyGameStats } from './common';
import { cricketGameStats, simulateCricket } from './cricket';
import { footballClock, footballGameStats, simulateFootball } from './football';
import { cyclingGameStats, simulateCycling } from './cycling';
import { golfGameStats, simulateGolf } from './golf';
import { h2hClock, h2hGameStats, simulateH2H } from './h2h';
import { raceGameStats, simulateRace } from './race';
import { simulateTennis, tennisGameStats } from './tennis';

export function simulate(meta: EventMeta, now: number): EventState {
  switch (planFor(meta.sportId)?.engine) {
    case 'football': return simulateFootball(meta, now);
    case 'cricket': return simulateCricket(meta, now);
    case 'race': return simulateRace(meta, now);
    case 'golf': return simulateGolf(meta, now);
    case 'cycling': return simulateCycling(meta, now);
    case 'tennis': return simulateTennis(meta, now);
    case 'combat': return simulateCombat(meta, now);
    case 'baseball': return simulateBaseball(meta, now);
    default: return simulateH2H(meta, now);
  }
}

/** The finished state: used to settle Calls. */
export function finalState(meta: EventMeta): EventState {
  return simulate(meta, Number.MAX_SAFE_INTEGER);
}

/**
 * The game clock right now, for scoreboards that tick every second between data
 * refreshes. Always the engine's own clock, never an invented one. Null when the
 * sport has no running clock (the period label is used instead).
 */
export function liveClock(meta: EventMeta, now: number): string | null {
  const engine = planFor(meta.sportId)?.engine;
  if (engine === 'h2h') return h2hClock(meta, now);
  if (engine === 'football') return footballClock(meta, now);
  if (engine === 'combat') {
    const s = simulateCombat(meta, now);
    return s.status === 'live' ? s.periodLabel : null;
  }
  return null;
}

/**
 * Every player's stats for an event, as timed stat events over the whole game.
 * Readers cut it at "now" (see players/lines.ts). Same seed, same stats: it always
 * agrees with the score and the play-by-play.
 */
export function gameStatsFor(meta: EventMeta): GameStats {
  if (meta.disruption) return emptyGameStats(meta);
  return cachedScript(`stats:${meta.id}`, () => {
    switch (planFor(meta.sportId)?.engine) {
      case 'football': return footballGameStats(meta);
      case 'cricket': return cricketGameStats(meta);
      case 'race': return raceGameStats(meta);
      case 'golf': return golfGameStats(meta);
      case 'cycling': return cyclingGameStats(meta);
      case 'tennis': return tennisGameStats(meta);
      case 'combat': return combatGameStats(meta);
      case 'baseball': return baseballGameStats(meta);
      default: return h2hGameStats(meta);
    }
  });
}
