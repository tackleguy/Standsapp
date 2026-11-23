// Stand Cards: pack types, Game Packs, quick sell, trade-ups, sets, showcase.
// Pure rules first, then the same rules enforced by the on-device store.
import { allTemplates, mintedBefore, setMembers } from '@/data/demo/cards';
import { teamPointsIn } from '@/data/demo/cardEarnings';
import { finalState, gameStatsFor, simulate } from '@/data/demo/engines';
import { momentById } from '@/data/demo/moments';
import { lineOf, pointsOf } from '@/data/demo/players/lines';
import { rosterFor } from '@/data/demo/players/roster';
import { eventsForUtcDay } from '@/data/demo/schedule';
import { competitorById } from '@/data/demo/world';
import type { CardTemplate, OwnedCard } from '@/data/types';
import {
  collectorScore, duplicatesToSell, groupCards, quickSellValue, setProgress, sortGroups, validateTradeUp, variantKey,
} from '@/logic/cards';
import { gamePackOpen, mintKey, oddsText, parseMintKey, rollCards, rollFinish } from '@/logic/packs';
import { fantasyTix } from '@/logic/fantasy';
import { CARD_WIN_TIX, PACK_TYPES, PLAYER_CARD_TIX, SHOWCASE_MAX, TEAM_CARD_TIX } from '@/logic/rules';
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

  it('sells Game Packs from the start until two hours after the end', () => {
    const endsAt = 20 * 3_600_000;
    expect(gamePackOpen({ status: 'scheduled', endsAt }, endsAt - 5 * 3_600_000)).toBe(false);
    expect(gamePackOpen({ status: 'live', endsAt }, endsAt - 1)).toBe(true);
    expect(gamePackOpen({ status: 'finished', endsAt }, endsAt + 3_600_000)).toBe(true);
    expect(gamePackOpen({ status: 'finished', endsAt }, endsAt + 3 * 3_600_000)).toBe(false);
    expect(gamePackOpen({ status: 'cancelled', endsAt }, endsAt - 1)).toBe(false);
  });

  it('picks the nearest rarity, rarer first, when a pool lacks the rolled one', () => {
    const templates: CardTemplate[] = [
      { id: 'a', competitorId: 'x', rarity: 'common', season: '2026' },
      { id: 'b', competitorId: 'x', rarity: 'epic', season: '2026' },
    ];
    // Rolled rare (no rare in the pool): epic and common are equally near, so the rarer one wins.
    const r = rollCards({ pack: { ...PACK_TYPES.daily, odds: [{ rarity: 'rare', chance: 1 }] }, templates, mint: {}, random: seq(0, 0.5, 0), mintedBefore: () => 0 });
    if ('error' in r) throw new Error(r.error);
    expect(r.cards[0].rarity).toBe('epic');
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

  it('fills packs with Plays and Performances from recent games', () => {
    const r = useUserStore.getState().openPack({ packId: 'standard', sportId: 'american_football' }, Date.now());
    if ('error' in r) throw new Error(r.error);
    for (const c of r.cards) {
      expect(['play', 'performance']).toContain(c.kind);
      expect(c.playerId).toBeTruthy();
      expect(c.gameId).toBeTruthy();
      expect(competitorById(c.competitorId)?.sportId).toBe('american_football');
      expect(momentById(c.templateId)?.rarity).toBe(c.rarity);
    }
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
    const r = useUserStore.getState().openPack({ packId: 'standard', sportId: 'mma' }, Date.now());
    if ('error' in r) throw new Error(r.error);
    expect(r.isNew).toHaveLength(3);
    const keys = r.cards.map(variantKey);
    expect(new Set(keys).size === 3 ? r.isNew.every(Boolean) : r.isNew.some((x) => !x)).toBe(true);
    expect(r.isNew[0]).toBe(true); // the first card of a fresh collection is always new
  });
});

describe('Game Packs', () => {
  beforeEach(() => signUp());
  const meta = eventsForUtcDay(DAY).find((m) => m.sportId === 'american_football' && !m.disruption)!;

  it('sells that game\'s plays while it is on, and its performances once it is over', () => {
    const early = useUserStore.getState().openPack({ packId: 'game', eventId: meta.id }, meta.startsAt - 3 * 3_600_000);
    expect(early).toEqual({ error: 'The Game Pack for this game is closed.' });
    const mid = meta.startsAt + meta.durationMs * 0.5;
    const live = useUserStore.getState().openPack({ packId: 'game', eventId: meta.id }, mid);
    if ('error' in live) throw new Error(live.error);
    expect(live.cards).toHaveLength(2);
    for (const c of live.cards) {
      expect(c.kind).toBe('play');
      expect(c.gameId).toBe(meta.id);
      expect(c.eventId).toBe(meta.id);
      expect(momentById(c.templateId)!.at).toBeLessThanOrEqual(mid);
    }
    const end = finalState(meta).endsAt;
    const after = useUserStore.getState().openPack({ packId: 'game', eventId: meta.id }, end + 1000);
    expect(after).toHaveProperty('cards');
    expect(useUserStore.getState().openPack({ packId: 'game', eventId: meta.id }, end + 3 * 3_600_000)).toHaveProperty('error');
    expect(useUserStore.getState().openPack({ packId: 'game', eventId: 'nope' }, end)).toHaveProperty('error');
  });

  it('does not pay classic cards for wins that finished before the card was owned', () => {
    const end = finalState(meta).endsAt;
    const winnerId = simulate(meta, end + 1000).entries.find((e) => e.isWinner)!.competitorId;
    useUserStore.setState({ cards: [card({ competitorId: winnerId, acquiredAt: end + 500 })] });
    const r = useUserStore.getState().settle(end + 1000);
    expect(r.tix).toBe(0);
  });

  it('still pays classic cards when their team wins', () => {
    const end = finalState(meta).endsAt;
    const winnerId = simulate(meta, end + 1000).entries.find((e) => e.isWinner)!.competitorId;
    useUserStore.setState({ cards: [card({ competitorId: winnerId, rarity: 'epic', acquiredAt: meta.startsAt - 1000 })], tix: 0 });
    const r = useUserStore.getState().settle(end + 1000);
    expect(r.tix).toBe(CARD_WIN_TIX.epic);
  });
});

describe('player and team cards', () => {
  beforeEach(() => signUp(1000));
  const meta = eventsForUtcDay(DAY).find((m) => m.sportId === 'american_football' && !m.disruption)!;
  const homeId = meta.competitorIds[0];
  const qb = rosterFor(homeId).find((p) => p.pos === 'QB')!;
  const rb = rosterFor(homeId).find((p) => p.pos === 'RB')!;

  it('gives the first player card free, then charges 200 Tix, and never twice for one player', () => {
    const first = useUserStore.getState().getPlayerCard(qb.id, meta.startsAt - 60_000);
    if ('error' in first) throw new Error(first.error);
    expect(first.price).toBe(0);
    expect(first.card).toMatchObject({ kind: 'player', playerId: qb.id, competitorId: homeId, earned: 0, source: 'pick' });
    expect(useUserStore.getState().tix).toBe(1000);
    expect(useUserStore.getState().getPlayerCard(qb.id, meta.startsAt)).toHaveProperty('error');
    const second = useUserStore.getState().getPlayerCard(rb.id, meta.startsAt - 60_000);
    if ('error' in second) throw new Error(second.error);
    expect(second.price).toBe(PLAYER_CARD_TIX);
    expect(useUserStore.getState().tix).toBe(1000 - PLAYER_CARD_TIX);
  });

  it('charges 600 Tix for a team card and refuses when short', () => {
    useUserStore.setState({ tix: TEAM_CARD_TIX - 1 });
    expect(useUserStore.getState().getTeamCard(homeId, Date.now())).toEqual({ error: 'You need 1 more Tix.' });
    useUserStore.setState({ tix: TEAM_CARD_TIX });
    const r = useUserStore.getState().getTeamCard(homeId, Date.now());
    if ('error' in r) throw new Error(r.error);
    expect(r.card).toMatchObject({ kind: 'team', competitorId: homeId });
    expect(useUserStore.getState().tix).toBe(0);
    expect(useUserStore.getState().getTeamCard(homeId, Date.now())).toHaveProperty('error');
  });

  it('pays a player card its player\'s fantasy points, rounded, once per game', () => {
    useUserStore.getState().getPlayerCard(qb.id, meta.startsAt - 60_000);
    const gs = gameStatsFor(meta);
    const points = pointsOf('american_football', lineOf('american_football', gs, qb.id));
    const end = finalState(meta).endsAt;
    useUserStore.setState({ tix: 0 });
    expect(useUserStore.getState().settle(meta.startsAt + 60_000).tix).toBe(0); // not finished yet
    const r = useUserStore.getState().settle(end + 1000);
    expect(r.tix).toBeGreaterThanOrEqual(fantasyTix(points));
    const saved = useUserStore.getState().cards.find((c) => c.kind === 'player')!;
    expect(saved.earned).toBe(fantasyTix(points));
    expect(useUserStore.getState().settle(end + 2000).tix).toBe(0); // paid once
  });

  it('pays a team card its three best players\' points', () => {
    useUserStore.getState().getTeamCard(homeId, meta.startsAt - 60_000);
    useUserStore.setState({ tix: 0 });
    const end = finalState(meta).endsAt;
    useUserStore.getState().settle(end + 1000);
    const team = useUserStore.getState().cards.find((c) => c.kind === 'team')!;
    expect(team.earned).toBe(fantasyTix(teamPointsIn(homeId, meta).points));
    expect(team.earned).toBeGreaterThan(0);
  });

  it('only counts games that start after you got the card', () => {
    useUserStore.getState().getPlayerCard(qb.id, meta.startsAt + 60_000);
    useUserStore.setState({ tix: 0 });
    const r = useUserStore.getState().settle(finalState(meta).endsAt + 1000);
    expect(useUserStore.getState().cards[0].earned).toBe(0);
    expect(r.tix).toBe(0);
  });

  it('never quick sells or trades up player and team cards', () => {
    const r = useUserStore.getState().getPlayerCard(qb.id, Date.now());
    if ('error' in r) throw new Error(r.error);
    expect(useUserStore.getState().quickSell([r.card.id], Date.now())).toHaveProperty('error');
    expect(quickSellValue(r.card)).toBe(0);
    const five = [0, 1, 2, 3, 4].map((i) => ({ ...r.card, id: `p${i}` }));
    expect(validateTradeUp(five, [])).toMatch(/cannot be traded up/);
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
    const five = Array.from({ length: 5 }, (_, i) => card({ competitorId: `tennis.a${i}` }));
    const keep = card({ competitorId: 'soccer.t1' });
    useUserStore.setState({ cards: [...five, keep] });
    const r = useUserStore.getState().tradeUp(five.map((c) => c.id), Date.now());
    if ('error' in r) throw new Error(r.error);
    expect(r.cards[0].rarity).toBe('rare');
    expect(competitorById(r.cards[0].competitorId)?.sportId).toBe('tennis');
    expect(r.cards[0].source).toBe('tradeup');
    expect(['play', 'performance']).toContain(r.cards[0].kind);
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
    expect(up.freePlayerUsed).toBe(false);
    expect(up.tix).toBe(40);
  });
});
