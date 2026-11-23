// Floodlit team colours behind a scoreboard: one colour glowing from the left, one
// from the right, with a soft shade at the bottom. Very dark kits are lifted so
// they still read on the night-sky background.
import { memo, useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { readableOnDark } from '@/lib/color';

function TeamGlowImpl({ left, right, strength = 0.34 }: { left?: string | null; right?: string | null; strength?: number }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const l = left ? readableOnDark(left, 0.08) : null;
  const r = right ? readableOnDark(right, 0.08) : null;
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none"
      pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        {l ? (
          <RadialGradient id={`l${id}`} cx="0" cy="0.35" rx="0.75" ry="1.1" fx="0" fy="0.35">
            <Stop offset="0" stopColor={l} stopOpacity={strength} />
            <Stop offset="1" stopColor={l} stopOpacity={0} />
          </RadialGradient>
        ) : null}
        {r ? (
          <RadialGradient id={`r${id}`} cx="1" cy="0.35" rx="0.75" ry="1.1" fx="1" fy="0.35">
            <Stop offset="0" stopColor={r} stopOpacity={strength} />
            <Stop offset="1" stopColor={r} stopOpacity={0} />
          </RadialGradient>
        ) : null}
        <LinearGradient id={`b${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000000" stopOpacity={0} />
          <Stop offset="1" stopColor="#000000" stopOpacity={0.28} />
        </LinearGradient>
      </Defs>
      {l ? <Rect x="0" y="0" width="100" height="100" fill={`url(#l${id})`} /> : null}
      {r ? <Rect x="0" y="0" width="100" height="100" fill={`url(#r${id})`} /> : null}
      <Rect x="0" y="0" width="100" height="100" fill={`url(#b${id})`} />
    </Svg>
  );
}

export const TeamGlow = memo(TeamGlowImpl);
