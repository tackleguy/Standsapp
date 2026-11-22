// A Stand Card: generated art only (badge, initials, colors, and a rarity frame).
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { sportById } from '@/config/sports';
import { competitorById } from '@/data/api';
import type { CardRarity } from '@/data/types';
import { colors, radius, space, type } from '@/theme/tokens';

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
  const scale = width / 150;
  return (
    <View style={[styles.card, { width, height: width * 1.4, borderColor: frame, borderWidth: rarity === 'legendary' ? 3 : 2 }]}
      accessibilityLabel={`${RARITY_LABEL[rarity]} Stand Card: ${c?.name ?? 'Unknown'}, serial ${serial}`}>
      <View style={[styles.glow, { backgroundColor: frame }]} />
      <View style={styles.top}>
        <Icon name={sportIcon(c?.sportId ?? '')} size={12 * scale} color={colors.textDim} />
        <Text style={[styles.rarity, { color: frame, fontSize: 9 * scale }]}>{RARITY_LABEL[rarity].toUpperCase()}</Text>
      </View>
      <View style={styles.art}>
        <CompetitorBadge id={competitorId} size={70 * scale} />
      </View>
      <View style={styles.bottom}>
        <Text style={[styles.name, { fontSize: 13 * scale }]} numberOfLines={2}>{c?.name ?? 'Unknown'}</Text>
        <Text style={[styles.meta, { fontSize: 9 * scale }]} numberOfLines={1}>{team ? team.name : sport?.name} · {season}</Text>
        <Text style={[styles.serial, { color: frame, fontSize: 10 * scale }]}>#{String(serial).padStart(4, '0')}</Text>
      </View>
    </View>
  );
}

export const StandCard = memo(StandCardImpl);

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, backgroundColor: colors.surfaceHigh, overflow: 'hidden', padding: space.sm, justifyContent: 'space-between' },
  glow: { position: 'absolute', top: -40, left: -20, right: -20, height: 110, opacity: 0.18, borderRadius: 80 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rarity: { ...type.label, letterSpacing: 1 },
  art: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  bottom: { gap: 2 },
  name: { fontWeight: '800', color: colors.text },
  meta: { color: colors.textDim, fontWeight: '600' },
  serial: { fontWeight: '900', fontVariant: ['tabular-nums'] },
});
