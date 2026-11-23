// Trade up: five cards of one rarity become one random card of the next rarity.
// If all five are from one sport, the new card is from that sport too.
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { PackReveal } from '@/components/cards/PackReveal';
import { AnyCard } from '@/components/cards/CardFaces';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Segmented } from '@/components/ui/Misc';
import { Header, Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/StateViews';
import { competitorById } from '@/data/api';
import type { CardRarity } from '@/data/types';
import { currentTime } from '@/lib/format';
import { tapError, tapLight, tapSuccess } from '@/lib/haptics';
import { duplicatesToSell, isProtected, nextRarity, rarityLabel } from '@/logic/cards';
import { TRADE_UP_COUNT } from '@/logic/rules';
import { toast } from '@/store/toast';
import { useUserStore, type PackResult } from '@/store/user';
import { colors, radius, space, type } from '@/theme/tokens';

const TIERS: CardRarity[] = ['common', 'rare', 'epic'];

export default function TradeUpScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cards = useUserStore((s) => s.cards);
  const showcase = useUserStore((s) => s.showcase);
  const tradeUp = useUserStore((s) => s.tradeUp);
  const [tier, setTier] = useState<CardRarity>('common');
  const [picked, setPicked] = useState<string[]>([]);
  const [result, setResult] = useState<PackResult | null>(null);
  const cols = width > 700 ? 5 : 3;
  const cardWidth = Math.floor((Math.min(width, 900) - space.lg * 2 - space.sm * (cols - 1)) / cols);
  const target = nextRarity(tier) ?? 'legendary';

  // Duplicates first, so fans trade away spares before their only copies.
  const eligible = useMemo(() => {
    const spare = new Set(duplicatesToSell(cards, showcase).map((c) => c.id));
    return cards.filter((c) => c.rarity === tier && !isProtected(c, showcase))
      .sort((a, b) => Number(spare.has(b.id)) - Number(spare.has(a.id)) || b.acquiredAt - a.acquiredAt)
      .map((c) => ({ card: c, spare: spare.has(c.id) }));
  }, [cards, showcase, tier]);

  const toggle = (id: string) => {
    tapLight();
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= TRADE_UP_COUNT ? p : [...p, id]));
  };
  const autoPick = () => {
    const spares = eligible.filter((e) => e.spare).slice(0, TRADE_UP_COUNT).map((e) => e.card.id);
    if (spares.length === 0) { toast(`You have no spare ${rarityLabel(tier)} duplicates. Tap cards to pick them yourself.`, 'info'); return; }
    setPicked(spares);
    if (spares.length < TRADE_UP_COUNT) toast(`Found ${spares.length} spare${spares.length === 1 ? '' : 's'}. Tap ${TRADE_UP_COUNT - spares.length} more to finish.`, 'info');
  };
  const go = () => {
    const r = tradeUp(picked, currentTime());
    if ('error' in r) { tapError(); toast(r.error, 'error'); return; }
    tapSuccess();
    setPicked([]);
    setResult(r);
  };
  const pickedSports = new Set(picked.map((id) => competitorById(cards.find((c) => c.id === id)?.competitorId)?.sportId));

  if (result) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Header title="Trade up" back />
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.lead}>Your new {rarityLabel(result.cards[0].rarity)} card. Tap to reveal it.</Text>
          <PackReveal key={result.cards[0].id} cards={result.cards} isNew={result.isNew} />
          <Button label="See this card" icon="eye" variant="secondary" onPress={() => router.push({ pathname: '/card/[id]', params: { id: result.cards[0].id } })} />
          <Button label="Trade up again" icon="arrow-up-circle" onPress={() => setResult(null)} />
          <Button label="Done" variant="ghost" onPress={() => router.back()} />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Trade up" subtitle={`${TRADE_UP_COUNT} cards in, 1 better card out`} back />
      <ScrollView contentContainerStyle={styles.body}>
        <Segmented value={tier} onChange={(t) => { setTier(t); setPicked([]); }}
          options={TIERS.map((t) => ({ value: t, label: `${TRADE_UP_COUNT} ${rarityLabel(t)}` }))} />
        <Text style={styles.lead}>
          Pick {TRADE_UP_COUNT} {rarityLabel(tier)} cards to get 1 random {rarityLabel(target)} card. If all {TRADE_UP_COUNT} are from
          one sport, the new card is from that sport too. Favorites and showcased cards are protected and not shown.
        </Text>
        <View style={styles.tools}>
          <Button label="Auto-pick duplicates" icon="flash" variant="secondary" small style={{ flex: 1 }} onPress={autoPick} />
          <Button label="Clear" variant="ghost" small onPress={() => setPicked([])} disabled={picked.length === 0} />
        </View>
        {eligible.length < TRADE_UP_COUNT ? (
          <EmptyState icon="layers" title={`You need ${TRADE_UP_COUNT} ${rarityLabel(tier)} cards`}
            body={`You have ${eligible.length} you can trade. Open packs to collect more.`} actionLabel="Open the Pack Store" onAction={() => router.push('/pack')} />
        ) : (
          <View style={styles.grid}>
            {eligible.map(({ card, spare }) => {
              const on = picked.includes(card.id);
              return (
                <Pressable key={card.id} onPress={() => toggle(card.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                  accessibilityLabel={`${competitorById(card.competitorId)?.name ?? 'Card'}${spare ? ', duplicate' : ''}`}
                  style={[styles.pick, on && styles.pickOn]}>
                  <AnyCard card={card} width={cardWidth - 6} />
                  {spare ? <Text style={styles.spare}>SPARE</Text> : null}
                  {on ? <View style={styles.check}><Icon name="checkmark" size={18} color={colors.accentInk} /></View> : null}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Text style={styles.footNote}>
          {picked.length === TRADE_UP_COUNT ? (pickedSports.size === 1 ? 'All one sport: your new card will be from that sport.' : 'Mixed sports: your new card can be from any sport.') : `Picked ${picked.length} of ${TRADE_UP_COUNT}`}
        </Text>
        <Button label={`Trade up · ${picked.length}/${TRADE_UP_COUNT}`} icon="arrow-up-circle" disabled={picked.length !== TRADE_UP_COUNT} onPress={go} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.md, paddingBottom: 40 },
  lead: { ...type.body, color: colors.textDim },
  tools: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pick: { borderRadius: radius.md + 3, borderWidth: 3, borderColor: 'transparent' },
  pickOn: { borderColor: colors.accent },
  spare: { position: 'absolute', bottom: 8, right: 8, ...type.label, fontSize: 9, color: colors.accentInk, backgroundColor: colors.win,
    paddingHorizontal: 4, borderRadius: 4, overflow: 'hidden' },
  check: { position: 'absolute', top: 6, left: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center' },
  footer: { padding: space.lg, gap: space.sm, borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  footNote: { ...type.label, color: colors.textDim, textAlign: 'center' },
});
