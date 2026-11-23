// A short shake-and-burst of the pack before the cards appear.
// With reduce-motion on, it finishes straight away.
import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import type { PackTypeId } from '@/data/types';
import { useReduceMotion } from '@/hooks/useReduceMotion';

import { PackArt } from './PackArt';

export function PackOpening({ packId, onDone }: { packId: PackTypeId; onDone: () => void }) {
  const reduce = useReduceMotion();
  const anim = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    if (reduce) { onDone(); return; }
    const run = Animated.timing(anim, { toValue: 1, duration: 850, useNativeDriver: true });
    run.start(({ finished }) => { if (finished) onDone(); });
    return () => run.stop();
  }, [anim, reduce, onDone]);
  const rotate = anim.interpolate({ inputRange: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 1], outputRange: ['0deg', '-6deg', '6deg', '-6deg', '6deg', '0deg', '0deg'] });
  const scale = anim.interpolate({ inputRange: [0, 0.5, 0.75, 1], outputRange: [1, 1.05, 1.25, 1.6] });
  const opacity = anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });
  return (
    <View style={styles.wrap} accessibilityLabel="Opening pack">
      <Animated.View style={{ opacity, transform: [{ rotate }, { scale }] }}>
        <PackArt packId={packId} width={150} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', minHeight: 300 },
});
