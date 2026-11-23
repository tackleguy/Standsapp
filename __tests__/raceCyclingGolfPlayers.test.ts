// Athletes as players in motor racing (F1, MotoGP, IndyCar), cycling and golf.
// Every stat must agree with what the simulator itself decided (the feed, the
// classification, the live leaderboard), and crediting the athletes must not
// have changed a single result, time, play or Call.
import { callsForEvent, resolveCall } from '@/data/demo/calls';
import { finalState, gameStatsFor, simulate } from '@/data/demo/engines';
import { raceSnapshot } from '@/data/demo/engines/race';
import { linesUpTo, pointsOf } from '@/data/demo/players/lines';
import type { GameStats, StatEvent, StatLine } from '@/data/demo/players/types';
import { eventMetaById, eventsForUtcDay } from '@/data/demo/schedule';
import type { EventMeta, EventState, Play } from '@/data/types';
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

/** Everything a viewer or a Call can see of an event, at several moments. */
function fingerprint(meta: EventMeta): string {
  const moments = [-0.05, 0.1, 0.3, 0.5, 0.7, 0.9, 1.2].map((f) => meta.startsAt + Math.round(meta.durationMs * f));
  const states = [...moments.map((t) => simulate(meta, t)), finalState(meta)].map((s) => ({
    status: s.status, periodLabel: s.periodLabel, progress: s.progress, entries: s.entries, stats: s.stats,
    resultText: s.resultText, facts: s.facts, endsAt: s.endsAt,
    plays: s.plays.map((p) => [p.id, p.seq, p.at, p.clock, p.description, p.competitorId, p.importance, p.tag, p.scoreAfter]),
  }));
  const final = finalState(meta);
  const calls = callsForEvent(meta).map((c) => [c.id, c.options.map((o) => `${o.id}@${o.multiplier}`).join(','), resolveCall(c, final)]);
  const track = RACING.includes(meta.sportId) ? moments.map((t) => raceSnapshot(meta, t)) : null;
  return hashText(JSON.stringify({ states, calls, track })).toString(36);
}

// Recorded at commit 9014e54, before any athlete stats existed: entries, running
// orders, stats tables, plays, results, Call prices and outcomes, and the track map.
const BEFORE: Record<string, string> = {
  'f1-2026-11-21-00': '8spktc', 'f1-2026-11-21-01': '63gb0d', 'f1-2026-11-21-02': '1b0a425', 'f1-2026-11-21-03': '11alyan',
  'f1-2026-11-21-04': 'q6nzgv', 'f1-2026-11-21-05': 'njxq19', 'f1-2026-11-21-06': 'mxuqw', 'f1-2026-11-21-07': 'kxw97',
  'f1-2026-11-21-08': '1glg5pk', 'f1-2026-11-21-09': '7y6flt', 'f1-2026-11-22-00': '19kbr8n', 'f1-2026-11-22-01': '1walhg1',
  'f1-2026-11-22-02': 'ddswsg', 'f1-2026-11-22-03': '1a8brcj', 'f1-2026-11-22-04': 'vcfvrd', 'f1-2026-11-22-05': '176v39u',
  'f1-2026-11-22-06': 'jyqpc0', 'f1-2026-11-22-07': 'hyh7dk', 'f1-2026-11-22-08': 'hrxvq2',
  'motogp-2026-11-21-00': '12vqtvq', 'motogp-2026-11-21-01': '1jqk6r4', 'motogp-2026-11-22-00': '7f1i13', 'motogp-2026-11-22-01': '3r79q5',
  'indycar-2026-11-21-00': '1lpkqp3', 'indycar-2026-11-21-01': '13lmeol', 'indycar-2026-11-22-00': '1rha0uh', 'indycar-2026-11-22-01': '1rxkk6o',
  'cycling-2026-11-21-00': '11s3ua', 'cycling-2026-11-22-00': '1d8e8m0',
  'golf-2026-11-21-00': '1j42ow3', 'golf-2026-11-22-00': '5fq8cj',
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

  it('credits an overtake for every pass in the running order and every pass the feed calls', () => {
    for (const meta of races) {
      const gs = gameStatsFor(meta);
      const called = new Set(playsTagged(finalState(meta), 'OVERTAKE').map((p) => `${p.at}|${p.playerIds?.[0]}`));
      const credited = new Map(gs.events.filter((e) => e.stats.ot).map((e) => [`${e.at}|${e.playerId}`, e.stats.ot]));
      // Rebuild every lap's passes from the running order the app shows: a pass is
      // ending the lap ahead of a car you were behind, when that car did not pit or
      // retire on the lap (and you did not pit).
      const lapEnds = [gs.events[0].at, ...gs.events.filter((e) => e.stats.led).map((e) => e.at)];
      const expected = new Map<string, number>();
      let before = simulate(meta, lapEnds[0]).entries;
      for (const lapEnd of lapEnds.slice(1)) {
        const after = simulate(meta, lapEnd).entries;
        const placeAfter = new Map(after.map((e, i) => [e.competitorId, { i, note: e.note }]));
        before.forEach((car, wasAt) => {
          const now = placeAfter.get(car.competitorId);
          let passed = 0;
          if (now && now.note !== 'Pit' && now.note !== 'DNF') {
            for (const ahead of before.slice(0, wasAt)) {
              const other = placeAfter.get(ahead.competitorId);
              if (other && other.i > now.i && other.note !== 'Pit' && other.note !== 'DNF') passed++;
            }
          }
          const key = `${lapEnd - 5000}|${car.competitorId}`;
          const ot = Math.max(passed, called.has(key) ? 1 : 0);
          if (ot) expected.set(key, ot);
        });
        before = after;
      }
      expect(credited).toEqual(expected);
      for (const key of called) expect(credited.get(key)).toBeGreaterThanOrEqual(1);
    }
  });

  it('splits the race into four stints of laps', () => {
    const gp = races.find((m) => m.sportId === 'f1' && !m.title.includes('Sprint')) as EventMeta;
    const gs = gameStatsFor(gp);
    expect(gs.periods).toEqual(['L1–14', 'L15–28', 'L29–42', 'L43–57']);
    const led = gs.events.filter((e) => e.stats.led);
    led.forEach((e, i) => expect(e.period).toBe(i < 14 ? 0 : i < 28 ? 1 : i < 42 ? 2 : 3));
    const pass = finalState(gp).plays.find((p) => p.tag === 'OVERTAKE') as Play;
    expect(pass.headline).toMatch(/^Overtake for P\d+$/);
    expect(pass.playerRoles).toEqual(['ot', 'passed']);
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
