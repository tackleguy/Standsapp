// A Stand Card: generated trading-card art in the team's colours (badge, stripes,
// rarity frame, foil sheen on the rare ones). Never a real logo or photo.
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Polygon, Rect, Stop } from 'react-native-svg';

import { sportById } from '@/config/sports';
import { competitorById } from '@/data/api';
import type { CardRarity } from '@/data/types';
import { readableOnDark } from '@/lib/color';
import { colors, fonts, radius, space } from '@/theme/tokens';

import { CompetitorBadge } from '../Badge';
import { Icon, sportIcon } from '../ui/Icon';

const RARITY_LABEL: Record<CardRarity, string> = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };

function StandCardImpl({ competitorId, rarity, serial, width = 150, season = '2026' }: {
  competitorId: string; rarity: CardRarity; serial: number; width?: number; season?: string;
}) {
  const c = competitorById(competitorId);
  const frame = colors.rarity[rarity];
  const sport = c ? sportById(c.sportId) : undefined;
  const team = c?.parentId ? competitorById(c.parentId) : undefined;
  const primary = readableOnDark(c?.colors?.[0] ?? '#334155', 0.06);
  const secondary = c?.colors?.[1] ?? '#FFFFFF';
  const scale = width / 150;
  const foil = rarity === 'epic' || rarity === 'legendary';
  const gid = `sc-${competitorId}-${rarity}-${serial}`;
  return (
    <View style={[styles.card, { width, height: width * 1.4, borderColor: frame, borderWidth: rarity === 'legendary' ? 3 : 2 }]}
      accessibilityLabel={`${RARITY_LABEL[rarity]} Stand Card: ${c?.name ?? 'Unknown'}, serial ${serial}`}>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 140" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={`${gid}-bg`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={primary} stopOpacity={0.95} />
            <Stop offset="0.62" stopColor={primary} stopOpacity={0.25} />
            <Stop offset="1" stopColor="#0B101B" stopOpacity={1} />
          </LinearGradient>
          <LinearGradient id={`${gid}-foil`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="0.5" stopColor={rarity === 'legendary' ? '#FFE9A8' : '#E6D4FF'} stopOpacity={0.35} />
            <Stop offset="0.56" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="140" fill="#0B101B" />
        <Rect x="0" y="0" width="100" height="140" fill={`url(#${gid}-bg)`} />
        <Polygon points="-10,62 110,22 110,30 -10,70" fill={secondary} opacity={0.18} />
        <Polygon points="-10,74 110,34 110,37 -10,77" fill={secondary} opacity={0.12} />
        {foil ? <Rect x="0" y="0" width="100" height="140" fill={`url(#${gid}-foil)`} /> : null}
      </Svg>
      <View style={styles.top}>
        <Icon name={sportIcon(c?.sportId ?? '')} size={12 * scale} color={colors.text} />
        <View style={[styles.rarityPill, { borderColor: frame }]}>
          <Text style={[styles.rarity, { color: frame, fontSize: 10 * scale }]}>{RARITY_LABEL[rarity].toUpperCase()}</Text>
        </View>
      </View>
      <View style={styles.art}>
        <CompetitorBadge id={competitorId} size={74 * scale} />
      </View>
      <View style={styles.bottom}>
        <Text style={[styles.name, { fontSize: 17 * scale, lineHeight: 18 * scale }]} numberOfLines={2}>{c?.name ?? 'Unknown'}</Text>
        <Text style={[styles.meta, { fontSize: 9 * scale }]} numberOfLines={1}>{team ? team.name : sport?.name} · {season}</Text>
        <Text style={[styles.serial, { color: frame, fontSize: 12 * scale }]}>#{String(serial).padStart(4, '0')}</Text>
      </View>
    </View>
  );
}

export const StandCard = memo(StandCardImpl);

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, backgroundColor: '#0B101B', overflow: 'hidden', padding: space.sm, justifyContent: 'space-between' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rarityPill: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 6, backgroundColor: 'rgba(10,14,23,0.6)' },
  rarity: { fontFamily: fonts.heavy, letterSpacing: 1 },
  art: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  bottom: { gap: 1 },
  name: { fontFamily: fonts.black, color: colors.text, textTransform: 'uppercase' },
  meta: { color: colors.textDim, fontWeight: '600' },
  serial: { fontFamily: fonts.heavy, fontVariant: ['tabular-nums'] },
});
