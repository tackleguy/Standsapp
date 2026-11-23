// Tier badges (Bronze to Legend) and fan avatars wearing their tier as a ring.
import { StyleSheet, Text, View } from 'react-native';

import { tierName, type TierId } from '@/data/demo/ranking';
import { withAlpha } from '@/lib/color';
import { colors, fonts } from '@/theme/tokens';

import { Icon, type IconName } from '../ui/Icon';
import { Avatar } from '../ui/Misc';

const TIER_ICON: Record<TierId, IconName> = {
  bronze: 'medal', silver: 'medal', gold: 'medal', platinum: 'ribbon', diamond: 'diamond', legend: 'trophy',
};

export function tierColor(tier: TierId): string {
  return colors.tier[tier];
}

export function TierIcon({ tier, size = 14 }: { tier: TierId; size?: number }) {
  return <Icon name={TIER_ICON[tier]} size={size} color={tierColor(tier)} />;
}

/** "◆ DIAMOND" pill. */
export function TierBadge({ tier, size = 'md', label }: { tier: TierId; size?: 'sm' | 'md' | 'lg'; label?: string }) {
  const c = tierColor(tier);
  const dims = size === 'lg' ? { icon: 16, font: 16, padH: 12, padV: 5 } : size === 'sm' ? { icon: 11, font: 11, padH: 6, padV: 1 } : { icon: 13, font: 13, padH: 9, padV: 3 };
  return (
    <View style={[styles.badge, { backgroundColor: withAlpha(c, 0.14), borderColor: withAlpha(c, 0.45), paddingHorizontal: dims.padH, paddingVertical: dims.padV }]}
      accessibilityLabel={`${tierName(tier)} tier`}>
      <Icon name={TIER_ICON[tier]} size={dims.icon} color={c} />
      <Text style={[styles.text, { color: c, fontSize: dims.font }]}>{label ?? tierName(tier)}</Text>
    </View>
  );
}

/** An avatar inside a ring in the fan's tier colour (or a medal colour on the podium). */
export function FanAvatar({ seed, name, size = 40, tier, ring }: {
  seed: string; name: string; size?: number; tier?: TierId; ring?: string;
}) {
  const color = ring ?? (tier ? tierColor(tier) : colors.line);
  const width = size >= 64 ? 3 : 2;
  return (
    <View style={{ width: size + width * 2 + 2, height: size + width * 2 + 2, borderRadius: size, borderWidth: width, borderColor: color,
      alignItems: 'center', justifyContent: 'center' }}>
      <Avatar seed={seed} name={name} size={size} />
      {tier && size >= 34 ? (
        <View style={[styles.corner, { backgroundColor: colors.bg, borderColor: color, width: size * 0.42, height: size * 0.42, borderRadius: size }]}>
          <Icon name={TIER_ICON[tier]} size={size * 0.24} color={color} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, borderWidth: 1, alignSelf: 'flex-start' },
  text: { fontFamily: fonts.bold, letterSpacing: 0.8, textTransform: 'uppercase' },
  corner: { position: 'absolute', right: -4, bottom: -4, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
