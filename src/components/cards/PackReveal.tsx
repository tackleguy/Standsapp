// Reveals the three cards from a pack one at a time with a flip.
// With reduce-motion on, the cards simply appear.
import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { useReduceMotion } from '@/hooks/useReduceMotion';
import { tapMedium, tapSuccess } from '@/lib/haptics';
import type { OwnedCard } from '@/store/user';
import { colors, radius, space, type } from '@/theme/tokens';

import { StandCard } from './StandCard';

function FlipCard({ card, revealed, onPress, width }: { card: OwnedCard; revealed: boolean; onPress: () => void; width: number }) {
  const reduce = useReduceMotion();
  const flip = useState(() => new Animated.Value(revealed ? 1 : 0))[0];
  useEffect(() => {
    if (!revealed) return;
    if (reduce) { flip.setValue(1); return; }
    Animated.spring(flip, { toValue: 1, useNativeDriver: true, friction: 7 }).start();
  }, [revealed, flip, reduce]);
  const front = flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['90deg', '90deg', '0deg'] });
  const back = flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '90deg', '90deg'] });
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={revealed ? 'Revealed card' : 'Tap to reveal card'}
      style={{ width, height: width * 1.4 }}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ perspective: 800 }, { rotateY: back }] }]}>
        <View style={[styles.back, { width, height: width * 1.4 }]}>
          <Text style={styles.backMark}>S</Text>
          <Text style={styles.backText}>TAP</Text>
        </View>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ perspective: 800 }, { rotateY: front }] }]}>
        <StandCard competitorId={card.competitorId} rarity={card.rarity} serial={card.serial} width={width} />
      </Animated.View>
    </Pressable>
  );
}

export function PackReveal({ cards, width = 104 }: { cards: OwnedCard[]; width?: number }) {
  const reduce = useReduceMotion();
  const [revealed, setRevealed] = useState<boolean[]>(cards.map(() => reduce));
  const reveal = (i: number) => {
    if (revealed[i]) return;
    const card = cards[i];
    if (card.rarity === 'epic' || card.rarity === 'legendary') tapSuccess(); else tapMedium();
    setRevealed((r) => r.map((v, k) => (k === i ? true : v)));
  };
  const all = revealed.every(Boolean);
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {cards.map((c, i) => <FlipCard key={c.id} card={c} revealed={revealed[i]} onPress={() => reveal(i)} width={width} />)}
      </View>
      {!all ? (
        <Pressable onPress={() => setRevealed(cards.map(() => true))} accessibilityRole="button" style={styles.revealAll}>
          <Text style={styles.revealAllText}>Reveal all</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.md },
  row: { flexDirection: 'row', gap: space.sm, justifyContent: 'center' },
  back: { borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFD27A' },
  backMark: { fontSize: 44, fontWeight: '900', color: colors.accentInk },
  backText: { ...type.label, color: colors.accentInk },
  revealAll: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.lg },
  revealAllText: { ...type.label, color: colors.accent, fontSize: 14 },
});
