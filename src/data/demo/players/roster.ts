// Every player in the demo world. Team sports get a named roster per team, built
// from a seed so it is the same on every phone; individual sports use their
// athletes as players. All names are invented.
import { createRng, hashText } from '@/lib/random';

import type { Competitor } from '../../types';
import { FIRST_NAMES, SURNAMES } from '../names';
import { competitorById, getWorld } from '../world';
import { SPORT_STATS } from './sports';
import type { Player } from './types';

interface SportRoster {
  players: Player[];
  byTeam: Map<string, Player[]>;
}

const cache = new Map<string, SportRoster>();
const byId = new Map<string, Player>();

const SUFFIX_SPORTS = new Set(['american_football', 'basketball', 'baseball']);
const HYPHEN_SPORTS = new Set(['american_football', 'basketball', 'soccer', 'netball']);
const WOMEN_SPORTS = new Set(['netball']);
const SUFFIXES = ['Jr.', 'II', 'III'] as const;

function athletePlayer(c: Competitor): Player {
  const def = SPORT_STATS[c.sportId];
  const h = hashText(`athlete:${c.id}`);
  return {
    id: c.id,
    sportId: c.sportId,
    teamId: c.parentId,
    sideId: c.id,
    name: c.name,
    short: shortName(c.name),
    pos: def?.athletePos?.pos ?? 'Athlete',
    posLabel: def?.athletePos?.label ?? 'Athlete',
    number: c.parentId ? 2 + (h % 97) : null,
    skill: c.strength,
    depth: 1,
    athlete: true,
    rookie: h % 9 === 0,
  };
}

/** "Arlo Okoro" -> "A. Okoro"; keeps suffixes ("T. Byard III"). */
export function shortName(name: string): string {
  const [first, ...rest] = name.split(' ');
  return rest.length ? `${first[0]}. ${rest.join(' ')}` : name;
}

function buildTeamRosters(sportId: string): SportRoster {
  const def = SPORT_STATS[sportId];
  const teams = (getWorld().bySport.get(sportId) ?? []).filter((c) => c.kind === 'team');
  const rng = createRng(`roster:${sportId}`);
  const firstPool = WOMEN_SPORTS.has(sportId) ? FIRST_NAMES.slice(FIRST_NAMES.indexOf('Ines')) : FIRST_NAMES;
  const usedNames = new Set<string>();
  const players: Player[] = [];
  const byTeam = new Map<string, Player[]>();

  for (const team of teams) {
    const list: Player[] = [];
    const usedNumbers = new Set<number>();
    const usedShort = new Set<string>();
    let index = 0;
    for (const slot of def.positions) {
      const starters = slot.starters ?? slot.count;
      for (let k = 0; k < slot.count; k++) {
        let name = '';
        for (let tries = 0; tries < 40; tries++) {
          const first = rng.pick(firstPool);
          let last: string = rng.pick(SURNAMES);
          if (HYPHEN_SPORTS.has(sportId) && rng.chance(0.05)) last = `${last}-${rng.pick(SURNAMES)}`;
          if (SUFFIX_SPORTS.has(sportId) && rng.chance(0.06)) last = `${last} ${rng.pick(SUFFIXES)}`;
          name = `${first} ${last}`;
          if (!usedNames.has(name) && !usedShort.has(shortName(name))) break;
        }
        usedNames.add(name);
        usedShort.add(shortName(name));
        const [lo, hi] = slot.numbers;
        let number = rng.int(lo, hi);
        for (let tries = 0; usedNumbers.has(number) && tries < 30; tries++) number = rng.int(lo, hi);
        for (let x = 0; usedNumbers.has(number) && x < 100; x++) number = (number + 1) % 100;
        usedNumbers.add(number);
        const starter = k < starters;
        const individual = rng.float(0.2, 0.95);
        const skill = Math.round(Math.min(0.99, team.strength * 0.45 + individual * 0.55 + (starter ? 0.06 : -0.04)) * 100) / 100;
        const player: Player = {
          id: `${team.id}.p${index}`,
          sportId,
          teamId: team.id,
          sideId: team.id,
          name,
          short: shortName(name),
          pos: slot.pos,
          posLabel: slot.label,
          number,
          skill,
          depth: starter ? 1 : 2,
          athlete: false,
          rookie: rng.chance(0.12),
        };
        index++;
        list.push(player);
        players.push(player);
        byId.set(player.id, player);
      }
    }
    byTeam.set(team.id, list);
  }
  return { players, byTeam };
}

function buildAthletes(sportId: string): SportRoster {
  const athletes = (getWorld().bySport.get(sportId) ?? []).filter((c) => c.kind === 'athlete');
  const players = athletes.map(athletePlayer);
  const byTeam = new Map<string, Player[]>();
  for (const p of players) {
    byId.set(p.id, p);
    if (p.teamId) byTeam.set(p.teamId, [...(byTeam.get(p.teamId) ?? []), p]);
  }
  return { players, byTeam };
}

function sportRoster(sportId: string): SportRoster {
  const hit = cache.get(sportId);
  if (hit) return hit;
  const def = SPORT_STATS[sportId];
  const built = !def ? { players: [], byTeam: new Map() } : def.positions.length > 0 ? buildTeamRosters(sportId) : buildAthletes(sportId);
  cache.set(sportId, built);
  return built;
}

/** Every player in a sport, team by team in depth-chart order. */
export function playersForSport(sportId: string): Player[] {
  return sportRoster(sportId).players;
}

/** A team's roster in depth-chart order (starters of each position first). For racing/cycling teams, its athletes. */
export function rosterFor(teamId: string): Player[] {
  const team = competitorById(teamId);
  if (!team) return [];
  return sportRoster(team.sportId).byTeam.get(teamId) ?? [];
}

/** A team's starters only. */
export function startersFor(teamId: string): Player[] {
  return rosterFor(teamId).filter((p) => p.depth === 1);
}

/** The players who take part for one side of an event: a team's roster, or the athlete. */
export function playersForSide(competitorId: string): Player[] {
  const c = competitorById(competitorId);
  if (!c) return [];
  if (c.kind === 'athlete') return [playerById(c.id)].filter((p): p is Player => !!p);
  return rosterFor(c.id);
}

export function playerById(id: string | null | undefined): Player | undefined {
  if (!id) return undefined;
  const hit = byId.get(id);
  if (hit) return hit;
  const sportId = id.split('.')[0];
  sportRoster(sportId);
  return byId.get(id);
}

/** Every player in every sport. */
export function allPlayers(): Player[] {
  return Object.keys(SPORT_STATS).flatMap((s) => playersForSport(s));
}
