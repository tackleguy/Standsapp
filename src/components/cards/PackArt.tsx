// A drawn foil pack for each pack type. Generated art only.
import { useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import type { PackTypeId } from '@/data/types';
import { PACK_TYPES } from '@/logic/rules';
import { colors, radius } from '@/theme/tokens';

export const PACK_TONE: Record<PackTypeId, string> = {
  daily: colors.win,
  standard: colors.accent,
  premium: colors.rarity.rare,
  elite: colors.rarity.epic,
  game: colors.live,
};

const SHORT: Record<PackTypeId, string> = { daily: 'DAILY', standard: 'STANDARD', premium: 'PREMIUM', elite: 'ELITE', game: 'GAME DAY' };

export function PackArt({ packId, width = 64 }: { packId: PackTypeId; width?: number }) {
  const tone = PACK_TONE[packId];
  const pack = PACK_TYPES[packId];
  const scale = width / 64;
  const gid = `pack-${packId}-${useId().replace(/[^\w-]/g, '')}`;
  return (
    <View style={[styles.pack, { width, height: width * 1.45, borderColor: tone }]}
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={tone} stopOpacity="0.95" />
            <Stop offset="0.5" stopColor={tone} stopOpacity="0.55" />
            <Stop offset="1" stopColor={colors.bg} stopOpacity="0.9" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gid})`} />
      </Svg>
      <View style={[styles.crimp, { height: 6 * scale }]} />
      <Text style={[styles.mark, { fontSize: 26 * scale }]}>S</Text>
      <Text style={[styles.name, { fontSize: 7 * scale }]} numberOfLines={1}>{SHORT[packId]}</Text>
      <Text style={[styles.count, { fontSize: 7 * scale }]}>{pack.size} CARD{pack.size === 1 ? '' : 'S'}</Text>
      <View style={[styles.crimp, styles.crimpBottom, { height: 6 * scale }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  pack: { borderRadius: radius.sm, borderWidth: 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceHigh },
  crimp: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(255,255,255,0.25)' },
  crimpBottom: { top: undefined, bottom: 0 },
  mark: { fontWeight: '900', color: colors.accentInk },
  name: { fontWeight: '900', color: colors.accentInk, letterSpacing: 0.8 },
  count: { fontWeight: '700', color: colors.accentInk, opacity: 0.8 },
});
