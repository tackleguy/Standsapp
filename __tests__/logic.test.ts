import { badgeFor } from '@/lib/badge';
import { formatGap, formatOvers, formatToPar, ordinal } from '@/lib/format';
import { containsBlockedWord, maskBlockedWords } from '@/lib/wordFilter';
import { validateBirthYear, validateUsername } from '@/logic/account';
import { computeGateCheck } from '@/logic/gateCheck';
import { rollRarity } from '@/logic/packs';
import { clampStake, potentialPayout, summarizeRecord, validateStake } from '@/logic/predictions';
import { STAKE_MAX, STAKE_MIN } from '@/logic/rules';
import { hasTrackMap, trackFor } from '@/lib/tracks';

describe('badgeFor', () => {
  it('is stable: the same name always gives the same badge', () => {
    expect(badgeFor('Harbor City United')).toEqual(badgeFor('Harbor City United'));
    expect(badgeFor('Harbor City United', 'HCU')).toEqual(badgeFor('harbor city united', 'HCU'));
  });

  it('always returns 1 to 3 initials', () => {
    for (const name of ['A', 'Harbor City United Football Club', 'X Æ', '   ', 'Zara Valdivia', '42']) {
      const { initials } = badgeFor(name);
      expect(initials.length).toBeGreaterThanOrEqual(1);
      expect(initials.length).toBeLessThanOrEqual(3);
    }
    expect(badgeFor('Ironbridge', 'IRONBRIDGE').initials).toBe('IRO');
  });

  it('draws athletes as circles and prefers stored team colours', () => {
    expect(badgeFor('Arlo Vale', 'VAL', 'athlete').shape).toBe('circle');
    expect(badgeFor('Team', 'T', 'team', ['#000000', '#FFFFFF']).background).toBe('#000000');
  });
});

describe('potentialPayout', () => {
  it('matches the database rounding: floor(stake * multiplier)', () => {
    expect(potentialPayout(100, 2)).toBe(200);
    expect(potentialPayout(10, 1.05)).toBe(10);
    expect(potentialPayout(25, 1.87)).toBe(46); // 46.75 -> 46
    expect(potentialPayout(333, 3.33)).toBe(Math.floor(333 * 3.33));
  });
});

describe('stake rules', () => {
  it('refuses values outside 10 to 500', () => {
    expect(validateStake(9, 1000)).not.toBeNull();
    expect(validateStake(501, 1000)).not.toBeNull();
    expect(validateStake(10.5, 1000)).not.toBeNull();
    expect(validateStake(10, 1000)).toBeNull();
    expect(validateStake(500, 1000)).toBeNull();
  });
  it('refuses overspending', () => {
    expect(validateStake(100, 99)).toBe('Not enough Clout.');
  });
  it('clamps picked stakes into range', () => {
    expect(clampStake(0)).toBe(STAKE_MIN);
    expect(clampStake(9999)).toBe(STAKE_MAX);
    expect(clampStake(Number.NaN)).toBe(STAKE_MIN);
    expect(clampStake(73.4)).toBe(73);
  });
});

describe('Gate Check', () => {
  it('starts a streak and grows the bonus', () => {
    const first = computeGateCheck({ clout: 1000, streakDays: 0, lastGateCheck: null }, '2026-11-22');
    expect(first).toEqual({ clout: 110, tix: 11, streakDays: 1 });
    const second = computeGateCheck({ clout: 1110, streakDays: 1, lastGateCheck: '2026-11-22' }, '2026-11-23');
    expect(second).toEqual({ clout: 120, tix: 12, streakDays: 2 });
  });
  it('refuses a second check-in on the same day', () => {
    expect(computeGateCheck({ clout: 1000, streakDays: 3, lastGateCheck: '2026-11-22' }, '2026-11-22')).toHaveProperty('error');
  });
  it('resets the streak after a missed day and tops up to 200', () => {
    const r = computeGateCheck({ clout: 10, streakDays: 9, lastGateCheck: '2026-11-01' }, '2026-11-22');
    expect(r).toEqual({ clout: 190, tix: 11, streakDays: 1 });
  });
  it('caps the streak bonus at 7 days', () => {
    expect(computeGateCheck({ clout: 1000, streakDays: 30, lastGateCheck: '2026-11-21' }, '2026-11-22')).toEqual({ clout: 170, tix: 17, streakDays: 31 });
  });
});

describe('packs', () => {
  it('uses the published odds 70 / 22 / 7 / 1', () => {
    expect(rollRarity(0)).toBe('common');
    expect(rollRarity(0.6999)).toBe('common');
    expect(rollRarity(0.7)).toBe('rare');
    expect(rollRarity(0.9199)).toBe('rare');
    expect(rollRarity(0.92)).toBe('epic');
    expect(rollRarity(0.9899)).toBe('epic');
    expect(rollRarity(0.99)).toBe('legendary');
  });
});

describe('word filter', () => {
  it('blocks bad words, including common disguises', () => {
    expect(containsBlockedWord('what a shit call')).toBe(true);
    expect(containsBlockedWord('Sh1t')).toBe(true);
    expect(containsBlockedWord('fuuuuck')).toBe(true);
    expect(containsBlockedWord('What a goal from Scunthorpe!')).toBe(false);
    expect(containsBlockedWord('Great pass, assessing the class of this team')).toBe(false);
    expect(maskBlockedWords('oh shit')).toBe('oh s***');
  });
});

describe('accounts', () => {
  it('enforces the minimum age of 13', () => {
    expect(validateBirthYear(2020, 2026)).toMatch(/13/);
    expect(validateBirthYear(2013, 2026)).toBeNull();
    expect(validateBirthYear(1800, 2026)).not.toBeNull();
  });
  it('validates usernames', () => {
    expect(validateUsername('paddock_pete')).toBeNull();
    expect(validateUsername('ab')).not.toBeNull();
    expect(validateUsername('Has Spaces')).not.toBeNull();
  });
});

describe('record summary', () => {
  it('counts wins and net Clout on settled calls only', () => {
    const r = summarizeRecord([
      { status: 'won', stake: 100, payout: 250 },
      { status: 'lost', stake: 50, payout: 0 },
      { status: 'open', stake: 10, payout: null },
      { status: 'void', stake: 20, payout: 20 },
    ]);
    expect(r).toEqual({ made: 4, settled: 2, won: 1, winRate: 50, net: 100 });
  });
});

describe('formatting', () => {
  it('formats sport-specific values', () => {
    expect(formatOvers(110)).toBe('18.2');
    expect(formatToPar(0)).toBe('E');
    expect(formatToPar(-7)).toBe('-7');
    expect(formatGap(4.5123)).toBe('+4.512s');
    expect(ordinal(22)).toBe('22nd');
    expect(ordinal(11)).toBe('11th');
  });
});

describe('track maps', () => {
  it('exists for motorsport only and places cars on the circuit', () => {
    expect(hasTrackMap('f1')).toBe(true);
    expect(hasTrackMap('soccer')).toBe(false);
    const t = trackFor('Highveld Ring');
    const a = t.pointAt(0);
    const b = t.pointAt(1);
    expect(Math.abs(a.x - b.x)).toBeLessThan(0.01); // a lap brings you back to the line
    const mid = t.pointAt(0.5);
    expect(mid.x).toBeGreaterThan(0);
    expect(mid.y).toBeGreaterThan(0);
  });
});
