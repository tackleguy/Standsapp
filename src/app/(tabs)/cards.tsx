// Stand Cards: the Pack Store, your collection (stacked, sorted, filtered),
// quick sell, trade-ups, and sport sets with rewards.
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { PackArt } from '@/components/cards/PackArt';
import { AnyCard } from '@/components/cards/CardFaces';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Icon, sportIcon } from '@/components/ui/Icon';
import { Segmented, StatTile, Surface } from '@/components/ui/Misc';
import { Header, Screen } from '@/components/ui/Screen';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState } from '@/components/ui/StateViews';
import { SPORTS } from '@/config/sports';
import { competitorById } from '@/data/api';
import { SEASON, setMembers } from '@/data/demo/cards';
import type { CardRarity } from '@/data/types';
import { useNow } from '@/hooks/useNow';
import { currentTime, formatNumber, utcDayKey } from '@/lib/format';
import { tapMedium } from '@/lib/haptics';
import {
  collectorScore, duplicatesToSell, groupCards, isChosen, isGameDay, isHolo, setProgress, SORT_LABELS,
  sortGroups, totalSellValue, type CardSort,
} from '@/logic/cards';
import { MyPlayersView } from '@/components/cards/MyPlayers';
import { SHELF_PACKS } from '@/logic/rules';
import { toast } from '@/store/toast';
import { useUserStore } from '@/store/user';
import { colors, radius, space, type } from '@/theme/tokens';

type Filter = CardRarity | 'all' | 'plays' | 'performances' | 'favorites' | 'holo' | 'gameday' | 'dupes';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All cards' },
  { value: 'plays', label: 'Plays' },
  { value: 'performances', label: 'Performances' },
  { value: 'legendary', label: 'Legendary' },
  { value: 'epic', label: 'Epic' },
  { value: 'rare', label: 'Rare' },
  { value: 'common', label: 'Common' },
  { value: 'favorites', label: '★ Favorites' },
  { value: 'holo', label: 'Holo' },
  { value: 'gameday', label: 'Game Day' },
  { value: 'dupes', label: 'Duplicates' },
];

const nameOf = (id: string) => competitorById(id)?.name ?? '';

export default function CardsScreen() {
  const tix = useUserStore((s) => s.tix);
  const cards = useUserStore((s) => s.cards);
  const claimed = useUserStore((s) => s.claimedSets);
  const [view, setView] = useState<'mine' | 'collection' | 'sets'>('mine');
  const chosenCount = useMemo(() => cards.filter(isChosen).length, [cards]);
  const claimable = useMemo(() => SPORTS.filter((sp) => !claimed.includes(sp.id)
    && setProgress(setMembers(sp.id).map((m) => m.id), cards).complete).length, [cards, claimed]);

  return (
    <Screen>
      <Header title="Stand Cards" large right={<Text style={styles.tix}>🎟 {formatNumber(tix)} Tix</Text>} />
      <View style={styles.tabs}>
        <Segmented value={view} onChange={setView} options={[
          { value: 'mine', label: `My players · ${chosenCount}` },
          { value: 'collection', label: `Collection · ${cards.length - chosenCount}` },
          { value: 'sets', label: 'Sets', badge: claimable || undefined },
        ]} />
      </View>
      {view === 'mine' ? <MyPlayersView /> : view === 'collection' ? <CollectionView /> : <SetsView />}
    </Screen>
  );
}

function CollectionView() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const now = useNow(60_000);
  const cards = useUserStore((s) => s.cards);
  const showcase = useUserStore((s) => s.showcase);
  const claimed = useUserStore((s) => s.claimedSets);
  const lastFreePack = useUserStore((s) => s.lastFreePack);
  const quickSell = useUserStore((s) => s.quickSell);
  const [sport, setSport] = useState('all');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<CardSort>('newest');
  const [sheet, setSheet] = useState<'sort' | 'sell' | null>(null);
  const cols = width > 700 ? 5 : 3;
  const cardWidth = Math.floor((Math.min(width, 900) - space.lg * 2 - space.sm * (cols - 1)) / cols);
  const freeReady = lastFreePack !== utcDayKey(now);

  const pulled = useMemo(() => cards.filter((c) => !isChosen(c)), [cards]);
  const groups = useMemo(() => {
    const inSport = pulled.filter((c) => sport === 'all' || competitorById(c.competitorId)?.sportId === sport);
    const all = groupCards(inSport, showcase).filter((g) => {
      switch (filter) {
        case 'all': return true;
        case 'plays': return g.top.kind === 'play';
        case 'performances': return g.top.kind === 'performance';
        case 'favorites': return g.cards.some((c) => c.favorite);
        case 'holo': return isHolo(g.top);
        case 'gameday': return isGameDay(g.top);
        case 'dupes': return g.cards.length > 1;
        default: return g.top.rarity === filter;
      }
    });
    return sortGroups(all, sort, nameOf);
  }, [pulled, showcase, sport, filter, sort]);
  const sportsOwned = useMemo(() => SPORTS.filter((s) => pulled.some((c) => competitorById(c.competitorId)?.sportId === s.id)), [pulled]);
  const dupes = useMemo(() => duplicatesToSell(cards, showcase), [cards, showcase]);
  const unique = useMemo(() => groupCards(pulled).length, [pulled]);
  const dupeValue = totalSellValue(dupes);

  const sellDupes = () => {
    setSheet(null);
    const r = quickSell(dupes.map((c) => c.id), currentTime());
    if ('error' in r) { toast(r.error, 'error'); return; }
    tapMedium();
    toast(`Quick sold ${r.sold} duplicate${r.sold === 1 ? '' : 's'} · +${r.tix} Tix`, 'success');
  };

  return (
    <>
      <FlatList
        data={groups}
        key={cols}
        numColumns={cols}
        keyExtractor={(g) => g.key}
        columnWrapperStyle={{ gap: space.sm, paddingHorizontal: space.lg }}
        contentContainerStyle={{ gap: space.sm, paddingBottom: 60 }}
        ListHeaderComponent={
          <View style={{ gap: space.md }}>
            <Pressable onPress={() => router.push('/pack')} accessibilityRole="button" accessibilityLabel="Open the Pack Store"
              style={({ pressed }) => [styles.store, freeReady && styles.storeReady, pressed && { opacity: 0.9 }]}>
              <View style={styles.packs}>
                {SHELF_PACKS.map((id, i) => (
                  <View key={id} style={{ marginLeft: i === 0 ? 0 : -18, transform: [{ rotate: `${(i - 1.5) * 6}deg` }] }}>
                    <PackArt packId={id} width={40} />
                  </View>
                ))}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.storeTitle}>Pack Store</Text>
                <Text style={styles.storeBody}>
                  {freeReady ? 'Your free daily pack is ready!' : 'Standard, Premium, Elite and Game Packs.'}
                </Text>
              </View>
              {freeReady ? <View style={styles.freeDot} /> : null}
              <Icon name="chevron-forward" size={20} color={colors.textDim} />
            </Pressable>

            <View style={styles.tiles}>
              <StatTile label="Cards" value={formatNumber(pulled.length)} />
              <StatTile label="Unique" value={formatNumber(unique)} />
              <StatTile label="Score" value={formatNumber(collectorScore(cards, claimed.length), true)} accent />
            </View>

            <View style={styles.tools}>
              <Button label={dupes.length ? `Sell ${dupes.length} dupes` : 'No dupes'} icon="pricetag" small variant="secondary"
                style={{ flex: 1 }} disabled={dupes.length === 0} onPress={() => setSheet('sell')} />
              <Button label="Trade up" icon="arrow-up-circle" small variant="secondary" style={{ flex: 1 }} onPress={() => router.push('/tradeup')} />
              <Button label="Sort" icon="swap-vertical" small variant="secondary" onPress={() => setSheet('sort')} />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip label="All sports" icon="apps" selected={sport === 'all'} onPress={() => setSport('all')} />
              {sportsOwned.map((s) => <Chip key={s.id} label={s.name} icon={sportIcon(s.id)} selected={sport === s.id} onPress={() => setSport(s.id)} />)}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {FILTERS.map((f) => <Chip key={f.value} label={f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} />)}
            </ScrollView>
            <Text style={styles.count}>{SORT_LABELS[sort]} · {groups.length} card{groups.length === 1 ? '' : 's'} shown</Text>
          </View>
        }
        ListEmptyComponent={<EmptyState icon="albums" title={pulled.length ? 'No cards match' : 'No Plays or Performances yet'}
          body={pulled.length ? 'Try a different filter.' : 'Open your free daily pack in the Pack Store to start collecting plays and performances.'}
          actionLabel={pulled.length ? undefined : 'Open the Pack Store'} onAction={pulled.length ? undefined : () => router.push('/pack')} />}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push({ pathname: '/card/[id]', params: { id: item.top.id } })} accessibilityRole="button">
            <AnyCard card={item.top} width={cardWidth} count={item.cards.length} favorite={item.cards.some((c) => c.favorite)} />
          </Pressable>
        )}
      />

      <Sheet visible={sheet === 'sort'} onClose={() => setSheet(null)} title="Sort cards">
        {(Object.keys(SORT_LABELS) as CardSort[]).map((k) => (
          <Pressable key={k} onPress={() => { setSort(k); setSheet(null); }} accessibilityRole="radio" accessibilityState={{ checked: sort === k }}
            style={styles.option}>
            <Text style={styles.optionText}>{SORT_LABELS[k]}</Text>
            {sort === k ? <Icon name="checkmark" size={20} color={colors.accent} /> : null}
          </Pressable>
        ))}
      </Sheet>

      <Sheet visible={sheet === 'sell'} onClose={() => setSheet(null)} title="Quick sell duplicates?">
        <Text style={styles.sheetBody}>
          Sell {dupes.length} spare cop{dupes.length === 1 ? 'y' : 'ies'} for {dupeValue} Tix. You keep your best copy of every card
          (favorites first, then the lowest serial). Favorites and showcased cards are never sold.
        </Text>
        <Button label={`Sell ${dupes.length} · +${dupeValue} Tix`} icon="pricetag" variant="danger" onPress={sellDupes} />
        <Button label="Keep them" variant="secondary" onPress={() => setSheet(null)} />
      </Sheet>
    </>
  );
}

function SetsView() {
  const router = useRouter();
  const cards = useUserStore((s) => s.cards);
  const claimed = useUserStore((s) => s.claimedSets);
  const followed = useUserStore((s) => s.followedSports);
  const rows = useMemo(() => SPORTS.map((sp) => {
    const p = setProgress(setMembers(sp.id).map((m) => m.id), cards);
    return { sport: sp, p, done: claimed.includes(sp.id) };
  }).sort((a, b) =>
    Number(b.p.complete && !b.done) - Number(a.p.complete && !a.done)
    || b.p.owned / b.p.total - a.p.owned / a.p.total
    || Number(followed.includes(b.sport.id)) - Number(followed.includes(a.sport.id))), [cards, claimed, followed]);

  return (
    <ScrollView contentContainerStyle={styles.setsBody}>
      <Surface style={{ gap: space.xs }}>
        <Text style={styles.storeTitle}>Complete a set, win Tix</Text>
        <Text style={styles.storeBody}>Each sport has a {SEASON} set: one card of every team and athlete, any rarity. Finish one to claim its reward and add 100 to your score.</Text>
      </Surface>
      {rows.map(({ sport, p, done }) => {
        const pct = Math.round((p.owned / Math.max(1, p.total)) * 100);
        const ready = p.complete && !done;
        return (
          <Pressable key={sport.id} onPress={() => router.push({ pathname: '/set/[id]', params: { id: sport.id } })}
            accessibilityRole="button" accessibilityLabel={`${sport.name} set, ${p.owned} of ${p.total}${ready ? ', reward ready' : ''}`}
            style={({ pressed }) => [styles.setRow, ready && styles.storeReady, pressed && { opacity: 0.85 }]}>
            <Icon name={sportIcon(sport.id)} size={22} color={done ? colors.win : colors.textDim} />
            <View style={{ flex: 1, gap: 6 }}>
              <View style={styles.setHead}>
                <Text style={styles.setName}>{sport.name}</Text>
                <Text style={[styles.setMeta, ready && { color: colors.accent }, done && { color: colors.win }]}>
                  {done ? 'Complete ✓' : ready ? `Claim ${p.reward} Tix` : `${p.owned}/${p.total} · ${p.reward} Tix`}
                </Text>
              </View>
              <View style={styles.barTrack}><View style={[styles.barFill, { width: `${pct}%` }, (done || ready) && { backgroundColor: colors.win }]} /></View>
            </View>
            <Icon name="chevron-forward" size={18} color={colors.textDim} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tix: { ...type.label, color: colors.text, fontSize: 15 },
  tabs: { paddingHorizontal: space.lg, paddingBottom: space.sm },
  store: { marginHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md,
    borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  storeReady: { borderColor: colors.win },
  packs: { flexDirection: 'row', paddingLeft: 4 },
  storeTitle: { ...type.title, color: colors.text },
  storeBody: { ...type.label, color: colors.textDim, lineHeight: 17, fontWeight: '500' },
  freeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.win },
  tiles: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg },
  tools: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg },
  count: { ...type.label, color: colors.textDim, paddingHorizontal: space.lg, textTransform: 'uppercase' },
  chips: { gap: space.sm, paddingHorizontal: space.lg },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 50, borderBottomWidth: 1, borderColor: colors.line },
  optionText: { fontSize: 16, fontWeight: '600', color: colors.text },
  sheetBody: { ...type.body, color: colors.text },
  setsBody: { padding: space.lg, gap: space.sm, paddingBottom: 60 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  setHead: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  setName: { fontSize: 16, fontWeight: '800', color: colors.text },
  setMeta: { ...type.label, color: colors.textDim },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceHigh, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
});

