// Generates the demo timetable: every event for every sport on a given UTC day.
import { sportById } from '@/config/sports';
import { DAY, MINUTE } from '@/lib/format';
import { createRng } from '@/lib/random';

import type { EventMeta } from '../types';
import { CIRCUITS, GOLF_COURSES } from './names';
import { PLANS, type SportPlan } from './plans';
import { getWorld, participantsFor, venueFor } from './world';

const dayCache = new Map<string, EventMeta[]>();

function utcDayStart(ms: number): number {
  return Math.floor(ms / DAY) * DAY;
}

function slotStarts(plan: SportPlan, dayStart: number): number[] {
  if (plan.slots.kind === 'daily') return plan.slots.hours.map((h) => dayStart + h * 60 * MINUTE);
  const { everyMin, offsetMin } = plan.slots;
  // Rolling slots continue across midnight: index from a fixed epoch so days line up.
  const every = everyMin * MINUTE;
  const first = Math.ceil((dayStart - offsetMin * MINUTE) / every) * every + offsetMin * MINUTE;
  const starts: number[] = [];
  for (let t = first; t < dayStart + DAY; t += every) starts.push(t);
  return starts;
}

/**
 * Who plays whom in a given slot, by the circle method that real leagues use for
 * round-robin fixtures. Slots are numbered from a fixed epoch, so consecutive
 * days line up, and a team's games are always about half a round apart: no team
 * is ever in two games at once.
 */
function roundRobinPair(sportId: string, ids: string[], slot: number): [string, string] | null {
  if (ids.length < 2) return null;
  const order = rrOrder(sportId, ids);
  const n = order.length % 2 === 0 ? order.length : order.length + 1; // odd fields get a bye
  const perRound = n / 2;
  const round = Math.floor(slot / perRound) % (n - 1);
  const i = slot % perRound;
  const at = (p: number) => (p === 0 ? 0 : 1 + ((p - 1 + round) % (n - 1)));
  const a = order[at(i)];
  const b = order[at(n - 1 - i)];
  if (!a || !b) return roundRobinPair(sportId, ids, slot + 1); // the bye: take the next fixture
  // Alternate home and away from round to round.
  return (round + i) % 2 === 0 ? [a, b] : [b, a];
}

const rrCache = new Map<string, string[]>();
function rrOrder(sportId: string, ids: string[]): string[] {
  const hit = rrCache.get(sportId);
  if (hit) return hit;
  const order = createRng(`rr:${sportId}`).shuffle(ids);
  rrCache.set(sportId, order);
  return order;
}

/** A number for every slot since the epoch, so fixtures continue across midnight. */
function slotNumber(plan: SportPlan, startsAt: number, dayIndex: number, i: number): number {
  if (plan.slots.kind === 'rolling') {
    return Math.round((startsAt - plan.slots.offsetMin * MINUTE) / (plan.slots.everyMin * MINUTE));
  }
  return dayIndex * plan.slots.hours.length + i;
}

function buildDay(plan: SportPlan, dayStart: number): EventMeta[] {
  const sport = sportById(plan.sportId);
  if (!sport) return [];
  const world = getWorld();
  const dayKey = new Date(dayStart).toISOString().slice(0, 10);
  const rng = createRng(`day:${plan.sportId}:${dayKey}`);
  const starts = slotStarts(plan, dayStart);
  const participants = participantsFor(plan.sportId);
  const ids = participants.map((p) => p.id);
  const comps = world.competitions.filter((c) => c.sportId === plan.sportId);
  const dayIndex = Math.floor(dayStart / DAY);
  const events: EventMeta[] = [];

  starts.forEach((startsAt, i) => {
    const id = `${plan.sportId}-${dayKey}-${String(i).padStart(2, '0')}`;
    const comp = comps[(i + dayIndex) % comps.length];
    const disruptionRoll = rng.next();
    const disruption = disruptionRoll < 0.012 ? 'postponed' : disruptionRoll < 0.018 ? 'cancelled' : null;
    const base = {
      id, sportId: plan.sportId, format: sport.format, competitionId: comp.id,
      startsAt, durationMs: plan.durationMin * MINUTE, disruption, isDemo: true,
    } as const;

    if (plan.engine === 'race') {
      const circuit = CIRCUITS[(dayIndex * 3 + i) % CIRCUITS.length];
      const isSprint = plan.sportId !== 'indycar' && i % 2 === 1;
      events.push({
        ...base,
        title: `${circuit.city} ${isSprint ? 'Sprint' : 'Grand Prix'}`,
        venue: circuit.name,
        durationMs: (isSprint ? Math.round(plan.durationMin * 0.36) : plan.durationMin) * MINUTE,
        competitorIds: ids,
      });
      return;
    }
    if (plan.engine === 'golf') {
      const course = GOLF_COURSES[Math.floor(dayIndex / 4) % GOLF_COURSES.length];
      const round = (dayIndex % 4) + 1;
      events.push({
        ...base, title: `${course.split(' ')[0]} Classic · Round ${round}`, venue: course, competitorIds: ids,
      });
      return;
    }
    if (plan.engine === 'cycling') {
      const stage = (dayIndex % 21) + 1;
      const from = CIRCUITS[dayIndex % CIRCUITS.length].city;
      const to = CIRCUITS[(dayIndex + 3) % CIRCUITS.length].city;
      events.push({
        ...base, title: `Stage ${stage}: ${from} to ${to}`, venue: `${from} to ${to}`, competitorIds: ids,
      });
      return;
    }

    const pair = roundRobinPair(plan.sportId, ids, slotNumber(plan, startsAt, dayIndex, i));
    if (!pair) return;
    const [homeId, awayId] = pair;
    const home = world.byId.get(homeId);
    const away = world.byId.get(awayId);
    if (!home || !away) return;
    const isMainEvent = plan.engine === 'combat' && (i === 5 || i === starts.length - 1);
    const isIndividual = home.kind === 'athlete';
    events.push({
      ...base,
      title: `${home.name} ${isIndividual ? 'vs' : 'v'} ${away.name}`,
      venue: isIndividual ? `${comp.name} Arena` : venueFor(home),
      durationMs: (isMainEvent ? plan.durationMin * 1.5 : plan.durationMin) * MINUTE,
      competitorIds: [homeId, awayId],
    });
  });
  return events;
}

/** Every event on the UTC day that contains `ms`. */
export function eventsForUtcDay(ms: number): EventMeta[] {
  const start = utcDayStart(ms);
  const key = String(start);
  const hit = dayCache.get(key);
  if (hit) return hit;
  const all = PLANS.flatMap((plan) => buildDay(plan, start)).sort((a, b) => a.startsAt - b.startsAt);
  dayCache.set(key, all);
  if (dayCache.size > 30) dayCache.delete(dayCache.keys().next().value as string);
  return all;
}

/** Every event whose start falls inside [from, to). */
export function eventsBetween(from: number, to: number): EventMeta[] {
  const out: EventMeta[] = [];
  for (let d = utcDayStart(from); d < to; d += DAY) {
    for (const e of eventsForUtcDay(d)) if (e.startsAt >= from && e.startsAt < to) out.push(e);
  }
  return out;
}

/** Finds an event from its id, which encodes the sport and UTC day. */
export function eventMetaById(id: string): EventMeta | undefined {
  const match = /^(.+)-(\d{4}-\d{2}-\d{2})-(\d{2})$/.exec(id);
  if (!match) return undefined;
  const dayStart = Date.parse(`${match[2]}T00:00:00Z`);
  if (Number.isNaN(dayStart)) return undefined;
  return eventsForUtcDay(dayStart).find((e) => e.id === id);
}
