// Every sport's stat and fantasy definitions, by sport id.
import type { SportStatsDef } from '../types';
import { baseball, cricket } from './batAndBall';
import { football } from './football';
import { boxing, cycling, f1, golf, indycar, mma, motogp, tennis } from './individual';
import { aussieRules, basketball, iceHockey, netball, rugbyLeague, rugbyUnion, soccer } from './teamSports';

export const SPORT_STATS: Record<string, SportStatsDef> = Object.fromEntries([
  football, soccer, basketball, iceHockey, rugbyUnion, rugbyLeague, aussieRules, netball,
  baseball, cricket, f1, motogp, indycar, cycling, golf, tennis, mma, boxing,
].map((d) => [d.sportId, d]));

export function sportStats(sportId: string): SportStatsDef {
  const def = SPORT_STATS[sportId];
  if (!def) throw new Error(`No stat definitions for sport ${sportId}`);
  return def;
}
