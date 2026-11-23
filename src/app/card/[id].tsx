// One card up close: flip it to see the back, favorite it, pin it to your showcase,
// see every copy you own, or quick sell it for Tix.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Animated, PanResponder, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { CardBack } from '@/components/cards/CardBack';
import { AnyCard } from '@/components/cards/CardFaces';
import { serialText } from '@/components/cards/StandCard';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Surface } from '@/components/ui/Misc';
import { Header, Screen } from '@/components/ui/Screen';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState } from '@/components/ui/StateViews';
import { sportById } from '@/config/sports';
import { competitorById, getWorld } from '@/data/api';
import { cardFace, circulation, SET_NAME } from '@/data/demo/cardFacts';
import { cardGames, cardNextGame } from '@/data/demo/cardEarnings';
import { setMembers } from '@/data/demo/cards';
import { momentById } from '@/data/demo/moments';
import { playerById } from '@/data/playerApi';
import { eventMetaById } from '@/data/demo/schedule';
import type { OwnedCard } from '@/data/types';
import { useNow } from '@/hooks/useNow';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { clamp, currentTime, formatDay } from '@/lib/format';
import { tapLight, tapMedium } from '@/lib/haptics';
import { isChosen, isProtected, quickSellValue, rarityLabel } from '@/logic/cards';
import { formatPoints } from '@/logic/fantasy';
import { CARD_WIN_TIX, GAME_DAY_WIN_MULTIPLIER, PACK_TYPES, printRun, SHOWCASE_MAX } from '@/logic/rules';
import { toast } from '@/store/toast';
import { useUserStore } from '@/store/user';
import { colors, radius, space, type } from '@/theme/tokens';

function sourceText(card: OwnedCard): string {
  if (card.source === 'tradeup') return 'Trade up';
  if (card.source === 'pick') return 'Chosen';
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
  const mintCounts = useUserStore((s) => s.mintCounts);
  const now = useNow(60_000);
  const [flipped, setFlipped] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const flip = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    if (reduce) { flip.setValue(flipped ? 1 : 0); return; }
    Animated.spring(flip, { toValue: flipped ? 1 : 0, useNativeDriver: true, friction: 8 }).start();
  }, [flipped, flip, reduce]);

  // Drag the card to tilt it in your hand; it springs back when you let go. Taps still flip it.
  const width = Math.min(250, Math.floor(screen * 0.62));
  const tilt = useState(() => new Animated.ValueXY({ x: 0, y: 0 }))[0];
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
    onPanResponderMove: (_, g) => tilt.setValue({ x: clamp(g.dx / (width * 0.6), -1, 1), y: clamp(g.dy / (width * 0.8), -1, 1) }),
    onPanResponderRelease: () => Animated.spring(tilt, { toValue: { x: 0, y: 0 }, friction: 5, useNativeDriver: false }).start(),
    onPanResponderTerminate: () => Animated.spring(tilt, { toValue: { x: 0, y: 0 }, friction: 5, useNativeDriver: false }).start(),
  }), [tilt, width]);
  const rotateY = tilt.x.interpolate({ inputRange: [-1, 1], outputRange: ['-16deg', '16deg'] });
  const rotateX = tilt.y.interpolate({ inputRange: [-1, 1], outputRange: ['12deg', '-12deg'] });
  const glareX = tilt.x.interpolate({ inputRange: [-1, 1], outputRange: [width * 0.45, -width * 0.45] });
  const glareY = tilt.y.interpolate({ inputRange: [-1, 1], outputRange: [width * 0.5, -width * 0.5] });
  const glareOpacity = Animated.add(tilt.x.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.5, 0, 0.5] }),
    tilt.y.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.3, 0, 0.3] }));

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
  const copies = cards.filter((x) => x.templateId === card.templateId).sort((a, b) => a.serial - b.serial);
  const favorite = !!card.favorite;
  const shown = showcase.includes(card.id);
  const locked = isProtected(card, showcase);
  const value = quickSellValue(card);
  const run = printRun(card.rarity, card.finish ?? 'base', !!card.eventId);
  const members = c ? setMembers(c.sportId) : [];
  const number = members.findIndex((m) => m.id === card.competitorId) + 1;
  const face = cardFace(card.competitorId, now);
  const circ = circulation(card.templateId, card.finish ?? 'base', card.eventId ?? null, mintCounts);
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

  const chosen = isChosen(card);
  const moment = card.kind === 'play' || card.kind === 'performance' ? momentById(card.templateId) : null;
  const cardPlayer = playerById(card.playerId);
  const momentGame = moment ? eventMetaById(moment.eventId) : undefined;
  const canFlip = !card.kind;
  const title = chosen ? (cardPlayer?.name ?? c?.name ?? 'Card') : moment ? moment.headline : c?.name ?? 'Card';
  const subtitle = chosen ? `${card.kind === 'player' ? 'Player card' : 'Team card'} · ${sport?.name ?? sportById(cardPlayer?.sportId ?? '')?.name ?? ''}`
    : moment ? `${card.kind === 'play' ? 'Play' : 'Performance'} · ${rarityLabel(card.rarity)}${card.finish === 'holo' ? ' Holo' : ''} · ${cardPlayer?.short ?? ''}`
      : `${rarityLabel(card.rarity)}${card.finish === 'holo' ? ' Holo' : ''} · ${sport?.name ?? ''}`;
  const chosenFacts: [string, string][] = [
    ['Earns', card.kind === 'player'
      ? `${cardPlayer?.short ?? 'Their'} fantasy points, rounded, in Tix after every game`
      : 'The combined fantasy points of the team\u2019s 3 best players, rounded, in Tix after every game'],
    ['Earned so far', `${card.earned ?? 0} Tix`],
    ['Holder', `#${card.serial} · you got it ${formatDay(card.acquiredAt)}`],
    ['Counts from', 'Games that start after you got the card'],
  ];
  const momentFacts: [string, string][] = moment ? [
    ['Rarity', `${rarityLabel(card.rarity)}${card.finish === 'holo' ? ' · Holo parallel' : ''}${card.eventId ? ' · Game Day' : ''}`],
    [card.kind === 'play' ? 'Play' : 'Line', card.kind === 'play' ? moment.headline : moment.headline],
    [card.kind === 'play' ? 'Rating' : 'Fantasy pts', card.kind === 'play' ? `⚡ ${moment.value.toFixed(1)}` : formatPoints(moment.value)],
    ['Player', `${cardPlayer?.name ?? '?'}${cardPlayer ? ` · ${cardPlayer.posLabel}` : ''}`],
    ['Game', `${momentGame?.title ?? 'Unknown game'}${momentGame ? ` · ${formatDay(momentGame.startsAt)}` : ''}`],
    ['Serial', run ? `#${card.serial} of ${run}` : `#${card.serial} (open print run)`],
    ['Pulled from', `${sourceText(card)} · ${formatDay(card.acquiredAt)}`],
    ['Quick sell', `${value} Tix`],
  ] : [];
  const facts: [string, string][] = chosen ? chosenFacts : moment ? momentFacts : [
    ['Rarity', `${rarityLabel(card.rarity)}${card.finish === 'holo' ? ' · Holo parallel' : ''}${card.eventId ? ' · Game Day' : ''}`],
    ['Overall', face ? `${face.rating} ${face.role}${face.form ? ` · in form +${face.form.boost} (${face.form.reason.toLowerCase()})` : ''}` : '–'],
    ...(face?.rookie ? [['Rookie card', 'RC · first season'] as [string, string]] : []),
    ['Serial', run ? `#${card.serial} of ${run}` : `#${card.serial} (open print run)`],
    ['Circulation', run ? `${Math.min(circ.minted, run)} of ${run} pulled so far` : `${circ.minted.toLocaleString()} pulled so far`],
    ['Set', `${SET_NAME} · ${face?.checklist ?? ''} · ${sport?.name ?? ''} card ${number > 0 ? number : '?'} of ${members.length}`],
    ['Pulled from', `${sourceText(card)} · ${formatDay(card.acquiredAt)}`],
    ...(card.eventId ? [['Game', `${game?.title ?? 'Unknown game'}${card.wonGame ? ' · WON' : ''}`] as [string, string]] : []),
    ['Win bonus', `+${winTix} Tix each time ${c?.shortName ?? 'they'}${isTeamOfAthletes ? ' or one of its athletes' : ''} wins${card.eventId ? ` (${winTix * GAME_DAY_WIN_MULTIPLIER} at its Game Day game)` : ''}`],
    ['Quick sell', `${value} Tix`],
  ];

  return (
    <Screen>
      <Header title={title} subtitle={subtitle} back />
      <ScrollView contentContainerStyle={styles.body}>
        <Animated.View {...pan.panHandlers}
          style={{ width, height: width * 1.4, alignSelf: 'center', transform: [{ perspective: 1000 }, { rotateX }, { rotateY }] }}>
          <Pressable onPress={() => { if (!canFlip) return; tapLight(); setFlipped((f) => !f); }} accessibilityRole="button"
            accessibilityLabel={canFlip ? (flipped ? 'Show the front of the card' : 'Flip the card to see its back') : 'The card'}
            style={StyleSheet.absoluteFill}>
            <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ perspective: 900 }, { rotateY: front }] }]} pointerEvents="none">
              <AnyCard card={card} width={width} favorite={favorite} won={card.wonGame} animated />
            </Animated.View>
            {canFlip ? (
              <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ perspective: 900 }, { rotateY: back }] }]} pointerEvents="none">
                <CardBack card={card} width={width} />
              </Animated.View>
            ) : null}
            <Animated.View pointerEvents="none" style={[styles.glare, { opacity: glareOpacity, transform: [{ translateX: glareX }, { translateY: glareY }] }]}>
              <Svg width="100%" height="100%" viewBox="0 0 100 100">
                <Defs>
                  <RadialGradient id="card-glare" cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
                    <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.55} />
                    <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Rect x="0" y="0" width="100" height="100" fill="url(#card-glare)" />
              </Svg>
            </Animated.View>
          </Pressable>
        </Animated.View>
        <Text style={styles.hint}>{canFlip ? 'Tap to flip · drag to tilt it in the light' : 'Drag to tilt it in the light'}</Text>

        <View style={styles.actions}>
          <Button label={favorite ? 'Favorite' : 'Add to favorites'} icon={favorite ? 'star' : 'star-outline'} small
            variant={favorite ? 'primary' : 'secondary'} style={{ flex: 1 }} onPress={() => { tapLight(); toggleFavorite(card.id); }} />
          <Button label={shown ? 'In showcase' : 'Showcase'} icon={shown ? 'ribbon' : 'ribbon-outline'} small
            variant={shown ? 'primary' : 'secondary'} style={{ flex: 1 }} onPress={onShowcase} />
        </View>
        <Text style={styles.note}>{chosen ? `Your showcase holds ${SHOWCASE_MAX} cards and appears on Me.` : `Favorites and showcased cards are protected from quick sell and trade-ups. Your showcase holds ${SHOWCASE_MAX} cards and appears on Me.`}</Text>

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

        {chosen ? <ChosenGames card={card} /> : null}

        {moment && momentGame ? (
          <Button label="Open the game" icon="tv-outline" variant="secondary"
            onPress={() => router.push({ pathname: '/event/[id]', params: { id: momentGame.id } })} />
        ) : null}
        {cardPlayer ? (
          <Button label={`See ${cardPlayer.short}'s performance`} icon="stats-chart" variant="secondary"
            onPress={() => router.push({ pathname: '/player/[id]', params: { id: cardPlayer.id, ...(moment ? { event: moment.eventId } : {}) } })} />
        ) : null}
        {c && !cardPlayer?.athlete ? <Button label={`See ${c.name}`} icon="person-circle-outline" variant="secondary"
          onPress={() => router.push({ pathname: '/competitor/[id]', params: { id: c.id } })} /> : null}
        {chosen ? null : (
          <Button label={locked ? 'Protected from quick sell' : `Quick sell · +${value} Tix`} icon={locked ? 'lock-closed' : 'pricetag'}
            variant="ghost" disabled={locked} onPress={() => setConfirm(true)} />
        )}
      </ScrollView>

      <Sheet visible={confirm} onClose={() => setConfirm(false)} title="Quick sell this card?">
        <Text style={styles.sheetBody}>
          You get {value} Tix right away and the {rarityLabel(card.rarity)}{card.finish === 'holo' ? ' Holo' : ''} {moment ? `${moment.headline} (${cardPlayer?.short ?? ''})` : c?.name} card
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
  glare: { position: 'absolute', left: '-25%', top: '-25%', width: '150%', height: '150%', borderRadius: radius.md, overflow: 'hidden' },
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

/** A player or team card's games since you got it, with the points and Tix each earned. */
function ChosenGames({ card }: { card: OwnedCard }) {
  const now = useNow(15_000);
  const games = useMemo(() => cardGames(card, now, 10), [card, now]);
  const next = useMemo(() => cardNextGame(card, now), [card, now]);
  return (
    <View style={{ gap: space.sm }}>
      <Text style={styles.label}>Games since you got it</Text>
      {games.length === 0 ? <Text style={styles.note}>No games yet. It starts earning from its next game.</Text> : games.map((g) => (
        <View key={g.meta.id} style={styles.copy}>
          <View style={{ flex: 1 }}>
            <Text style={styles.copyMeta} numberOfLines={1}>{g.meta.title}</Text>
            <Text style={[styles.copyMeta, { fontSize: 11 }]}>{formatDay(g.meta.startsAt)}{g.live ? ' · LIVE' : ''}{!g.played ? ' · did not play' : ''}</Text>
          </View>
          <Text style={styles.copySerial}>{formatPoints(g.points)}</Text>
          <Text style={[styles.copyValue, { color: g.live ? colors.live : colors.accent }]}>{g.live ? `${g.tix} so far` : `+${g.tix} Tix`}</Text>
        </View>
      ))}
      {next ? <Text style={styles.note}>Next game: {next.title} · {formatDay(next.startsAt)}</Text> : null}
    </View>
  );
}
