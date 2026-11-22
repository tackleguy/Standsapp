// Picks the right simulator for each sport.
import type { EventMeta, EventState } from '../../types';
import { planFor } from '../plans';
import { simulateBaseball } from './baseball';
import { simulateCombat } from './combat';
import { simulateCricket } from './cricket';
import { simulateCycling } from './cycling';
import { simulateGolf } from './golf';
import { simulateH2H } from './h2h';
import { simulateRace } from './race';
import { simulateTennis } from './tennis';

export function simulate(meta: EventMeta, now: number): EventState {
  switch (planFor(meta.sportId)?.engine) {
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
