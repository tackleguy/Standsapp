// Stand Cards: open packs with Tix, see the odds, browse your collection.
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { OddsTable } from '@/components/cards/OddsTable';
import { StandCard } from '@/components/cards/StandCard';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { sportIcon } from '@/components/ui/Icon';
import { Surface } from '@/components/ui/Misc';
import { Header, Screen } from '@/components/ui/Screen';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState } from '@/components/ui/StateViews';
import { SPORTS, sportById } from '@/config/sports';
import { competitorById } from '@/data/api';
import type { CardRarity } from '@/data/types';
import { PACK_COST, PACK_SIZE } from '@/logic/rules';
import { useUserStore } from '@/store/user';
import { colors, space, type } from '@/theme/tokens';

const RARITIES: (CardRarity | 'all')[] = ['all', 'legendary', 'epic', 'rare', 'common'];

export default function CardsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cards = useUserStore((s) => s.cards);
  const tix = useUserStore((s) => s.tix);
  const [sport, setSport] = useState('all');
  const [rarity, setRarity] = useState<CardRarity | 'all'>('all');
  const [odds, setOdds] = useState(false);
  const cols = width > 700 ? 5 : 3;
  const cardWidth = Math.floor((Math.min(width, 900) - space.lg * 2 - space.sm * (cols - 1)) / cols);

  const owned = useMemo(() => [...cards]
    .filter((c) => sport === 'all' || competitorById(c.competitorId)?.sportId === sport)
    .filter((c) => rarity === 'all' || c.rarity === rarity)
    .sort((a, b) => b.acquiredAt - a.acquiredAt), [cards, sport, rarity]);
  const sportsOwned = useMemo(() => SPORTS.filter((s) => cards.some((c) => competitorById(c.competitorId)?.sportId === s.id)), [cards]);

  return (
    <Screen>
      <Header title="Stand Cards" large right={<Text style={styles.tix}>🎟 {tix} Tix</Text>} />
      <FlatList
        data={owned}
        key={cols}
        numColumns={cols}
        keyExtractor={(c) => c.id}
        columnWrapperStyle={{ gap: space.sm, paddingHorizontal: space.lg }}
        contentContainerStyle={{ gap: space.sm, paddingBottom: 60 }}
        ListHeaderComponent={
          <View style={{ gap: space.md }}>
            <Surface style={styles.pack}>
              <Text style={styles.packTitle}>Open a pack</Text>
              <Text style={styles.packBody}>{PACK_SIZE} cards for {PACK_COST} Tix. Cards of competitors who win earn you Tix. Earn Tix from your daily Gate Check.</Text>
              <Button label={tix >= PACK_COST ? `Open a pack · ${PACK_COST} Tix` : `Need ${PACK_COST - tix} more Tix`} icon="gift"
                disabled={tix < PACK_COST} onPress={() => router.push('/pack')} />
              <Button label="See the odds" variant="ghost" small icon="stats-chart" onPress={() => setOdds(true)} />
            </Surface>
            <Text style={styles.count}>Your collection · {cards.length} card{cards.length === 1 ? '' : 's'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip label="All sports" icon="apps" selected={sport === 'all'} onPress={() => setSport('all')} />
              {sportsOwned.map((s) => <Chip key={s.id} label={s.name} icon={sportIcon(s.id)} selected={sport === s.id} onPress={() => setSport(s.id)} />)}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {RARITIES.map((r) => (
                <Chip key={r} label={r === 'all' ? 'Any rarity' : r[0].toUpperCase() + r.slice(1)} selected={rarity === r} onPress={() => setRarity(r)} />
              ))}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={<EmptyState icon="albums" title={cards.length ? 'No cards match' : 'No cards yet'}
          body={cards.length ? 'Try a different filter.' : `Open your first pack. Every fan starts with Tix to spend${sport !== 'all' ? ` (${sportById(sport)?.name})` : ''}.`} />}
        renderItem={({ item }) => <StandCard competitorId={item.competitorId} rarity={item.rarity} serial={item.serial} width={cardWidth} />}
      />
      <Sheet visible={odds} onClose={() => setOdds(false)} title="Pack odds"><OddsTable /></Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tix: { ...type.label, color: colors.text, fontSize: 15 },
  pack: { marginHorizontal: space.lg, gap: space.sm },
  packTitle: { ...type.title, color: colors.text },
  packBody: { ...type.body, color: colors.textDim },
  count: { ...type.label, color: colors.textDim, paddingHorizontal: space.lg, textTransform: 'uppercase' },
  chips: { gap: space.sm, paddingHorizontal: space.lg },
});
