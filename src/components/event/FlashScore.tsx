// A score that briefly glows amber when it changes, so live updates catch the eye.
import { useEffect, useRef, useState } from 'react';
import { Animated, type StyleProp, type TextStyle } from 'react-native';

import { useReduceMotion } from '@/hooks/useReduceMotion';
import { colors } from '@/theme/tokens';

export function FlashScore({ value, style }: { value: string; style?: StyleProp<TextStyle> }) {
  const reduce = useReduceMotion();
  const prev = useRef(value);
  const glow = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      if (reduce) return;
      glow.setValue(1);
      Animated.timing(glow, { toValue: 0, duration: 1800, useNativeDriver: false }).start();
    }
  }, [value, glow, reduce]);
  const color = glow.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,182,39,0)', 'rgba(255,182,39,0.35)'] });
  return (
    <Animated.Text style={[style, { backgroundColor: color, borderRadius: 6, paddingHorizontal: 4 }]}
      accessibilityLiveRegion="polite" numberOfLines={1}>
      {value}
    </Animated.Text>
  );
}

export const FLASH_COLOR = colors.accent;
