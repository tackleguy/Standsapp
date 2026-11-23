// Soft team-colour light behind a scoreboard: one colour from the left, one from the right.
import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { readableOnDark } from '@/lib/color';

function TeamGlowImpl({ left, right, strength = 0.55, id }: { left?: string | null; right?: string | null; strength?: number; id: string }) {
  const l = left ? readableOnDark(left, 0.08) : null;
  const r = right ? readableOnDark(right, 0.08) : null;
  return (
    <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100" pointerEvents="none"
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        {l ? (
          <RadialGradient id={`${id}-l`} cx="0" cy="45" r="75" fx="0" fy="45" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={l} stopOpacity={strength} />
            <Stop offset="1" stopColor={l} stopOpacity={0} />
          </RadialGradient>
        ) : null}
        {r ? (
          <RadialGradient id={`${id}-r`} cx="100" cy="45" r="75" fx="100" fy="45" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={r} stopOpacity={strength} />
            <Stop offset="1" stopColor={r} stopOpacity={0} />
          </RadialGradient>
        ) : null}
      </Defs>
      {l ? <Rect x="0" y="0" width="100" height="100" fill={`url(#${id}-l)`} /> : null}
      {r ? <Rect x="0" y="0" width="100" height="100" fill={`url(#${id}-r)`} /> : null}
    </Svg>
  );
}

export const TeamGlow = memo(TeamGlowImpl);
