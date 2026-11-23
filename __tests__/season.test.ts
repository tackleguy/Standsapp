import { chattersFor, crowdLabel, watchersFor } from '@/data/demo/crowd';
import { simulate } from '@/data/demo/engines';
import { eventsForUtcDay } from '@/data/demo/schedule';
import {
  championship, fightRecord, headToHead, ordinal, recordLine, simulateMatch, teamTable, teamsChampionship,
} from '@/data/demo/season';
import { competitorById, participantsFor } from '@/data/demo/world';

const NOW = Date.parse('2026-11-23T03:00:00Z');

describe('season model', () => {
  it('builds a consistent league table', () => {
    const table = teamTable('soccer', NOW);
    expect(table).toHaveLength(participantsFor('soccer').length);
    expect(table.map((r) => r.position)).toEqual(table.map((_, i) => i + 1));
    for (const r of table) {
      expect(r.won + r.drawn + r.lost).toBe(r.played);
      expect(r.points).toBe(r.won * 3 + r.drawn);
      expect(r.form.length).toBeLessThanOrEqual(5);
    }
    // Every goal scored is a goal conceded by someone.
    expect(table.reduce((a, r) => a + r.pointsFor, 0)).toBe(table.reduce((a, r) => a + r.pointsAgainst, 0));
    // Sorted best first.
    for (let i = 1; i < table.length; i++) expect(table[i - 1].points).toBeGreaterThanOrEqual(table[i].points);
  });

  it('sorts win-percentage sports by percentage', () => {
    const table = teamTable('basketball', NOW);
    expect(table[0].gamesBack).toBe(0);
    for (let i = 1; i < table.length; i++) expect(table[i - 1].pct).toBeGreaterThanOrEqual(table[i].pct);
  });

  it('is the same on every call', () => {
    expect(teamTable('rugby_union', NOW)).toEqual(teamTable('rugby_union', NOW));
    expect(simulateMatch('soccer', 'soccer.t0', 'soccer.t1', 'x')).toEqual(simulateMatch('soccer', 'soccer.t0', 'soccer.t1', 'x'));
  });

  it('scores agree with results', () => {
    for (let k = 0; k < 50; k++) {
      const m = simulateMatch('basketball', 'basketball.t0', 'basketball.t3', `s${k}`);
      if (m.result === 'H') expect(m.home).toBeGreaterThan(m.away);
      if (m.result === 'A') expect(m.away).toBeGreaterThan(m.home);
      if (m.result === 'D') expect(m.away).toBe(m.home);
    }
  });

  it('builds championships for racing with constructor totals', () => {
    const drivers = championship('f1', NOW);
    expect(drivers.length).toBe(participantsFor('f1').length);
    const teams = teamsChampionship('f1', NOW);
    expect(teams.reduce((a, t) => a + t.points, 0)).toBe(drivers.reduce((a, d) => a + d.points, 0));
    expect(recordLine(drivers[0].competitorId, NOW)).toMatch(/^P1 · \d+ pts$/);
  });

  it('gives fighters a career record and teams past meetings', () => {
    const fighter = participantsFor('mma')[0];
    const r = fightRecord(fighter);
    expect(r.won).toBeGreaterThan(0);
    expect(headToHead('soccer.t0', 'soccer.t1', NOW, 5)).toHaveLength(5);
    expect(competitorById('soccer.t0')?.colors).not.toBeNull();
    expect(ordinal(1)).toBe('1st');
    expect(ordinal(12)).toBe('12th');
    expect(ordinal(23)).toBe('23rd');
  });
});

describe('crowd model', () => {
  it('has a believable crowd that peaks during the event', () => {
    const meta = eventsForUtcDay(NOW).find((e) => e.sportId === 'soccer' && !e.disruption)!;
    const before = watchersFor(simulate(meta, meta.startsAt - 30 * 60_000), meta.startsAt - 30 * 60_000);
    const during = watchersFor(simulate(meta, meta.startsAt + 80 * 60_000), meta.startsAt + 80 * 60_000);
    expect(during).toBeGreaterThan(before);
    expect(chattersFor(during)).toBeLessThan(during);
    expect(crowdLabel(18_420)).toBe('18.4K');
    expect(crowdLabel(912)).toBe('912');
  });
});
