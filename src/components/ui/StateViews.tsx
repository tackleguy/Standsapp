// The four states every list needs: loading, content, empty, and error.
import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { useReduceMotion } from '@/hooks/useReduceMotion';
import { colors, radius, space, type } from '@/theme/tokens';

import { Button } from './Button';
import { Icon, type IconName } from './Icon';

export function Skeleton({ rows = 4, height = 96 }: { rows?: number; height?: number }) {
  const reduce = useReduceMotion();
  const shimmer = useState(() => new Animated.Value(0.5))[0];
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(shimmer, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(shimmer, { toValue: 0.5, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [shimmer, reduce]);
  return (
    <View accessibilityLabel="Loading" accessibilityRole="progressbar" style={styles.skeletonWrap}>
      {Array.from({ length: rows }, (_, i) => (
        <Animated.View key={i} style={[styles.skeleton, { height, opacity: shimmer }]} />
      ))}
    </View>
  );
}

export function EmptyState({ icon = 'moon', title, body, actionLabel, onAction }: {
  icon?: IconName; title: string; body?: string; actionLabel?: string; onAction?: () => void;
}) {
  return (
    <View style={styles.center}>
      <View style={styles.iconWrap}><Icon name={icon} size={28} color={colors.accent} /></View>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} small style={styles.action} /> : null}
    </View>
  );
}

export function ErrorState({ onRetry, message }: { onRetry: () => void; message?: string }) {
  return (
    <View style={styles.center}>
      <View style={styles.iconWrap}><Icon name="cloud-offline" size={28} color={colors.live} /></View>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.body}>{message ?? 'We could not load this right now. Check your connection and try again.'}</Text>
      <Button label="Try again" icon="refresh" onPress={onRetry} small style={styles.action} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonWrap: { paddingHorizontal: space.lg, gap: space.md, paddingTop: space.md },
  skeleton: { borderRadius: radius.md, backgroundColor: colors.surface },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl, paddingVertical: space.xxl * 1.5, gap: space.sm },
  iconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  title: { ...type.title, color: colors.text, textAlign: 'center' },
  body: { ...type.body, color: colors.textDim, textAlign: 'center', maxWidth: 320 },
  action: { marginTop: space.md },
});
