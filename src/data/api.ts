// The one place screens get sports data from. Today it reads the built-in demo
// world; later the same functions will read the real database instead.
import { SPORTS, type SportConfig } from '@/config/sports';
import { DAY, HOUR } from '@/lib/format';

import { callsForEvent, viewCall } from './demo/calls';
import { eventBotMessages, sectionBotMessages } from './demo/chat';
import { finalState, simulate } from './demo/engines';
import { FANS } from './demo/fans';
import { demoBoard, type BoardRow } from './demo/leaderboard';
import { eventMetaById, eventsBetween } from './demo/schedule';
import { demoSectionById, sectionFans } from './demo/sections';
import { competitorById, getWorld } from './demo/world';
import type { CallView, ChatMessage, Competition, Competitor, EventMeta, EventState } from './types';

export type { BoardRow };

/** Events for one of the fan's local days (plus anything still live from the day before). */
export function getDayEvents(dayStart: number, now: number): EventState[] {
  const metas = eventsBetween(dayStart, dayStart + DAY);
  const states = metas.map((m) => simulate(m, now));
  if (now >= dayStart && now < dayStart + DAY) {
    const carryOver = eventsBetween(dayStart - 12 * HOUR, dayStart)
      .map((m) => simulate(m, now))
      .filter((s) => s.status === 'live');
    return [...carryOver, ...states];
  }
  return states;
}

export function getEvent(id: string, now: number): EventState | null {
  const meta = eventMetaById(id);
  return meta ? simulate(meta, now) : null;
}

export function getEventCalls(id: string, now: number): CallView[] {
  const meta = eventMetaById(id);
  if (!meta) return [];
  const state = simulate(meta, now);
  return callsForEvent(meta).map((c) => viewCall(c, state, now));
}

export interface OpenCall {
  state: EventState;
  call: CallView;
}

/** Calls that can be made right now, soonest-closing first. */
export function getOpenCalls(now: number, sportIds?: string[]): OpenCall[] {
  const metas = eventsBetween(now - 6 * HOUR, now + 30 * HOUR)
    .filter((m) => !sportIds || sportIds.length === 0 || sportIds.includes(m.sportId));
  const out: OpenCall[] = [];
  for (const meta of metas) {
    const state = simulate(meta, now);
    if (state.status === 'finished' || state.status === 'cancelled' || state.status === 'postponed') continue;
    for (const call of callsForEvent(meta)) {
      const view = viewCall(call, state, now);
      if (view.status === 'open') out.push({ state, call: view });
    }
  }
  return out.sort((a, b) => a.call.closesAt - b.call.closesAt);
}

export interface CompetitorPage {
  competitor: Competitor;
  team: Competitor | null;
  roster: Competitor[];
  competition: Competition | null;
  recent: EventState[];
  upcoming: EventState[];
  record: { played: number; won: number };
}

export function getCompetitor(id: string, now: number): CompetitorPage | null {
  const competitor = competitorById(id);
  if (!competitor) return null;
  const world = getWorld();
  const roster = world.competitors.filter((c) => c.parentId === id);
  const ids = new Set([id, ...roster.map((r) => r.id)]);
  const metas = eventsBetween(now - 3 * DAY, now + 3 * DAY)
    .filter((m) => m.sportId === competitor.sportId && m.competitorIds.some((c) => ids.has(c)));
  const states = metas.map((m) => simulate(m, now));
  const recent = states.filter((s) => s.status === 'finished').reverse();
  const played = recent.length;
  const won = recent.filter((s) => s.entries.some((e) => ids.has(e.competitorId) && e.isWinner)).length;
  return {
    competitor,
    team: competitorById(competitor.parentId) ?? null,
    roster,
    competition: world.competitionById.get(competitor.competitionId) ?? null,
    recent: recent.slice(0, 10),
    upcoming: states.filter((s) => s.status === 'scheduled' || s.status === 'live').slice(0, 10),
    record: { played, won },
  };
}

export interface SearchResults {
  sports: SportConfig[];
  competitors: Competitor[];
  competitions: Competition[];
}

export function search(query: string): SearchResults {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return { sports: [], competitors: [], competitions: [] };
  const world = getWorld();
  const score = (text: string) => {
    const t = text.toLowerCase();
    if (t.startsWith(q)) return 0;
    if (t.split(/\s+/).some((w) => w.startsWith(q))) return 1;
    return t.includes(q) ? 2 : 9;
  };
  return {
    sports: SPORTS.filter((s) => score(s.name) < 9),
    competitors: world.competitors.filter((c) => score(c.name) < 9 || c.shortName.toLowerCase() === q)
      .sort((a, b) => score(a.name) - score(b.name)).slice(0, 40),
    competitions: world.competitions.filter((c) => score(c.name) < 9).slice(0, 10),
  };
}

/** The next event for a sport, for quiet-day empty states. */
export function nextEventForSport(sportId: string, now: number): EventMeta | undefined {
  return eventsBetween(now, now + 3 * DAY).find((m) => m.sportId === sportId && !m.disruption);
}

export function getEventBotChat(eventId: string, now: number): ChatMessage[] {
  const meta = eventMetaById(eventId);
  if (!meta) return [];
  return eventBotMessages(finalState(meta), now);
}

export function getSectionBotChat(sectionId: string, now: number): ChatMessage[] {
  const section = demoSectionById(sectionId);
  if (!section) return [];
  return sectionBotMessages(section.id, section.sportId, sectionFans(section), now);
}

export function getLeaderboard(now: number, fanIds?: string[]): BoardRow[] {
  return demoBoard(now, fanIds);
}

export function getFan(id: string) {
  return FANS.find((f) => f.id === id);
}

export function getFinalState(eventId: string): EventState | null {
  const meta = eventMetaById(eventId);
  return meta ? finalState(meta) : null;
}

export { competitorById, getWorld };
export { venueFor } from './demo/world';

// Season: tables, records, form, championships. Crowd: who is watching right now.
export {
  championship, championshipRow, fightRankings, fightRecord, headToHead, leagueName, nextRoundAt, ordinal, recordLine,
  roundsPlayed, simulateMatch, standingsKind, teamRow, teamsChampionship, teamTable,
} from './demo/season';
export { callCrowd } from './demo/crowd';
export type { ChampionshipRow, FightRecord, Meeting, Result, StandingsKind, TeamRow } from './demo/season';
export { chattersFor, crowdLabel, watchersFor } from './demo/crowd';
