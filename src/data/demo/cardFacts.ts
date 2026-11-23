// What is printed on a Stand Card, modelled on real trading cards:
// - an overall rating and six sport-specific attributes (like EA FC Ultimate Team cards),
// - a role, a checklist number within the set and an RC mark for rookies (like Topps),
// - "in form" boosts when a team or athlete is on a run (like FC In-Forms and Sorare),
// - circulation: how many copies of a numbered card exist so far (like NBA Top Shot).
// Everything is seeded, so every phone prints the same card.
import { sportById } from '@/config/sports';
import { createRng, hashText } from '@/lib/random';
import { mintKey } from '@/logic/packs';
import { printRun } from '@/logic/rules';

import type { CardFinish, CardRarity, Competitor } from '../types';
import { mintedBefore, SEASON, setMembers } from './cards';
import { planFor } from './plans';
import { championshipRow, standingsKind, teamRow } from './season';
import { competitorById } from './world';

/** The set every card belongs to, printed on both sides. */
export const SET_NAME = `Stands ${SEASON} · Series 1`;
export const SET_LOGO = `STANDS '${SEASON.slice(2)}`;

// Six attributes per sport. Clubs get team ratings; athletes get personal ones.
const TEAM_ATTRS: Record<string, string[]> = {
  soccer: ['ATT', 'MID', 'DEF', 'GK', 'PAC', 'PHY'],
  basketball: ['OFF', 'DEF', '3PT', 'REB', 'PACE', 'BNCH'],
  american_football: ['PASS', 'RUSH', 'OL', 'DEF', 'PRSH', 'ST'],
  rugby_union: ['ATT', 'DEF', 'SCRM', 'LINE', 'KICK', 'FIT'],
  rugby_league: ['ATT', 'DEF', 'KICK', 'SPD', 'FIT', 'EDGE'],
  ice_hockey: ['OFF', 'DEF', 'GOAL', 'PP', 'PK', 'SKT'],
  baseball: ['CON', 'POW', 'SPD', 'FLD', 'ARM', 'PIT'],
  cricket: ['BAT', 'PACE', 'SPIN', 'FLD', 'POW', 'DTH'],
  aussie_rules: ['KICK', 'MARK', 'TKL', 'SPD', 'CTR', 'FIT'],
  netball: ['SHOT', 'FEED', 'DEF', 'CTR', 'SPD', 'INT'],
  // Racing and cycling teams.
  f1: ['CHS', 'ENG', 'AERO', 'PIT', 'STR', 'REL'],
  motogp: ['CHS', 'ENG', 'AERO', 'PIT', 'STR', 'REL'],
  indycar: ['CHS', 'ENG', 'AERO', 'PIT', 'STR', 'REL'],
  cycling: ['CLB', 'SPR', 'TT', 'END', 'DSC', 'TAC'],
};

const ATHLETE_ATTRS: Record<string, string[]> = {
  f1: ['PACE', 'RACE', 'QUAL', 'TYRE', 'WET', 'CONS'],
  motogp: ['PACE', 'RACE', 'QUAL', 'TYRE', 'WET', 'CONS'],
  indycar: ['PACE', 'RACE', 'QUAL', 'TYRE', 'OVAL', 'CONS'],
  tennis: ['SRV', 'RET', 'FHD', 'BHD', 'MOV', 'MNT'],
  golf: ['DRV', 'APP', 'SHT', 'PUT', 'ACC', 'MNT'],
  mma: ['STR', 'GRP', 'SUB', 'CRD', 'CHN', 'POW'],
  boxing: ['JAB', 'POW', 'DEF', 'SPD', 'CHN', 'CRD'],
  cycling: ['CLB', 'SPR', 'TT', 'END', 'DSC', 'TAC'],
};

const ATHLETE_ROLE: Record<string, string> = {
  f1: 'Driver', indycar: 'Driver', motogp: 'Rider', cycling: 'Rider', tennis: 'Player',
  golf: 'Golfer', mma: 'Fighter', boxing: 'Boxer',
};

/** "Club", "Driver", "Fighter"... printed under the rating. */
export function cardRole(c: Competitor): string {
  if (c.kind === 'athlete') return ATHLETE_ROLE[c.sportId] ?? 'Athlete';
  const hasAthletes = c.sportId in ATHLETE_ATTRS;
  return hasAthletes ? 'Team' : 'Club';
}

/** Overall rating 60-96, from how good they really are in the simulator. */
export function baseRating(c: Competitor): number {
  return Math.max(60, Math.min(96, Math.round(60 + c.strength * 37)));
}

export interface CardAttribute { label: string; value: number }

/** Six attributes that average out close to the overall rating. */
export function cardAttributes(c: Competitor): CardAttribute[] {
  const labels = (c.kind === 'athlete' ? ATHLETE_ATTRS[c.sportId] : TEAM_ATTRS[c.sportId]) ?? ['ATT', 'DEF', 'SPD', 'SKL', 'FIT', 'MNT'];
  const ovr = baseRating(c);
  const rng = createRng(`attrs:${c.id}`);
  const raw = labels.map(() => rng.float(-11, 9));
  const mean = raw.reduce((a, b) => a + b, 0) / raw.length;
  return labels.map((label, i) => ({ label, value: Math.max(35, Math.min(99, Math.round(ovr + raw[i] - mean))) }));
}

/** Rookie cards (RC): about one athlete in six is in their first season. */
export function isRookie(c: Competitor): boolean {
  return c.kind === 'athlete' && hashText(`rc:${c.id}`) % 6 === 0;
}

export interface InForm { boost: number; reason: string }

/**
 * Cards upgrade while their team or athlete is on a run, like In-Form cards:
 * three wins in a row is +1, four is +2, five or more is +3; a race win is +2.
 */
export function inForm(c: Competitor, now: number): InForm | null {
  const kind = standingsKind(c.sportId);
  if (kind === 'table' || kind === 'pct') {
    const row = teamRow(c.id, now);
    const m = row ? /^W(\d+)$/.exec(row.streak) : null;
    const wins = m ? Number(m[1]) : 0;
    return wins >= 3 ? { boost: Math.min(3, wins - 2), reason: `${wins} wins in a row` } : null;
  }
  if (kind === 'championship') {
    const recent = championshipRow(c.id, now)?.recent ?? [];
    const last = recent.length > 0 ? recent[recent.length - 1] : undefined;
    if (last === 1) return { boost: 2, reason: 'Won the last round' };
    if (last !== undefined && last <= 3) return { boost: 1, reason: `P${last} in the last round` };
  }
  return null;
}

/** The checklist number, like "PFL-07": the league's code and the card's place in the set. */
export function checklistCode(c: Competitor): string {
  const code = planFor(c.sportId)?.competitions[0]?.short ?? (sportById(c.sportId)?.name.slice(0, 3).toUpperCase() ?? 'STD');
  const n = setMembers(c.sportId).findIndex((m) => m.id === c.id) + 1;
  return `${code}-${String(Math.max(1, n)).padStart(2, '0')}`;
}

export interface CardFace {
  competitor: Competitor;
  role: string;
  rating: number;
  form: InForm | null;
  attributes: CardAttribute[];
  rookie: boolean;
  checklist: string;
}

/** Everything printed on the front of a card. */
export function cardFace(competitorId: string, now: number): CardFace | null {
  const c = competitorById(competitorId);
  if (!c) return null;
  const form = inForm(c, now);
  return {
    competitor: c, role: cardRole(c), rating: baseRating(c) + (form?.boost ?? 0), form,
    attributes: cardAttributes(c), rookie: isRookie(c), checklist: checklistCode(c),
  };
}

/** How many copies of this exact card have been pulled so far, and the most there will ever be. */
export function circulation(templateId: string, finish: CardFinish, eventId: string | null, mintCounts: Record<string, number>):
  { minted: number; run: number | null } {
  const rarity = templateId.split(':')[1] as CardRarity;
  const key = mintKey(templateId, finish, eventId);
  return { minted: mintCounts[key] ?? mintedBefore(key), run: printRun(rarity, finish, !!eventId) };
}

/** A printer's code for the fine print on the back, like "S26-PFL07-HR". */
export function productionCode(c: Competitor, rarity: CardRarity, finish: CardFinish, gameDay: boolean): string {
  return `S${SEASON.slice(2)}-${checklistCode(c).replace('-', '')}-${finish === 'holo' ? 'H' : gameDay ? 'G' : 'B'}${rarity[0].toUpperCase()}`;
}
