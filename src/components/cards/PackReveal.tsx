// Reveals the cards from a pack one at a time with a flip. Epic and Legendary
// pulls get a glow burst. With reduce-motion on, the cards simply appear.
import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import type { OwnedCard } from '@/data/types';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { tapMedium, tapSuccess } from '@/lib/haptics';
import { quickSellValue } from '@/logic/cards';
import { colors, radius, space, type } from '@/theme/tokens';

import { StandCard } from './StandCard';

const BIG = (c: OwnedCard) => c.rarity === 'epic' || c.rarity === 'legendary';

function FlipCard({ card, revealed, onPress, width }: { card: OwnedCard; revealed: boolean; onPress: () => void; width: number }) {
  const reduce = useReduceMotion();
  const flip = useState(() => new Animated.Value(revealed ? 1 : 0))[0];
  const burst = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    if (!revealed) return;
    if (reduce) { flip.setValue(1); return; }
    Animated.spring(flip, { toValue: 1, useNativeDriver: true, friction: 7 }).start();
    if (BIG(card)) {
      burst.setValue(0);
      Animated.timing(burst, { toValue: 1, duration: 900, useNativeDriver: true }).start();
    }
  }, [revealed, flip, burst, reduce, card]);
  const front = flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['90deg', '90deg', '0deg'] });
  const back = flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '90deg', '90deg'] });
  const glowScale = burst.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.35] });
  const glowOpacity = burst.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.7, 0] });
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={revealed ? 'Revealed card' : 'Tap to reveal card'}
      style={{ width, height: width * 1.4 }}>
      {BIG(card) ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glow,
          { backgroundColor: colors.rarity[card.rarity], opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />
      ) : null}
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ perspective: 800 }, { rotateY: back }] }]}>
        <View style={[styles.back, { width, height: width * 1.4 }]}>
          <Text style={styles.backMark}>S</Text>
          <Text style={styles.backText}>TAP</Text>
        </View>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ perspective: 800 }, { rotateY: front }] }]}>
        <StandCard competitorId={card.competitorId} rarity={card.rarity} serial={card.serial} width={width}
          finish={card.finish} eventId={card.eventId} animated={revealed && (BIG(card) || card.finish === 'holo')} />
      </Animated.View>
    </Pressable>
  );
}

export function PackReveal({ cards, isNew, sold, onAllRevealed }: {
  cards: OwnedCard[];
  /** Marks each card NEW (first copy) or DUPLICATE. */
  isNew?: boolean[];
  /** Cards already quick sold from this pack. */
  sold?: ReadonlySet<string>;
  onAllRevealed?: () => void;
}) {
  const reduce = useReduceMotion();
  const { width: screen } = useWindowDimensions();
  const [revealed, setRevealed] = useState<boolean[]>(cards.map(() => reduce));
  const perRow = Math.min(cards.length, 3);
  const width = Math.min(cards.length === 1 ? 170 : cards.length === 2 ? 140 : 118,
    Math.floor((Math.min(screen, 640) - space.lg * 2 - space.sm * (perRow - 1)) / perRow));
  const all = revealed.every(Boolean);
  useEffect(() => { if (all) onAllRevealed?.(); }, [all, onAllRevealed]);

  const reveal = (i: number) => {
    if (revealed[i]) return;
    if (BIG(cards[i])) tapSuccess(); else tapMedium();
    setRevealed((r) => r.map((v, k) => (k === i ? true : v)));
  };
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {cards.map((c, i) => (
          <View key={c.id} style={[styles.slot, sold?.has(c.id) && styles.soldSlot]}>
            <FlipCard card={c} revealed={revealed[i]} onPress={() => reveal(i)} width={width} />
            {revealed[i] && isNew ? (
              sold?.has(c.id) ? <Text style={[styles.tag, styles.soldTag]}>SOLD +{quickSellValue(c)}</Text>
                : <Text style={[styles.tag, isNew[i] ? styles.newTag : styles.dupeTag]}>{isNew[i] ? 'NEW' : 'DUPLICATE'}</Text>
            ) : null}
          </View>
        ))}
      </View>
      {!all ? (
        <Pressable onPress={() => { if (cards.some(BIG)) tapSuccess(); setRevealed(cards.map(() => true)); }} accessibilityRole="button" style={styles.revealAll}>
          <Text style={styles.revealAllText}>Reveal all</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center' },
  slot: { alignItems: 'center', gap: 6 },
  soldSlot: { opacity: 0.45 },
  glow: { borderRadius: radius.lg },
  back: { borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFD27A' },
  backMark: { fontSize: 44, fontWeight: '900', color: colors.accentInk },
  backText: { ...type.label, color: colors.accentInk },
  tag: { ...type.label, fontSize: 11, letterSpacing: 1, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  newTag: { color: colors.accentInk, backgroundColor: colors.win },
  dupeTag: { color: colors.textDim, backgroundColor: colors.surfaceHigh },
  soldTag: { color: colors.accent, backgroundColor: colors.surfaceHigh },
  revealAll: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.lg },
  revealAllText: { ...type.label, color: colors.accent, fontSize: 14 },
});
