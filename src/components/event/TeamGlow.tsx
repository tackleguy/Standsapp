// Floodlit team colours behind a scoreboard: home glow on the left, away on the right.
import { memo, useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

function TeamGlowImpl({ left, right, strength = 0.34 }: { left: string; right?: string | null; strength?: number }) {
  const raw = useId();
  const id = raw.replace(/[^a-zA-Z0-9]/g, '');
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none"
      pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <RadialGradient id={`l${id}`} cx="0" cy="0.35" rx="0.75" ry="1.1" fx="0" fy="0.35">
          <Stop offset="0" stopColor={left} stopOpacity={strength} />
          <Stop offset="1" stopColor={left} stopOpacity={0} />
        </RadialGradient>
        {right ? (
          <RadialGradient id={`r${id}`} cx="1" cy="0.35" rx="0.75" ry="1.1" fx="1" fy="0.35">
            <Stop offset="0" stopColor={right} stopOpacity={strength} />
            <Stop offset="1" stopColor={right} stopOpacity={0} />
          </RadialGradient>
        ) : null}
        <LinearGradient id={`b${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000000" stopOpacity={0} />
          <Stop offset="1" stopColor="#000000" stopOpacity={0.28} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill={`url(#l${id})`} />
      {right ? <Rect x="0" y="0" width="100" height="100" fill={`url(#r${id})`} /> : null}
      <Rect x="0" y="0" width="100" height="100" fill={`url(#b${id})`} />
    </Svg>
  );
}

export const TeamGlow = memo(TeamGlowImpl);
