import { SPORTS } from '@/config/sports';
import { callsForEvent, outcomeFor, viewCall } from '@/data/demo/calls';
import { eventBotMessages } from '@/data/demo/chat';
import { finalState, simulate } from '@/data/demo/engines';
import { eventMetaById, eventsForUtcDay } from '@/data/demo/schedule';

const DAY_START = Date.parse('2026-11-22T00:00:00Z');

describe('demo simulators', () => {
  const metas = eventsForUtcDay(DAY_START);

  it('schedules events for every sport', () => {
    for (const sport of SPORTS) {
      expect(metas.some((m) => m.sportId === sport.id)).toBe(true);
    }
  });

  it('simulates every event at several moments without errors', () => {
    for (const meta of metas) {
      for (const frac of [-0.1, 0, 0.1, 0.5, 0.9, 1.5, 5]) {
        const now = meta.startsAt + frac * meta.durationMs;
        const state = simulate(meta, now);
        expect(state.meta.id).toBe(meta.id);
        expect(state.entries.length).toBeGreaterThan(0);
        for (const p of state.plays) expect(p.at).toBeLessThanOrEqual(now);
      }
      const final = finalState(meta);
      if (!meta.disruption) expect(final.status).toBe('finished');
    }
  });

  it('is deterministic', () => {
    const meta = metas[3];
    const a = simulate(meta, meta.startsAt + meta.durationMs / 2);
    const b = simulate(meta, meta.startsAt + meta.durationMs / 2);
    expect(JSON.stringify(a.entries)).toBe(JSON.stringify(b.entries));
    expect(eventMetaById(meta.id)?.title).toBe(meta.title);
  });

  it('creates, prices, and settles calls for every event', () => {
    for (const meta of metas) {
      const calls = callsForEvent(meta);
      expect(calls.length).toBeGreaterThan(0);
      const final = finalState(meta);
      for (const call of calls) {
        for (const o of call.options) expect(o.multiplier).toBeGreaterThanOrEqual(1.05);
        const live = viewCall(call, simulate(meta, meta.startsAt + meta.durationMs * 0.3), meta.startsAt + meta.durationMs * 0.3);
        for (const o of live.options) expect(Number.isFinite(o.multiplier)).toBe(true);
        const outcomes = call.options.map((o) => outcomeFor(call, { optionId: o.id }, final));
        if (meta.disruption) expect(outcomes.every((x) => x === 'void')).toBe(true);
        else if (!outcomes.includes('void')) expect(outcomes.filter((x) => x === 'won').length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('generates chat for live events', () => {
    const meta = metas.find((m) => m.sportId === 'soccer' && !m.disruption)!;
    const msgs = eventBotMessages(finalState(meta), meta.startsAt + meta.durationMs / 2);
    expect(msgs.length).toBeGreaterThan(5);
  });
});
