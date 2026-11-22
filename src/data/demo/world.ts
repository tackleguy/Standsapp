// Builds every competition, team, and athlete in the demo world, once.
import { SPORTS } from '@/config/sports';
import { createRng, hashText } from '@/lib/random';

import type { Competition, Competitor } from '../types';
import {
  CITIES, CYCLING_TEAMS, FIRST_NAMES, NATIONS, NICKNAMES, RACING_TEAMS, SURNAMES, VENUE_WORDS,
} from './names';
import { PLANS, type SportPlan } from './plans';

export interface World {
  competitions: Competition[];
  competitors: Competitor[];
  byId: Map<string, Competitor>;
  competitionById: Map<string, Competition>;
  bySport: Map<string, Competitor[]>;
}

let cached: World | null = null;

function teamCode(city: string, nickname: string, taken: Set<string>): string {
  const words = city.split(' ');
  const base = (words.length > 1 ? words.map((w) => w[0]).join('') + nickname[0] : city.slice(0, 3)).toUpperCase();
  let code = base.slice(0, 3);
  let i = 0;
  while (taken.has(code)) {
    i++;
    code = (city.slice(0, 2) + nickname[i % nickname.length]).toUpperCase().replace(/\s/g, 'X');
    if (i > 8) code = `${city[0]}${i}${nickname[0]}`.toUpperCase();
  }
  taken.add(code);
  return code;
}

function personCode(surname: string, taken: Set<string>): string {
  let code = surname.slice(0, 3).toUpperCase();
  let i = 3;
  while (taken.has(code) && i < surname.length) {
    code = (surname.slice(0, 2) + surname[i]).toUpperCase();
    i++;
  }
  if (taken.has(code)) code = `${surname[0]}${taken.size % 10}${surname[1]}`.toUpperCase();
  taken.add(code);
  return code;
}

function buildTeams(plan: SportPlan, count: number, compIds: string[]): Competitor[] {
  const rng = createRng(`teams:${plan.sportId}`);
  const cities = rng.shuffle(CITIES);
  const nicknames = NICKNAMES[plan.sportId] ?? NICKNAMES.soccer;
  const codes = new Set<string>();
  const teams: Competitor[] = [];
  for (let i = 0; i < count; i++) {
    const city = cities[i % cities.length];
    const nickname = nicknames[i % nicknames.length];
    const name = nickname === 'FC' ? `${city} FC` : `${city} ${nickname}`;
    teams.push({
      id: `${plan.sportId}.t${i}`,
      sportId: plan.sportId,
      kind: 'team',
      name,
      shortName: teamCode(city, nickname, codes),
      parentId: null,
      colors: null,
      competitionId: compIds[i % compIds.length],
      strength: Math.round(rng.float(0.25, 0.95) * 100) / 100,
      home: city,
    });
  }
  return teams;
}

function buildAthletes(plan: SportPlan, count: number, compIds: string[]): Competitor[] {
  const rng = createRng(`athletes:${plan.sportId}`);
  const out: Competitor[] = [];
  const codes = new Set<string>();
  const usedNames = new Set<string>();
  const roster = plan.roster.kind === 'athletes' ? plan.roster : null;
  const teamPool = roster?.teams === 'racing' ? RACING_TEAMS : roster?.teams === 'cycling' ? CYCLING_TEAMS : null;
  const perTeam = roster?.perTeam ?? 2;
  const teamIds: string[] = [];

  if (teamPool) {
    const teamCount = Math.ceil(count / perTeam);
    const teamNames = rng.shuffle(teamPool).slice(0, teamCount);
    teamNames.forEach((name, i) => {
      const id = `${plan.sportId}.c${i}`;
      teamIds.push(id);
      out.push({
        id, sportId: plan.sportId, kind: 'team', name,
        shortName: teamCode(name, name.split(' ')[1] ?? 'X', codes),
        parentId: null, colors: null, competitionId: compIds[0],
        strength: Math.round(rng.float(0.3, 0.95) * 100) / 100,
        home: rng.pick(NATIONS),
      });
    });
  }

  for (let i = 0; i < count; i++) {
    let first = rng.pick(FIRST_NAMES);
    let last = rng.pick(SURNAMES);
    while (usedNames.has(`${first} ${last}`) || usedNames.has(last)) {
      first = rng.pick(FIRST_NAMES);
      last = rng.pick(SURNAMES);
    }
    usedNames.add(`${first} ${last}`);
    usedNames.add(last);
    const parentId = teamIds.length > 0 ? teamIds[Math.floor(i / perTeam) % teamIds.length] : null;
    const parent = parentId ? out.find((c) => c.id === parentId) : null;
    const base = rng.float(0.2, 0.95);
    // Drivers in strong cars go faster: blend personal skill with the team's.
    const strength = parent ? base * 0.45 + parent.strength * 0.55 : base;
    out.push({
      id: `${plan.sportId}.a${i}`,
      sportId: plan.sportId,
      kind: 'athlete',
      name: `${first} ${last}`,
      shortName: personCode(last, codes),
      parentId,
      colors: null,
      competitionId: compIds[i % compIds.length],
      strength: Math.round(strength * 100) / 100,
      home: rng.pick(NATIONS),
    });
  }
  return out;
}

export function getWorld(): World {
  if (cached) return cached;
  const competitions: Competition[] = [];
  const competitors: Competitor[] = [];

  for (const plan of PLANS) {
    if (!SPORTS.some((s) => s.id === plan.sportId)) continue;
    const compIds = plan.competitions.map((c, i) => {
      const id = `${plan.sportId}.comp${i}`;
      competitions.push({ id, sportId: plan.sportId, name: c.name, short: c.short });
      return id;
    });
    if (plan.roster.kind === 'teams') competitors.push(...buildTeams(plan, plan.roster.count, compIds));
    else competitors.push(...buildAthletes(plan, plan.roster.count, compIds));
  }

  const byId = new Map(competitors.map((c) => [c.id, c]));
  const competitionById = new Map(competitions.map((c) => [c.id, c]));
  const bySport = new Map<string, Competitor[]>();
  for (const c of competitors) {
    const list = bySport.get(c.sportId) ?? [];
    list.push(c);
    bySport.set(c.sportId, list);
  }
  cached = { competitions, competitors, byId, competitionById, bySport };
  return cached;
}

export function competitorById(id: string | null | undefined): Competitor | undefined {
  return id ? getWorld().byId.get(id) : undefined;
}

/** The teams or athletes who actually take part in events for a sport. */
export function participantsFor(sportId: string): Competitor[] {
  const list = getWorld().bySport.get(sportId) ?? [];
  const hasAthletes = list.some((c) => c.kind === 'athlete');
  return hasAthletes ? list.filter((c) => c.kind === 'athlete') : list;
}

/** Stable home venue for a team. */
export function venueFor(team: Competitor): string {
  return `${team.home} ${VENUE_WORDS[hashText(team.id) % VENUE_WORDS.length]}`;
}

/** Invented squad names for a team (used for scorers, batters, and so on). */
export function squadFor(teamId: string, size: number): string[] {
  const rng = createRng(`squad:${teamId}`);
  const names = new Set<string>();
  while (names.size < size) {
    names.add(`${rng.pick(FIRST_NAMES)[0]}. ${rng.pick(SURNAMES)}`);
  }
  return [...names];
}
