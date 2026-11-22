import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { useReduceMotion } from '@/hooks/useReduceMotion';
import { colors, radius, space, type } from '@/theme/tokens';

/** A pulsing red dot that says "this is happening right now". */
export function LiveDot({ size = 8 }: { size?: number }) {
  const reduce = useReduceMotion();
  const pulse = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse, reduce]);
  return (
    <View style={{ width: size, height: size }}>
      {!reduce && (
        <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: size, backgroundColor: colors.live,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }] }]} />
      )}
      <View style={{ width: size, height: size, borderRadius: size, backgroundColor: colors.live }} />
    </View>
  );
}

/** Status pill: LIVE with a clock, Final, a start time, Postponed... */
export function StatusPill({ label, live = false, tone = 'default' }: { label: string; live?: boolean; tone?: 'default' | 'final' | 'warn' }) {
  return (
    <View style={[styles.pill, live && styles.pillLive, tone === 'warn' && styles.pillWarn]}>
      {live ? <LiveDot size={6} /> : null}
      <Text style={[styles.text, live && styles.textLive, tone === 'final' && styles.textFinal]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.sm, paddingVertical: 3,
    borderRadius: radius.pill, backgroundColor: colors.surfaceHigh, maxWidth: 190 },
  pillLive: { backgroundColor: 'rgba(255,77,94,0.16)', borderWidth: 1, borderColor: 'rgba(255,77,94,0.5)' },
  pillWarn: { backgroundColor: 'rgba(255,182,39,0.15)' },
  text: { ...type.label, color: colors.textDim },
  textLive: { color: '#FF8A95' },
  textFinal: { color: colors.text },
});
