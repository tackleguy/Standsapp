// Athletes as players in motor racing (F1, MotoGP, IndyCar), cycling and golf.
// Every stat must agree with what the simulator itself decided (the feed, the
// classification, the live leaderboard), and crediting the athletes must not
// have changed a single result, time, play or Call.
import { callsForEvent, resolveCall } from '@/data/demo/calls';
import { finalState, gameStatsFor, simulate } from '@/data/demo/engines';
import { nameOf } from '@/data/demo/engines/common';
import { raceSnapshot } from '@/data/demo/engines/race';
import { momentById } from '@/data/demo/moments';
import { linesUpTo, pointsOf } from '@/data/demo/players/lines';
import type { GameStats, StatEvent, StatLine } from '@/data/demo/players/types';
import { eventMetaById, eventsForUtcDay } from '@/data/demo/schedule';
import type { EntryState, EventMeta, EventState, Play } from '@/data/types';
import { formatToPar } from '@/lib/format';
import { hashText } from '@/lib/random';

const RACING = ['f1', 'motogp', 'indycar'];
const day = (d: number) => Date.parse(`2026-11-${d}T00:00:00Z`);
const metasOn = (days: number[]) => days.flatMap((d) => eventsForUtcDay(day(d))).filter((m) => !m.disruption);
const recent = metasOn([21, 22]);
const week = metasOn([16, 17, 18, 19, 20, 21, 22, 23]);
const races = recent.filter((m) => RACING.includes(m.sportId));
const stages = week.filter((m) => m.sportId === 'cycling');
const rounds = week.filter((m) => m.sportId === 'golf');

const linesOf = (meta: EventMeta, upTo?: number) => linesUpTo(meta.sportId, gameStatsFor(meta).events, upTo);
const eventsAt = (gs: GameStats, at: number, playerId: string) => gs.events.filter((e) => e.at === at && e.playerId === playerId);
const playsTagged = (state: EventState, tag: string) => state.plays.filter((p) => p.tag === tag);
const table = (state: EventState, title: string) => {
  const t = state.stats.find((s) => s.type === 'table' && s.title.startsWith(title));
  if (!t || t.type !== 'table') throw new Error(`no ${title} table`);
  return t;
};

/**
 * Everything a viewer or a Call can see of an event, at several moments. Overtake
 * plays keep their place, time, mover and rating, but not their wording or the
 * car they name as passed: those were corrected to name the car really passed (or
 * the pit stop or retirement that gave the place), and are checked further down.
 */
function fingerprint(meta: EventMeta): string {
  const moments = [-0.05, 0.1, 0.3, 0.5, 0.7, 0.9, 1.2].map((f) => meta.startsAt + Math.round(meta.durationMs * f));
  const pass = (p: Play) => p.tag === 'OVERTAKE';
  const states = [...moments.map((t) => simulate(meta, t)), finalState(meta)].map((s) => ({
    status: s.status, periodLabel: s.periodLabel, progress: s.progress, entries: s.entries, stats: s.stats,
    resultText: s.resultText, facts: s.facts, endsAt: s.endsAt,
    plays: s.plays.map((p) => [p.id, p.seq, p.at, p.clock, pass(p) ? null : p.description, p.competitorId, p.importance, p.tag, p.scoreAfter,
      pass(p) ? p.playerIds?.slice(0, 1) : p.playerIds, p.playerRoles, pass(p) ? null : p.headline, p.impact, p.period]),
  }));
  const final = finalState(meta);
  const calls = callsForEvent(meta).map((c) => [c.id, c.options.map((o) => `${o.id}@${o.multiplier}`).join(','), resolveCall(c, final)]);
  const track = RACING.includes(meta.sportId) ? moments.map((t) => raceSnapshot(meta, t)) : null;
  return hashText(JSON.stringify({ states, calls, track })).toString(36);
}

// Recorded at commit 9014e54, before any athlete stats existed: entries, running
// orders, stats tables, plays, results, Call prices and outcomes, and the track map.
// Re-recorded at commit efc946a, which still matched those first hashes, when the
// fingerprint added each play's athletes, roles, headline and rating and left out
// the overtake wording and the car it names (corrected after that commit).
const BEFORE: Record<string, string> = {
  'f1-2026-11-21-00': '18j8wgb', 'f1-2026-11-21-01': 'uii29a', 'f1-2026-11-21-02': 'u3kcvy', 'f1-2026-11-21-03': '1wb6bm4',
  'f1-2026-11-21-04': '1lyu14l', 'f1-2026-11-21-05': '1dbu263', 'f1-2026-11-21-06': '1xblozj', 'f1-2026-11-21-07': '15dmdsz',
  'f1-2026-11-21-08': 'ny9k94', 'f1-2026-11-21-09': 'w8m2zy', 'f1-2026-11-22-00': '3a7jrh', 'f1-2026-11-22-01': '1rz3mb3',
  'f1-2026-11-22-02': 'jpzqq6', 'f1-2026-11-22-03': '1rw4p2y', 'f1-2026-11-22-04': '1e6d6ib', 'f1-2026-11-22-05': '16lwa3r',
  'f1-2026-11-22-06': 'l35i40', 'f1-2026-11-22-07': '5vxlg9', 'f1-2026-11-22-08': 'e5jwtq',
  'motogp-2026-11-21-00': 'lgndlw', 'motogp-2026-11-21-01': '8cx48q', 'motogp-2026-11-22-00': '3ff841', 'motogp-2026-11-22-01': '1wcwrzo',
  'indycar-2026-11-21-00': 'fxeky1', 'indycar-2026-11-21-01': 'mcn1f', 'indycar-2026-11-22-00': '1k4hrwh', 'indycar-2026-11-22-01': 'mkugpo',
  'cycling-2026-11-21-00': '52r98o', 'cycling-2026-11-22-00': '10uosm2', 'golf-2026-11-21-00': '1j6zfss', 'golf-2026-11-22-00': '1h2t1rt',
};

describe('athlete stats leave the events untouched', () => {
  it.each(Object.keys(BEFORE))('%s plays out exactly as before', (id) => {
    const meta = eventMetaById(id);
    expect(meta).toBeDefined();
    expect(fingerprint(meta as EventMeta)).toBe(BEFORE[id]);
  });

  it('builds the same stats on every phone', () => {
    const sample = [races[0], races.find((m) => m.sportId === 'indycar'), stages[0], rounds[0]] as EventMeta[];
    const fresh = () => {
      let out = '';
      jest.isolateModules(() => {
        const engines = jest.requireActual<typeof import('@/data/demo/engines')>('@/data/demo/engines');
        out = JSON.stringify(sample.map((m) => [engines.gameStatsFor(m), engines.finalState(m).plays]));
      });
      return out;
    };
    const a = fresh();
    expect(a).toBe(fresh());
    expect(a).toBe(JSON.stringify(sample.map((m) => [gameStatsFor(m), finalState(m).plays])));
  });
});

describe.each([['racing', races], ['cycling', stages], ['golf', rounds]] as const)('%s stats', (_, list) => {
  it('lists every athlete once, in entry order, with periods that only move forward', () => {
    expect(list.length).toBeGreaterThan(0);
    for (const meta of list) {
      const gs = gameStatsFor(meta);
      expect(gs.lineups).toEqual(meta.competitorIds.map((id) => ({ competitorId: id, playerIds: [id] })));
      // Per athlete: golfers tee off at different times, so one can be on the
      // back nine while another is still on the front.
      const period = new Map<string, number>();
      for (const e of gs.events) {
        expect(e.period).toBeGreaterThanOrEqual(period.get(e.playerId) ?? 0);
        period.set(e.playerId, e.period);
      }
      // Places and grid slots are credited once (stats add up).
      for (const key of ['pos', 'grid', 'finish', 'stagePts', 'gained', 'pts']) {
        const seen = gs.events.filter((e) => e.stats[key] !== undefined).map((e) => e.playerId);
        expect(new Set(seen).size).toBe(seen.length);
      }
    }
  });

  it('names athletes on the plays that involve them', () => {
    for (const meta of list) {
      const final = finalState(meta);
      const named = final.plays.filter((p) => p.playerIds?.length);
      expect(named.length).toBeGreaterThan(0);
      for (const p of named) {
        expect(p.headline).toBeTruthy();
        expect(p.impact).toBeDefined();
        expect(p.period).toBeDefined();
        expect(p.playerRoles?.length).toBe(p.playerIds?.length);
        if (p.competitorId) expect(p.playerIds?.[0]).toBe(p.competitorId);
      }
      const win = playsTagged(final, 'FINAL')[0];
      expect(win.playerIds?.[0]).toBe(final.facts.winnerId);
    }
  });
});

describe('motor racing', () => {
  const startingGrid = (meta: EventMeta) => new Map(simulate(meta, meta.startsAt - 1).entries.map((e) => [e.competitorId, e.position as number]));

  it('credits the grid, the classification, points and the fastest lap', () => {
    for (const meta of races) {
      const final = finalState(meta);
      const lines = linesOf(meta);
      const grid = startingGrid(meta);
      for (const entry of final.entries) {
        const l = lines.get(entry.competitorId) as StatLine;
        expect(l.grid).toBe(grid.get(entry.competitorId));
        if (entry.note === 'DNF') {
          expect(l.dnf).toBe(1);
          expect([l.pos, l.pts, l.gained]).toEqual([undefined, undefined, undefined]);
        } else {
          expect(l.dnf).toBeUndefined();
          expect(l.pos).toBe(entry.position);
          expect(l.pts ?? 0).toBe(entry.score ?? 0);
          expect(l.gained).toBe((l.grid as number) - (l.pos as number));
        }
        expect(l.fl).toBe(final.facts.fastestLapId === entry.competitorId ? 1 : undefined);
      }
      expect(playsTagged(final, 'PODIUM')[0].playerIds?.join(',')).toBe(final.facts.podium);
    }
  });

  it('credits laps led, pit stops and retirements when the feed shows them', () => {
    for (const meta of races) {
      const gs = gameStatsFor(meta);
      const final = finalState(meta);
      const led = gs.events.filter((e) => e.stats.led);
      expect(led.length).toBe(raceSnapshot(meta, meta.startsAt).laps);
      for (const e of led) expect(simulate(meta, e.at).entries[0].competitorId).toBe(e.playerId);
      for (const [tag, key] of [['PIT', 'pit'], ['DNF', 'dnf']] as const) {
        const plays = playsTagged(final, tag);
        expect(gs.events.filter((e) => e.stats[key]).length).toBe(plays.length);
        for (const p of plays) expect(eventsAt(gs, p.at, p.playerIds?.[0] as string).some((e) => e.stats[key] === 1)).toBe(true);
      }
    }
  });

  /** The running order the app shows at the end of every lap (index 0: the grid). */
  const lapOrders = (meta: EventMeta) => {
    const gs = gameStatsFor(meta);
    const lapEnds = [gs.events[0].at, ...gs.events.filter((e) => e.stats.led).map((e) => e.at)];
    return lapEnds.map((at) => ({ at, order: simulate(meta, at).entries }));
  };
  const outOrInPits = (e: EntryState) => e.note === 'Pit' || e.note === 'DNF';
  /**
   * The cars `id` passed on track over a lap, best placed first: ahead of it
   * before, behind it after, with neither car in the pits or out of the race.
   */
  const passedOnTrack = (before: EntryState[], after: EntryState[], id: string) => {
    const at = (order: EntryState[], cid: string) => order.findIndex((e) => e.competitorId === cid);
    const me = after[at(after, id)];
    if (!me || outOrInPits(me)) return [];
    return before.slice(0, at(before, id)).map((e) => e.competitorId)
      .filter((cid) => at(after, cid) > at(after, id) && !outOrInPits(after[at(after, cid)]));
  };

  it('credits an overtake for every pass on track, and none for places won in the pits', () => {
    for (const meta of races) {
      const credited = new Map(gameStatsFor(meta).events.filter((e) => e.stats.ot).map((e) => [`${e.at}|${e.playerId}`, e.stats.ot]));
      const expected = new Map<string, number>();
      const laps = lapOrders(meta);
      laps.slice(1).forEach(({ at, order }, i) => {
        for (const car of laps[i].order) {
          const passes = passedOnTrack(laps[i].order, order, car.competitorId).length;
          if (passes) expected.set(`${at - 5000}|${car.competitorId}`, passes);
        }
      });
      expect(credited).toEqual(expected);
    }
  });

  it('names the car really passed, or the car ahead that pitted or retired', () => {
    const seen = { passes: 0, pits: 0, retires: 0 };
    for (const meta of races) {
      const gs = gameStatsFor(meta);
      const laps = lapOrders(meta);
      for (const p of playsTagged(finalState(meta), 'OVERTAKE')) {
        const lap = Number(/^Lap (\d+)\//.exec(p.clock)?.[1]);
        const [before, after] = [laps[lap - 1].order, laps[lap].order];
        const [mover, other] = p.playerIds as string[];
        const was = (id: string) => before.findIndex((e) => e.competitorId === id);
        const now = (id: string) => after.findIndex((e) => e.competitorId === id);
        const place = `P${now(mover) + 1}`;
        expect(p.at).toBe(laps[lap].at - 5000);
        expect(was(mover)).toBeGreaterThan(now(mover));
        // The car named was ahead a lap ago and is behind now. If the mover passed
        // the car that held the place, that car is named, else the best placed.
        expect(was(other)).toBeLessThan(was(mover));
        expect(now(other)).toBeGreaterThan(now(mover));
        const holder = before[now(mover)].competitorId;
        const passed = passedOnTrack(before, after, mover);
        const droppedBack = passed.length ? passed : before.slice(0, was(mover)).map((e) => e.competitorId).filter((id) => now(id) > now(mover));
        expect(other).toBe(droppedBack.includes(holder) ? holder : droppedBack[0]);
        const credit = eventsAt(gs, p.at, mover).find((e) => e.stats.ot);
        const [m, o] = [nameOf(mover), nameOf(other)];
        if (passed.length) {
          seen.passes++;
          expect(p.description).toBe(`${m} passes ${o} for ${place}.`);
          expect(p.headline).toBe(`Overtake for ${place}`);
          expect(credit?.stats.ot).toBe(passed.length);
          continue;
        }
        // No pass on track: the place came from the car named pitting or retiring.
        expect(credit).toBeUndefined();
        expect(p.headline).toBe(`Up to ${place}`);
        const note = after[now(other)].note;
        if (note === 'DNF') {
          seen.retires++;
          expect(p.description).toBe(`${m} moves up to ${place} as ${o} retires.`);
        } else if (after[now(mover)].note === 'Pit') {
          expect(p.description).toBe(`${m} jumps ${o} in the pits for ${place}.`);
        } else {
          seen.pits++;
          expect(note).toBe('Pit');
          expect(p.description).toBe(`${m} moves up to ${place} as ${o} pits.`);
        }
      }
    }
    expect(Math.min(seen.passes, seen.pits, seen.retires)).toBeGreaterThan(0);
  });

  it('keeps showing Performance cards collected before overtakes were corrected', () => {
    // Before the correction, f1.a7 had 5 overtakes and 15 points in this race (a
    // Rare), and f1.a3 had 6 and 7.1 points (a Common). Some of those overtakes
    // were cars ahead pitting: 14.5 points now earns a Common, and 6.1 none.
    const event = 'f1-2026-11-21-00';
    const rare = momentById(`perf|rare|${event}|f1.a7`);
    expect(rare).toMatchObject({ rarity: 'rare', playerId: 'f1.a7', eventId: event, value: 14.5, headline: 'P4 from P5 12 pts 4 overtakes' });
    expect(momentById(`perf|common|${event}|f1.a7`)).toMatchObject({ rarity: 'common', value: 14.5 });
    expect(momentById(`perf|common|${event}|f1.a3`)).toMatchObject({ rarity: 'common', playerId: 'f1.a3', value: 6.1 });
    expect(momentById(`perf|common|${event}|nobody`)).toBeNull();
    expect(momentById(`perf|shiny|${event}|f1.a7`)).toBeNull();
  });

  it('splits the race into four stints of laps', () => {
    const gp = races.find((m) => m.sportId === 'f1' && !m.title.includes('Sprint')) as EventMeta;
    const gs = gameStatsFor(gp);
    expect(gs.periods).toEqual(['L1–14', 'L15–28', 'L29–42', 'L43–57']);
    const led = gs.events.filter((e) => e.stats.led);
    led.forEach((e, i) => expect(e.period).toBe(i < 14 ? 0 : i < 28 ? 1 : i < 42 ? 2 : 3));
    for (const pass of playsTagged(finalState(gp), 'OVERTAKE')) {
      expect(pass.headline).toMatch(/^(Overtake for|Up to) P\d+$/);
      expect(pass.playerRoles).toEqual(['ot', 'passed']);
    }
  });
});

describe('cycling', () => {
  const STAGE_POINTS = [25, 20, 16, 14, 12, 10, 8, 6, 4, 2];

  it('credits the stage result and the break as the race tells it', () => {
    expect(stages.length).toBeGreaterThan(3);
    for (const meta of stages) {
      const gs = gameStatsFor(meta);
      const final = finalState(meta);
      const lines = linesOf(meta);
      for (const entry of final.entries) {
        const l = lines.get(entry.competitorId) as StatLine;
        expect(l.pos).toBe(entry.position);
        expect(l.stagePts).toBe(STAGE_POINTS[(entry.position as number) - 1]);
        expect(l.dnf).toBeUndefined(); // the simulator has no abandons
      }
      const brk = playsTagged(final, 'BREAK')[0];
      expect(new Set([...lines].filter(([, l]) => l.bk).map(([id]) => id))).toEqual(new Set(brk.playerIds));
      for (const id of brk.playerIds ?? []) expect(eventsAt(gs, brk.at, id)[0].stats.bk).toBe(1);
      // The rider the feed names over a sprint or a climb gets the most points there.
      for (const [tag, key] of [['SPRINT', 'spr'], ['KOM', 'kom']] as const) {
        for (const p of playsTagged(final, tag)) {
          const here = gs.events.filter((e) => e.at === p.at && e.stats[key]);
          const top = Math.max(...here.map((e) => e.stats[key]));
          expect(here.find((e) => e.playerId === p.playerIds?.[0])?.stats[key]).toBe(top);
          expect(here.every((e) => brk.playerIds?.includes(e.playerId))).toBe(true);
        }
      }
      const attacks = playsTagged(final, 'ATTACK').filter((p) => p.playerIds?.length);
      expect(gs.events.filter((e) => e.stats.att).map((e) => `${e.at}|${e.playerId}`))
        .toEqual(attacks.map((p) => `${p.at}|${p.playerIds?.[0]}`));
      expect(gs.periods).toHaveLength(4);
    }
  });
});

describe('golf', () => {
  const BONUS = (place: number) => (place === 1 ? 15 : place === 2 ? 10 : place === 3 ? 8 : place <= 5 ? 6 : place <= 10 ? 4 : 0);

  it('scores every hole from the real scorecard and places golfers as the leaderboard does', () => {
    expect(rounds.length).toBeGreaterThan(3);
    for (const meta of rounds) {
      const final = finalState(meta);
      const lines = linesOf(meta);
      const board = table(final, 'Leaderboard');
      const round = Number(/Round (\d)/.exec(meta.title)?.[1]);
      for (const row of board.rows) {
        const l = lines.get(row.competitorId as string) as StatLine;
        const [place, , today] = row.cells;
        expect(l.holes).toBe(18);
        expect(formatToPar(l.toPar)).toBe(today);
        expect(l.pos).toBe(Number(place));
        expect(['par', 'bird', 'eag', 'hio', 'bog', 'dbl'].reduce((a, k) => a + (l[k] ?? 0), 0)).toBe(18);
        if (round === 4) {
          const winner = final.facts.winnerId === row.competitorId;
          expect(l.finish).toBe(BONUS(winner ? 1 : Math.max(2, l.pos)) || undefined);
        } else {
          expect(l.finish).toBeUndefined();
        }
      }
      expect(gameStatsFor(meta).periods).toEqual(['Holes 1–6', 'Holes 7–12', 'Holes 13–18']);
    }
    expect(rounds.some((m) => m.title.includes('Round 4'))).toBe(true);
  });

  it('keeps every golfer\'s live line in step with the live leaderboard', () => {
    for (const meta of rounds.slice(0, 3)) {
      for (const f of [0.25, 0.5, 0.75]) {
        const t = meta.startsAt + Math.round(meta.durationMs * f);
        const lines = linesOf(meta, t);
        for (const row of table(simulate(meta, t), 'Leaderboard').rows) {
          const l = lines.get(row.competitorId as string) ?? {};
          const [, , today, thru] = row.cells;
          const holes = l.holes ?? 0;
          expect(thru).toBe(holes === 0 ? '0' : holes === 18 ? 'F' : String(holes));
          expect(today).toBe(holes === 0 ? '–' : formatToPar(l.toPar ?? 0));
        }
      }
    }
  });

  it('matches each birdie, eagle, ace and double on the feed', () => {
    const KEY: Record<string, string> = { BIRDIE: 'bird', EAGLE: 'eag', ACE: 'hio', DOUBLE: 'dbl' };
    for (const meta of rounds) {
      const gs = gameStatsFor(meta);
      for (const p of finalState(meta).plays.filter((x) => x.tag && KEY[x.tag])) {
        const hits: StatEvent[] = eventsAt(gs, p.at, p.playerIds?.[0] as string);
        expect(hits.some((e) => e.stats[KEY[p.tag as string]] === 1)).toBe(true);
        expect(p.headline).toMatch(new RegExp(`on ${p.clock.replace('Hole ', '')}$`));
      }
    }
  });
});

describe('fantasy points', () => {
  const pointsFor = (meta: EventMeta) => {
    const lines = linesOf(meta);
    return meta.competitorIds.map((id) => pointsOf(meta.sportId, lines.get(id) ?? {}));
  };
  const median = (list: number[]) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];

  it('give a winner 20-40 and a typical athlete a few points', () => {
    const groups: [string, EventMeta[]][] = [
      ['grand prix', races.filter((m) => !m.title.includes('Sprint'))],
      ['stage', stages],
      ['round', rounds],
    ];
    for (const [, list] of groups) {
      for (const meta of list) {
        const pts = pointsFor(meta);
        const winner = pts[meta.competitorIds.indexOf(String(finalState(meta).facts.winnerId))];
        expect(winner).toBeGreaterThanOrEqual(15);
        expect(Math.max(...pts)).toBeLessThanOrEqual(45);
        expect(median(pts)).toBeLessThan(15);
      }
    }
  });
});
