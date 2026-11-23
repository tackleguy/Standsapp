// "keira_g and 2 others are typing…" with three bouncing dots.
import { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';

import { useReduceMotion } from '@/hooks/useReduceMotion';
import { colors, space, type } from '@/theme/tokens';

export function typingLabel(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length <= 3) return `${names[0]} +${names.length - 1} typing…`;
  return `${names.length} people typing…`;
}

function Dot({ delay, reduce }: { delay: number; reduce: boolean }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(v, { toValue: 1, duration: 280, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(v, { toValue: 0, duration: 280, useNativeDriver: Platform.OS !== 'web' }),
      Animated.delay(420 - delay),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v, delay, reduce]);
  return (
    <Animated.View style={[styles.dot, {
      opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
      transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
    }]} />
  );
}

export function TypingDots({ names }: { names: string[] }) {
  const reduce = useReduceMotion();
  if (names.length === 0) return <View style={styles.wrap} />;
  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite" accessibilityLabel={typingLabel(names)}>
      <View style={[styles.dots, { marginRight: space.xs }]}>
        <Dot delay={0} reduce={reduce} />
        <Dot delay={140} reduce={reduce} />
        <Dot delay={280} reduce={reduce} />
      </View>
      {names.length <= 3 ? (
        <>
          <Text style={[styles.text, styles.name]} numberOfLines={1}>{names[0]}</Text>
          <Text style={styles.text}>{names.length === 1 ? 'is typing…' : `+${names.length - 1} typing…`}</Text>
        </>
      ) : <Text style={styles.text} numberOfLines={1}>{typingLabel(names)}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 20, overflow: 'hidden' },
  dots: { flexDirection: 'row', gap: 3, alignItems: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.textDim },
  text: { ...type.label, fontSize: 11, fontWeight: '500', color: colors.textDim, flexShrink: 0 },
  name: { flexShrink: 1, fontWeight: '700' },
});
