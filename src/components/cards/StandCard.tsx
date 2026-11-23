// A Stand Card: generated trading-card art in the team's colours (badge, stripes,
// rarity frame, foil band on Epic and Legendary). Never a real logo or photo.
// Holo parallels get a rainbow sheen; Game Day cards carry a red stamp with their game's date.
import { memo, useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Polygon, Rect, Stop } from 'react-native-svg';

import { sportById } from '@/config/sports';
import { competitorById } from '@/data/api';
import type { CardFinish, CardRarity } from '@/data/types';
import { readableOnDark } from '@/lib/color';
import { gameDayDate, rarityLabel } from '@/logic/cards';
import { printRun } from '@/logic/rules';
import { colors, fonts, radius, space } from '@/theme/tokens';

import { CompetitorBadge } from '../Badge';
import { Icon, sportIcon } from '../ui/Icon';

export interface StandCardProps {
  competitorId: string;
  rarity: CardRarity;
  serial: number;
  width?: number;
  season?: string;
  finish?: CardFinish;
  /** Set on Game Day cards. */
  eventId?: string | null;
  /** How many identical copies the fan owns (shows "x3"). */
  count?: number;
  favorite?: boolean;
  won?: boolean;
}

export function serialText(serial: number, rarity: CardRarity, finish: CardFinish = 'base', gameDay = false): string {
  const run = printRun(rarity, finish, gameDay);
  return `#${String(serial).padStart(run && run < 1000 ? 3 : 4, '0')}${run ? `/${run}` : ''}`;
}

/** A gradient name unique to this card on screen. On the web a shared name breaks
 * when another screen showing the same card is hidden behind this one. */
function useGradientId(prefix: string): string {
  return `${prefix}-${useId().replace(/[^\w-]/g, '')}`;
}

/** The rainbow sheen drawn over Holo cards. Static, so a full grid stays fast. */
function HoloSheen() {
  const id = useGradientId('holo');
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FF7AD9" stopOpacity="0.22" />
          <Stop offset="0.3" stopColor="#7AE7FF" stopOpacity="0.08" />
          <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity="0.3" />
          <Stop offset="0.55" stopColor="#B8FF7A" stopOpacity="0.1" />
          <Stop offset="0.8" stopColor="#FFD27A" stopOpacity="0.2" />
          <Stop offset="1" stopColor="#9A7AFF" stopOpacity="0.25" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

function StandCardImpl({ competitorId, rarity, serial, width = 150, season = '2026', finish = 'base', eventId = null, count, favorite, won }: StandCardProps) {
  const c = competitorById(competitorId);
  const frame = colors.rarity[rarity];
  const sport = c ? sportById(c.sportId) : undefined;
  const team = c?.parentId ? competitorById(c.parentId) : undefined;
  const primary = readableOnDark(c?.colors?.[0] ?? '#334155', 0.06);
  const secondary = c?.colors?.[1] ?? '#FFFFFF';
  const scale = width / 150;
  const foil = rarity === 'epic' || rarity === 'legendary';
  const gid = useGradientId('sc');
  const holo = finish === 'holo';
  const gameDay = !!eventId;
  const day = eventId ? gameDayDate(eventId) : null;
  const dayText = day ? new Date(day).toLocaleDateString([], { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '';
  const label = [
    `${rarityLabel(rarity)}${holo ? ' Holo' : ''}${gameDay ? ' Game Day' : ''} Stand Card: ${c?.name ?? 'Unknown'}`,
    `serial ${serial}`,
    count && count > 1 ? `${count} copies` : null,
    favorite ? 'favorite' : null,
    won ? 'won its game' : null,
  ].filter(Boolean).join(', ');
  return (
    <View style={[styles.card, { width, height: width * 1.4, borderColor: frame, borderWidth: rarity === 'legendary' || holo ? 3 : 2 }]}
      accessibilityLabel={label}>
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
      {holo ? <HoloSheen /> : null}
      <View style={styles.top}>
        <Icon name={sportIcon(c?.sportId ?? '')} size={12 * scale} color={colors.text} />
        <View style={[styles.rarityPill, { borderColor: frame }]}>
          <Text style={[styles.rarity, { color: frame, fontSize: 10 * scale, letterSpacing: width < 130 ? 0.3 : 1 }]} numberOfLines={1}>
            {holo ? 'HOLO ' : ''}{rarityLabel(rarity).toUpperCase()}
          </Text>
        </View>
      </View>
      {gameDay ? (
        <View style={[styles.ribbon, { paddingVertical: 1 * scale }]}>
          <Text style={[styles.ribbonText, { fontSize: 9 * scale }]} numberOfLines={1}>GAME DAY{dayText ? ` · ${dayText.toUpperCase()}` : ''}</Text>
        </View>
      ) : null}
      <View style={styles.art}>
        <CompetitorBadge id={competitorId} size={(gameDay ? 62 : 74) * scale} />
      </View>
      <View style={styles.bottom}>
        <Text style={[styles.name, { fontSize: 17 * scale, lineHeight: 18 * scale }]} numberOfLines={2}>{c?.name ?? 'Unknown'}</Text>
        <Text style={[styles.meta, { fontSize: 9 * scale }]} numberOfLines={1}>{team ? team.name : sport?.name} · {season}</Text>
        <Text style={[styles.serial, { color: frame, fontSize: 12 * scale }]}>{serialText(serial, rarity, finish, gameDay)}</Text>
      </View>
      {won ? (
        <View style={[styles.won, { top: width * 0.55 }]}>
          <Text style={[styles.wonText, { fontSize: 12 * scale }]}>WON</Text>
        </View>
      ) : null}
      {count && count > 1 ? (
        <View style={[styles.count, { top: width * 0.3 }]}><Text style={styles.countText}>×{count}</Text></View>
      ) : null}
      {favorite ? <View style={styles.fav}><Icon name="star" size={Math.max(12, 13 * scale)} color={colors.accent} /></View> : null}
    </View>
  );
}

export const StandCard = memo(StandCardImpl);

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, backgroundColor: '#0B101B', overflow: 'hidden', padding: space.sm, justifyContent: 'space-between' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  rarityPill: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 6, backgroundColor: 'rgba(10,14,23,0.6)', flexShrink: 1 },
  rarity: { fontFamily: fonts.heavy, letterSpacing: 1 },
  ribbon: { backgroundColor: colors.live, borderRadius: 4, alignItems: 'center', marginTop: 4 },
  ribbonText: { fontFamily: fonts.heavy, color: '#FFFFFF', letterSpacing: 0.6 },
  art: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  bottom: { gap: 1 },
  name: { fontFamily: fonts.black, color: colors.text, textTransform: 'uppercase' },
  meta: { color: colors.textDim, fontWeight: '600' },
  serial: { fontFamily: fonts.heavy, fontVariant: ['tabular-nums'] },
  won: { position: 'absolute', right: -4, transform: [{ rotate: '-14deg' }], borderWidth: 2, borderColor: colors.win,
    backgroundColor: 'rgba(10,14,23,0.75)', borderRadius: 6, paddingHorizontal: 6 },
  wonText: { fontFamily: fonts.black, color: colors.win, letterSpacing: 1 },
  count: { position: 'absolute', right: 4, backgroundColor: colors.bg, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1,
    borderWidth: 1, borderColor: colors.line },
  countText: { color: colors.text, fontSize: 11, fontWeight: '900', fontVariant: ['tabular-nums'] },
  fav: { position: 'absolute', bottom: 6, right: 6 },
});
