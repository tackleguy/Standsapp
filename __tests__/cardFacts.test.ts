import {
  baseRating, cardAttributes, cardFace, checklistCode, circulation, inForm, isRookie, productionCode,
} from '@/data/demo/cardFacts';
import { setMembers } from '@/data/demo/cards';
import { teamTable } from '@/data/demo/season';
import { getWorld, participantsFor } from '@/data/demo/world';
import { mintKey } from '@/logic/packs';
import { printRun } from '@/logic/rules';

const NOW = Date.parse('2026-11-23T03:00:00Z');

describe('what is printed on a Stand Card', () => {
  it('rates every competitor 60-99 with six attributes near the overall', () => {
    for (const c of getWorld().competitors) {
      const ovr = baseRating(c);
      expect(ovr).toBeGreaterThanOrEqual(60);
      expect(ovr).toBeLessThanOrEqual(99);
      const attrs = cardAttributes(c);
      expect(attrs).toHaveLength(6);
      const mean = attrs.reduce((a, x) => a + x.value, 0) / attrs.length;
      expect(Math.abs(mean - ovr)).toBeLessThanOrEqual(4);
      for (const a of attrs) expect(a.value).toBeGreaterThanOrEqual(35);
    }
  });

  it('rates stronger competitors higher', () => {
    const field = participantsFor('soccer').slice().sort((a, b) => a.strength - b.strength);
    expect(baseRating(field[field.length - 1])).toBeGreaterThan(baseRating(field[0]));
  });

  it('is the same card on every phone', () => {
    const id = participantsFor('f1')[3].id;
    expect(cardFace(id, NOW)).toEqual(cardFace(id, NOW));
  });

  it('gives each card a unique checklist number within its set', () => {
    for (const sport of ['soccer', 'f1', 'tennis']) {
      const codes = setMembers(sport).map(checklistCode);
      expect(new Set(codes).size).toBe(codes.length);
      expect(codes[0]).toMatch(/^[A-Z0-9]{3}-01$/);
    }
  });

  it('only marks athletes as rookies, and only some of them', () => {
    const all = getWorld().competitors;
    expect(all.filter((c) => c.kind === 'team').some(isRookie)).toBe(false);
    const athletes = all.filter((c) => c.kind === 'athlete');
    const rookies = athletes.filter(isRookie).length;
    expect(rookies).toBeGreaterThan(0);
    expect(rookies).toBeLessThan(athletes.length / 3);
  });

  it('boosts cards of teams on a winning run, and only them', () => {
    for (const row of teamTable('basketball', NOW)) {
      const c = getWorld().byId.get(row.competitorId)!;
      const wins = /^W(\d+)$/.exec(row.streak);
      const form = inForm(c, NOW);
      if (wins && Number(wins[1]) >= 3) expect(form?.boost).toBe(Math.min(3, Number(wins[1]) - 2));
      else expect(form).toBeNull();
      expect(cardFace(c.id, NOW)?.rating).toBe(baseRating(c) + (form?.boost ?? 0));
    }
  });

  it('reports circulation from the mint counts and never above the print run', () => {
    const templateId = `${participantsFor('soccer')[0].id}:legendary`;
    const fresh = circulation(templateId, 'base', null, {});
    expect(fresh.run).toBe(printRun('legendary', 'base', false));
    expect(fresh.minted).toBeGreaterThanOrEqual(0);
    // Once fans have pulled copies on this device, the live count is used.
    expect(circulation(templateId, 'base', null, { [mintKey(templateId)]: 42 }).minted).toBe(42);
    expect(circulation(templateId, 'holo', null, { [mintKey(templateId, 'holo')]: 7 })).toEqual({ minted: 7, run: printRun('legendary', 'holo', false) });
    const c = participantsFor('soccer')[0];
    expect(productionCode(c, 'legendary', 'holo', false)).toMatch(/^S26-[A-Z0-9]+-HL$/);
  });
});
