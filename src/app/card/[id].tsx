// One card up close: flip it to see the back, favorite it, pin it to your showcase,
// see every copy you own, or quick sell it for Tix.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { CardBack } from '@/components/cards/CardBack';
import { serialText, StandCard } from '@/components/cards/StandCard';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Surface } from '@/components/ui/Misc';
import { Header, Screen } from '@/components/ui/Screen';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState } from '@/components/ui/StateViews';
import { sportById } from '@/config/sports';
import { competitorById, getWorld } from '@/data/api';
import { SEASON, setMembers } from '@/data/demo/cards';
import { eventMetaById } from '@/data/demo/schedule';
import type { OwnedCard } from '@/data/types';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { currentTime, formatDay } from '@/lib/format';
import { tapLight, tapMedium } from '@/lib/haptics';
import { isProtected, quickSellValue, rarityLabel } from '@/logic/cards';
import { CARD_WIN_TIX, GAME_DAY_WIN_MULTIPLIER, PACK_TYPES, printRun, SHOWCASE_MAX } from '@/logic/rules';
import { toast } from '@/store/toast';
import { useUserStore } from '@/store/user';
import { colors, radius, space, type } from '@/theme/tokens';

function sourceText(card: OwnedCard): string {
  if (card.source === 'tradeup') return 'Trade up';
  if (card.source) return PACK_TYPES[card.source].name;
  return 'Pack';
}

export default function CardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width: screen } = useWindowDimensions();
  const reduce = useReduceMotion();
  const cards = useUserStore((s) => s.cards);
  const showcase = useUserStore((s) => s.showcase);
  const toggleFavorite = useUserStore((s) => s.toggleFavorite);
  const toggleShowcase = useUserStore((s) => s.toggleShowcase);
  const quickSell = useUserStore((s) => s.quickSell);
  const [flipped, setFlipped] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const flip = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    if (reduce) { flip.setValue(flipped ? 1 : 0); return; }
    Animated.spring(flip, { toValue: flipped ? 1 : 0, useNativeDriver: true, friction: 8 }).start();
  }, [flipped, flip, reduce]);

  const card = cards.find((c) => c.id === id);
  if (!card) {
    return (
      <Screen>
        <Header title="Card" back />
        <EmptyState icon="albums" title="This card is no longer in your collection" body="It may have been quick sold or traded up."
          actionLabel="Go to my cards" onAction={() => router.replace('/cards')} />
      </Screen>
    );
  }

  const c = competitorById(card.competitorId);
  const sport = c ? sportById(c.sportId) : undefined;
  const width = Math.min(250, Math.floor(screen * 0.62));
  const copies = cards.filter((x) => x.templateId === card.templateId).sort((a, b) => a.serial - b.serial);
  const favorite = !!card.favorite;
  const shown = showcase.includes(card.id);
  const locked = isProtected(card, showcase);
  const value = quickSellValue(card);
  const run = printRun(card.rarity, card.finish ?? 'base', !!card.eventId);
  const members = c ? setMembers(c.sportId) : [];
  const number = members.findIndex((m) => m.id === card.competitorId) + 1;
  const game = card.eventId ? eventMetaById(card.eventId) : undefined;
  const isTeamOfAthletes = !!c && c.kind === 'team' && getWorld().competitors.some((x) => x.parentId === c.id);
  const winTix = CARD_WIN_TIX[card.rarity];

  const front = flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '90deg', '90deg'] });
  const back = flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-90deg', '-90deg', '0deg'] });

  const onShowcase = () => {
    const err = toggleShowcase(card.id);
    if (err) { toast(err, 'error'); return; }
    tapLight();
    toast(shown ? 'Removed from your showcase' : 'Pinned to your showcase on Me', 'success');
  };
  const sell = () => {
    const r = quickSell([card.id], currentTime());
    setConfirm(false);
    if ('error' in r) { toast(r.error, 'error'); return; }
    tapMedium();
    toast(`Quick sold · +${r.tix} Tix`, 'success');
    if (router.canGoBack()) router.back(); else router.replace('/cards');
  };

  const facts: [string, string][] = [
    ['Rarity', `${rarityLabel(card.rarity)}${card.finish === 'holo' ? ' · Holo parallel' : ''}${card.eventId ? ' · Game Day' : ''}`],
    ['Serial', run ? `#${card.serial} of ${run}` : `#${card.serial} (open print run)`],
    ['Set', `${sport?.name ?? ''} ${SEASON} · card ${number > 0 ? number : '?'} of ${members.length}`],
    ['Pulled from', `${sourceText(card)} · ${formatDay(card.acquiredAt)}`],
    ...(card.eventId ? [['Game', `${game?.title ?? 'Unknown game'}${card.wonGame ? ' · WON' : ''}`] as [string, string]] : []),
    ['Win bonus', `+${winTix} Tix each time ${c?.shortName ?? 'they'}${isTeamOfAthletes ? ' or one of its athletes' : ''} wins${card.eventId ? ` (${winTix * GAME_DAY_WIN_MULTIPLIER} at its Game Day game)` : ''}`],
    ['Quick sell', `${value} Tix`],
  ];

  return (
    <Screen>
      <Header title={c?.name ?? 'Card'} subtitle={`${rarityLabel(card.rarity)}${card.finish === 'holo' ? ' Holo' : ''} · ${sport?.name ?? ''}`} back />
      <ScrollView contentContainerStyle={styles.body}>
        <Pressable onPress={() => { tapLight(); setFlipped((f) => !f); }} accessibilityRole="button"
          accessibilityLabel={flipped ? 'Show the front of the card' : 'Flip the card to see its back'}
          style={{ width, height: width * 1.4, alignSelf: 'center' }}>
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ perspective: 900 }, { rotateY: front }] }]} pointerEvents="none">
            <StandCard competitorId={card.competitorId} rarity={card.rarity} serial={card.serial} width={width}
              finish={card.finish} eventId={card.eventId} favorite={favorite} won={card.wonGame} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ perspective: 900 }, { rotateY: back }] }]} pointerEvents="none">
            <CardBack card={card} width={width} />
          </Animated.View>
        </Pressable>
        <Text style={styles.hint}>Tap the card to flip it</Text>

        <View style={styles.actions}>
          <Button label={favorite ? 'Favorite' : 'Add to favorites'} icon={favorite ? 'star' : 'star-outline'} small
            variant={favorite ? 'primary' : 'secondary'} style={{ flex: 1 }} onPress={() => { tapLight(); toggleFavorite(card.id); }} />
          <Button label={shown ? 'In showcase' : 'Showcase'} icon={shown ? 'ribbon' : 'ribbon-outline'} small
            variant={shown ? 'primary' : 'secondary'} style={{ flex: 1 }} onPress={onShowcase} />
        </View>
        <Text style={styles.note}>Favorites and showcased cards are protected from quick sell and trade-ups. Your showcase holds {SHOWCASE_MAX} cards and appears on Me.</Text>

        <Surface style={{ gap: 0, paddingVertical: space.sm }}>
          {facts.map(([k, v]) => (
            <View key={k} style={styles.fact}>
              <Text style={styles.factKey}>{k}</Text>
              <Text style={styles.factValue}>{v}</Text>
            </View>
          ))}
        </Surface>

        {copies.length > 1 ? (
          <View style={{ gap: space.sm }}>
            <Text style={styles.label}>Your copies · {copies.length}</Text>
            {copies.map((x) => (
              <Pressable key={x.id} onPress={() => router.setParams({ id: x.id })} accessibilityRole="button"
                accessibilityLabel={`Copy ${serialText(x.serial, x.rarity, x.finish, !!x.eventId)}`}
                style={[styles.copy, x.id === card.id && styles.copyOn]}>
                <Text style={styles.copySerial}>{serialText(x.serial, x.rarity, x.finish, !!x.eventId)}</Text>
                <Text style={styles.copyMeta} numberOfLines={1}>
                  {[x.finish === 'holo' ? 'Holo' : 'Base', x.eventId ? 'Game Day' : null, x.wonGame ? 'Won' : null].filter(Boolean).join(' · ')}
                </Text>
                {isProtected(x, showcase) ? <Icon name="lock-closed" size={14} color={colors.accent} /> : <Text style={styles.copyValue}>{quickSellValue(x)} Tix</Text>}
              </Pressable>
            ))}
          </View>
        ) : null}

        {c ? <Button label={`See ${c.name}`} icon="person-circle-outline" variant="secondary"
          onPress={() => router.push({ pathname: '/competitor/[id]', params: { id: c.id } })} /> : null}
        <Button label={locked ? 'Protected from quick sell' : `Quick sell · +${value} Tix`} icon={locked ? 'lock-closed' : 'pricetag'}
          variant="ghost" disabled={locked} onPress={() => setConfirm(true)} />
      </ScrollView>

      <Sheet visible={confirm} onClose={() => setConfirm(false)} title="Quick sell this card?">
        <Text style={styles.sheetBody}>
          You get {value} Tix right away and the {rarityLabel(card.rarity)}{card.finish === 'holo' ? ' Holo' : ''} {c?.name} card
          {' '}#{card.serial} leaves your collection for good.{copies.length > 1 ? ` You will still have ${copies.length - 1} other cop${copies.length === 2 ? 'y' : 'ies'}.` : ' It is your only copy.'}
        </Text>
        <Button label={`Quick sell · +${value} Tix`} icon="pricetag" variant="danger" onPress={sell} />
        <Button label="Keep it" variant="secondary" onPress={() => setConfirm(false)} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.md, paddingBottom: 60 },
  hint: { ...type.label, color: colors.textDim, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: space.sm },
  note: { ...type.label, color: colors.textDim, lineHeight: 17, fontWeight: '500' },
  fact: { flexDirection: 'row', gap: space.md, paddingVertical: space.sm, borderBottomWidth: 1, borderColor: colors.line },
  factKey: { ...type.label, color: colors.textDim, width: 92 },
  factValue: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  label: { ...type.label, color: colors.textDim, textTransform: 'uppercase' },
  copy: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  copyOn: { borderColor: colors.accent },
  copySerial: { fontSize: 15, fontWeight: '900', color: colors.text, fontVariant: ['tabular-nums'] },
  copyMeta: { ...type.label, color: colors.textDim, flex: 1 },
  copyValue: { ...type.label, color: colors.textDim },
  sheetBody: { ...type.body, color: colors.text },
});
