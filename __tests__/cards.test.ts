// Stand Cards: pack types, Game Packs, quick sell, trade-ups, sets, showcase.
// Pure rules first, then the same rules enforced by the on-device store.
import { allTemplates, mintedBefore, setMembers } from '@/data/demo/cards';
import { finalState, simulate } from '@/data/demo/engines';
import { eventsForUtcDay } from '@/data/demo/schedule';
import { competitorById } from '@/data/demo/world';
import type { CardTemplate, OwnedCard } from '@/data/types';
import {
  collectorScore, duplicatesToSell, groupCards, quickSellValue, setProgress, sortGroups, validateTradeUp, variantKey,
} from '@/logic/cards';
import { gamePackOpen, mintKey, oddsText, parseMintKey, rollCards, rollFinish } from '@/logic/packs';
import { CARD_WIN_TIX, GAME_DAY_WIN_MULTIPLIER, PACK_TYPES, SHOWCASE_MAX } from '@/logic/rules';
import { useUserStore } from '@/store/user';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const DAY = Date.parse('2026-11-22T00:00:00Z');
const always = (n: number) => () => n;
const seq = (...values: number[]) => { let i = 0; return () => values[i++ % values.length]; };

let n = 0;
function card(over: Partial<OwnedCard> & { competitorId: string }): OwnedCard {
  const rarity = over.rarity ?? 'common';
  n++;
  return { id: `card${n}`, templateId: `${over.competitorId}:${rarity}`, rarity, serial: n, acquiredAt: n, finish: 'base', ...over };
}

describe('pack types', () => {
  it('publishes odds that add up to 100% for every card slot', () => {
    for (const pack of Object.values(PACK_TYPES)) {
      const sum = (o: typeof pack.odds) => o.reduce((a, x) => a + x.chance, 0);
      expect(sum(pack.odds)).toBeCloseTo(1, 10);
      if (pack.guaranteed) expect(sum(pack.guaranteed.odds)).toBeCloseTo(1, 10);
    }
  });

  it('keeps the guaranteed last card of Premium and Elite packs', () => {
    const templates = allTemplates().filter((t) => t.competitorId.startsWith('soccer.'));
    const premium = rollCards({ pack: PACK_TYPES.premium, templates, mint: {}, random: always(0), mintedBefore: () => 0 });
    if ('error' in premium) throw new Error(premium.error);
    expect(premium.cards.map((c) => c.rarity)).toEqual(['common', 'common', 'common', 'common', 'rare']);
    const elite = rollCards({ pack: PACK_TYPES.elite, templates, mint: {}, random: always(0), mintedBefore: () => 0 });
    if ('error' in elite) throw new Error(elite.error);
    expect(elite.cards.map((c) => c.rarity)).toEqual(['rare', 'rare', 'epic']);
  });

  it('numbers each card in its print run and rolls Holo 1 in 10', () => {
    expect(rollFinish(0.05)).toBe('holo');
    expect(rollFinish(0.1)).toBe('base');
    const templates: CardTemplate[] = [{ id: 'x:legendary', competitorId: 'x', rarity: 'legendary', season: '2026' }];
    // rarity roll, finish roll (Holo), pick roll
    const r = rollCards({ pack: PACK_TYPES.daily, templates, mint: {}, random: seq(0.999, 0.01, 0), mintedBefore: () => 7 });
    if ('error' in r) throw new Error(r.error);
    expect(r.cards[0]).toMatchObject({ rarity: 'legendary', finish: 'holo', serial: 8 });
    expect(r.mint['x:legendary+holo']).toBe(8);
  });

  it('falls back to the plain card when the Holo run is sold out, and refuses when everything is', () => {
    const templates: CardTemplate[] = [{ id: 'x:legendary', competitorId: 'x', rarity: 'legendary', season: '2026' }];
    const holoSoldOut = (key: string) => (key.includes('+holo') ? 25 : 3);
    const r = rollCards({ pack: PACK_TYPES.daily, templates, mint: {}, random: seq(0.999, 0.01, 0), mintedBefore: holoSoldOut });
    if ('error' in r) throw new Error(r.error);
    expect(r.cards[0]).toMatchObject({ finish: 'base', serial: 4 });
    const none = rollCards({ pack: PACK_TYPES.daily, templates, mint: {}, random: seq(0.999, 0.5, 0), mintedBefore: () => 100 });
    expect(none).toHaveProperty('error');
  });

  it('round-trips print-run keys for Holo and Game Day cards', () => {
    const key = mintKey('soccer.t1:rare', 'holo', 'soccer-2026-11-22-03');
    expect(key).toBe('soccer.t1:rare+holo@soccer-2026-11-22-03');
    expect(parseMintKey(key)).toEqual({ templateId: 'soccer.t1:rare', finish: 'holo', eventId: 'soccer-2026-11-22-03' });
    expect(parseMintKey('soccer.t1:rare')).toEqual({ templateId: 'soccer.t1:rare', finish: 'base', eventId: null });
    expect(mintedBefore('soccer.t1:legendary@soccer-2026-11-22-03')).toBeLessThanOrEqual(3); // 30% of a run of 10
  });

  it('sells Game Packs from two hours before the start until the game ends', () => {
    const meta = { startsAt: 10 * 3_600_000 };
    expect(gamePackOpen({ status: 'scheduled', meta }, meta.startsAt - 3 * 3_600_000)).toBe(false);
    expect(gamePackOpen({ status: 'scheduled', meta }, meta.startsAt - 3_600_000)).toBe(true);
    expect(gamePackOpen({ status: 'live', meta }, meta.startsAt + 1)).toBe(true);
    expect(gamePackOpen({ status: 'finished', meta }, meta.startsAt + 1)).toBe(false);
    expect(gamePackOpen({ status: 'cancelled', meta }, meta.startsAt - 1)).toBe(false);
  });

  it('formats odds for the odds table', () => {
    expect(oddsText(0)).toBe('–');
    expect(oddsText(0.005)).toBe('0.5%');
    expect(oddsText(0.22)).toBe('22%');
  });
});

describe('collection rules', () => {
  it('values quick sells by rarity, with Holo worth double', () => {
    expect(quickSellValue({ rarity: 'common' })).toBe(1);
    expect(quickSellValue({ rarity: 'rare', finish: 'base' })).toBe(3);
    expect(quickSellValue({ rarity: 'legendary', finish: 'holo' })).toBe(80);
  });

  it('keeps the best copy of every card and never sells favorites or showcased cards', () => {
    const a1 = card({ competitorId: 'a', serial: 50 });
    const a2 = card({ competitorId: 'a', serial: 12 });
    const a3 = card({ competitorId: 'a', serial: 90 });
    const aHolo = card({ competitorId: 'a', finish: 'holo' });
    const b1 = card({ competitorId: 'b', serial: 5 });
    const b2 = card({ competitorId: 'b', serial: 9, favorite: true });
    const c1 = card({ competitorId: 'c', serial: 1 });
    const c2 = card({ competitorId: 'c', serial: 2 });
    const sell = duplicatesToSell([a1, a2, a3, aHolo, b1, b2, c1, c2], [c1.id, c2.id]).map((c) => c.id).sort();
    // a: keep #12, sell #50 and #90. Holo is a different card. b: keep the favorite, sell #5. c: both showcased.
    expect(sell).toEqual([a1.id, a3.id, b1.id].sort());
  });

  it('only allows five unprotected cards of one rarity below Legendary to trade up', () => {
    const five = Array.from({ length: 5 }, () => card({ competitorId: 'a' }));
    expect(validateTradeUp(five, [])).toBeNull();
    expect(validateTradeUp(five.slice(0, 4), [])).toMatch(/exactly 5/);
    expect(validateTradeUp([...five.slice(0, 4), card({ competitorId: 'a', rarity: 'rare' })], [])).toMatch(/same rarity/);
    expect(validateTradeUp(five, [five[0].id])).toMatch(/protected|cannot/);
    expect(validateTradeUp(Array.from({ length: 5 }, () => card({ competitorId: 'a', rarity: 'legendary' })), [])).toMatch(/top rarity/);
  });

  it('tracks set progress by team or athlete, any rarity', () => {
    const p = setProgress(['a', 'b', 'c'], [card({ competitorId: 'a' }), card({ competitorId: 'a', rarity: 'epic' }), card({ competitorId: 'c' })]);
    expect(p).toMatchObject({ total: 3, owned: 2, complete: false, reward: 30 });
    expect(setProgress(['a'], [card({ competitorId: 'a' })]).complete).toBe(true);
  });

  it('stacks duplicates and sorts the rarest first', () => {
    const groups = groupCards([card({ competitorId: 'a' }), card({ competitorId: 'a' }), card({ competitorId: 'b', rarity: 'epic' })]);
    expect(groups.map((g) => g.cards.length).sort()).toEqual([1, 2]);
    expect(sortGroups(groups, 'rarity', (id) => id)[0].top.rarity).toBe('epic');
    expect(collectorScore([{ rarity: 'legendary', finish: 'holo' }, { rarity: 'common' }], 1)).toBe(200 + 1 + 100);
  });
});

function signUp(tix = 1000) {
  useUserStore.getState().deleteAccount();
  expect(useUserStore.getState().createAccount({ username: 'collector_1', displayName: 'Collector', birthYear: 1990, email: '' })).toBeNull();
  useUserStore.setState({ tix });
}

describe('packs in the store', () => {
  beforeEach(() => signUp());

  it('gives one free daily pack per UTC day', () => {
    const open = (now: number) => useUserStore.getState().openPack({ packId: 'daily' }, now);
    const first = open(DAY + 1000);
    expect(first).toHaveProperty('cards');
    expect(useUserStore.getState().tix).toBe(1000);
    expect(open(DAY + 5000)).toHaveProperty('error');
    expect(open(DAY + 86_400_000 + 1000)).toHaveProperty('cards');
    expect(useUserStore.getState().cards).toHaveLength(2);
  });

  it('charges each pack its price and honors its guarantee and sport', () => {
    for (let i = 0; i < 5; i++) {
      const r = useUserStore.getState().openPack({ packId: 'premium', sportId: 'tennis' }, Date.now());
      if ('error' in r) throw new Error(r.error);
      expect(r.cards).toHaveLength(5);
      expect(r.cards[4].rarity).not.toBe('common');
      expect(r.cards.every((c) => competitorById(c.competitorId)?.sportId === 'tennis')).toBe(true);
    }
    expect(useUserStore.getState().tix).toBe(1000 - 5 * 75);
    const elite = useUserStore.getState().openPack({ packId: 'elite' }, Date.now());
    if ('error' in elite) throw new Error(elite.error);
    expect(elite.cards.every((c) => c.rarity !== 'common')).toBe(true);
    expect(['epic', 'legendary']).toContain(elite.cards[2].rarity);
  });

  it('marks first copies NEW and repeats as duplicates', () => {
    const r = useUserStore.getState().openPack({ packId: 'standard', sportId: 'netball' }, Date.now());
    if ('error' in r) throw new Error(r.error);
    expect(r.isNew).toHaveLength(3);
    const keys = r.cards.map(variantKey);
    expect(new Set(keys).size === 3 ? r.isNew.every(Boolean) : r.isNew.some((x) => !x)).toBe(true);
    expect(r.isNew[0]).toBe(true); // the first card of a fresh collection is always new
  });
});

describe('Game Packs', () => {
  beforeEach(() => signUp());
  const meta = eventsForUtcDay(DAY).find((m) => m.sportId === 'basketball' && !m.disruption)!;

  it('only sells while the game is on, and only cards from that game', () => {
    const early = useUserStore.getState().openPack({ packId: 'game', eventId: meta.id }, meta.startsAt - 3 * 3_600_000);
    expect(early).toEqual({ error: 'The Game Pack for this game is closed.' });
    const live = useUserStore.getState().openPack({ packId: 'game', eventId: meta.id }, meta.startsAt + 60_000);
    if ('error' in live) throw new Error(live.error);
    expect(live.cards).toHaveLength(2);
    expect(live.cards.every((c) => meta.competitorIds.includes(c.competitorId) && c.eventId === meta.id)).toBe(true);
    const after = finalState(meta).endsAt + 1000;
    expect(useUserStore.getState().openPack({ packId: 'game', eventId: meta.id }, after)).toHaveProperty('error');
    expect(useUserStore.getState().openPack({ packId: 'game', eventId: 'nope' }, after)).toHaveProperty('error');
  });

  it('pays Game Day cards double when their side wins that game, and stamps them WON', () => {
    const live = useUserStore.getState().openPack({ packId: 'game', eventId: meta.id }, meta.startsAt + 60_000);
    if ('error' in live) throw new Error(live.error);
    const end = finalState(meta).endsAt + 1000;
    const final = simulate(meta, end);
    const winnerId = final.entries.find((e) => e.isWinner)?.competitorId;
    expect(winnerId).toBeTruthy();
    const before = useUserStore.getState().tix;
    useUserStore.getState().settle(end);
    const after = useUserStore.getState();
    let expected = 0;
    for (const c of live.cards) {
      const saved = after.cards.find((x) => x.id === c.id)!;
      if (c.competitorId === winnerId) {
        expect(saved.wonGame).toBe(true);
        expected += CARD_WIN_TIX[c.rarity] * GAME_DAY_WIN_MULTIPLIER;
      } else {
        expect(saved.wonGame).toBeFalsy();
      }
    }
    expect(after.tix - before).toBeGreaterThanOrEqual(expected);
  });

  it('does not pay for wins that finished before the card was owned', () => {
    const end = finalState(meta).endsAt;
    const winnerId = simulate(meta, end + 1000).entries.find((e) => e.isWinner)!.competitorId;
    useUserStore.setState({ cards: [card({ competitorId: winnerId, acquiredAt: end + 500 })] });
    const r = useUserStore.getState().settle(end + 1000);
    expect(r.tix).toBe(0);
  });
});

describe('quick sell, favorites, showcase, trade-ups and sets', () => {
  beforeEach(() => signUp(0));

  it('quick sells cards for Tix, but never favorites or showcased cards', () => {
    const a = card({ competitorId: 'soccer.t1', rarity: 'epic' });
    const b = card({ competitorId: 'soccer.t2', finish: 'holo', rarity: 'rare' });
    const c = card({ competitorId: 'soccer.t3' });
    useUserStore.setState({ cards: [a, b, c] });
    const s = useUserStore.getState();
    s.toggleFavorite(a.id);
    expect(s.toggleShowcase(c.id)).toBeNull();
    expect(useUserStore.getState().quickSell([a.id], Date.now())).toHaveProperty('error');
    expect(useUserStore.getState().quickSell([c.id], Date.now())).toHaveProperty('error');
    expect(useUserStore.getState().quickSell([b.id], Date.now())).toEqual({ sold: 1, tix: 6 });
    expect(useUserStore.getState().tix).toBe(6);
    expect(useUserStore.getState().cards.map((x) => x.id)).toEqual([a.id, c.id]);
    expect(useUserStore.getState().quickSell([b.id], Date.now())).toHaveProperty('error');
  });

  it(`holds at most ${SHOWCASE_MAX} cards in the showcase`, () => {
    const many = Array.from({ length: SHOWCASE_MAX + 1 }, (_, i) => card({ competitorId: `soccer.t${i}` }));
    useUserStore.setState({ cards: many });
    for (const c of many.slice(0, SHOWCASE_MAX)) expect(useUserStore.getState().toggleShowcase(c.id)).toBeNull();
    expect(useUserStore.getState().toggleShowcase(many[SHOWCASE_MAX].id)).toMatch(/holds/);
    expect(useUserStore.getState().toggleShowcase(many[0].id)).toBeNull(); // removing always works
    expect(useUserStore.getState().showcase).toHaveLength(SHOWCASE_MAX - 1);
  });

  it('trades five cards from one sport up to one better card from that sport', () => {
    const five = Array.from({ length: 5 }, (_, i) => card({ competitorId: `cricket.t${i}` }));
    const keep = card({ competitorId: 'soccer.t1' });
    useUserStore.setState({ cards: [...five, keep] });
    const r = useUserStore.getState().tradeUp(five.map((c) => c.id), Date.now());
    if ('error' in r) throw new Error(r.error);
    expect(r.cards[0].rarity).toBe('rare');
    expect(competitorById(r.cards[0].competitorId)?.sportId).toBe('cricket');
    expect(r.cards[0].source).toBe('tradeup');
    expect(useUserStore.getState().cards.map((c) => c.id)).toEqual([keep.id, r.cards[0].id]);
    expect(useUserStore.getState().tradeUp(five.map((c) => c.id), Date.now())).toHaveProperty('error');
  });

  it('pays a set reward once, only when every card is collected', () => {
    const members = setMembers('netball');
    useUserStore.setState({ cards: members.slice(1).map((m) => card({ competitorId: m.id })) });
    expect(useUserStore.getState().claimSet('netball', Date.now())).toHaveProperty('error');
    useUserStore.setState({ cards: members.map((m) => card({ competitorId: m.id, rarity: 'epic' })) });
    expect(useUserStore.getState().claimSet('netball', Date.now())).toEqual({ tix: members.length * 10 });
    expect(useUserStore.getState().tix).toBe(members.length * 10);
    expect(useUserStore.getState().claimSet('netball', Date.now())).toHaveProperty('error');
  });

  it('keeps every card from older saves when upgrading', () => {
    const migrate = useUserStore.persist.getOptions().migrate!;
    const old = { tix: 40, cards: [{ id: 'c1', templateId: 'soccer.t1:rare', competitorId: 'soccer.t1', rarity: 'rare', serial: 9, acquiredAt: 1 }] };
    const up = migrate(old, 1) as ReturnType<typeof useUserStore.getState>;
    expect(up.cards[0]).toMatchObject({ id: 'c1', finish: 'base', serial: 9 });
    expect(up.showcase).toEqual([]);
    expect(up.claimedSets).toEqual([]);
    expect(up.lastFreePack).toBeNull();
    expect(up.tix).toBe(40);
  });
});
