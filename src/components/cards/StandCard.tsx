// A Stand Card, laid out like a real trading card (generated art only, never a
// photo or logo):
// - top left: overall rating and role, like an EA FC card; an IN FORM boost when on a run
// - top right: the set logo, the rarity, and an RC mark for rookies, like Topps
// - centre: the badge on team-colour stock with stripes; Holo cards get a foil sheen
// - name plate, then six sport-specific attributes on bigger cards
// - bottom: the checklist number and a foil serial box ("07/25") for numbered cards
// Game Day cards carry a red ribbon with their game's date and a WON stamp.
import { memo, useEffect, useId, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Polygon, Rect, Stop } from 'react-native-svg';

import { competitorById } from '@/data/api';
import { cardFace, SET_LOGO } from '@/data/demo/cardFacts';
import type { CardFinish, CardRarity } from '@/data/types';
import { useNow } from '@/hooks/useNow';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { mix, readableOnDark } from '@/lib/color';
import { gameDayDate, rarityLabel } from '@/logic/cards';
import { printRun } from '@/logic/rules';
import { colors, fonts, radius } from '@/theme/tokens';

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
  /** Sweep a moving foil sheen across Holo, Epic and Legendary cards (for close-ups). */
  animated?: boolean;
}

export function serialText(serial: number, rarity: CardRarity, finish: CardFinish = 'base', gameDay = false): string {
  const run = printRun(rarity, finish, gameDay);
  return `#${String(serial).padStart(run && run < 1000 ? 3 : 4, '0')}${run ? `/${run}` : ''}`;
}

/** The serial as printed in a foil box: "07/25", or "#0803" for open print runs. */
export function foilSerial(serial: number, run: number | null): string {
  if (!run) return `#${String(serial).padStart(4, '0')}`;
  return `${String(serial).padStart(String(run).length, '0')}/${run}`;
}

export const FOIL: Record<CardRarity, [string, string]> = {
  common: ['#D7DEE8', '#8E99AB'],
  rare: ['#BFE0FF', '#4DA3FF'],
  epic: ['#E6D4FF', '#9A6BFF'],
  legendary: ['#FFF1B8', '#E0A21A'],
};

/** A diagonal band of light across foil cards; it sweeps when `animated`. */
export function Sheen({ width, height, holo, animated, tint }: { width: number; height: number; holo: boolean; animated: boolean; tint: string }) {
  // Each card needs its own gradient name: on the web a shared name breaks when another screen is hidden.
  const id = `sheen-${useId().replace(/[^\w-]/g, '')}`;
  const reduce = useReduceMotion();
  const sweep = useState(() => new Animated.Value(0))[0];
  const moving = animated && !reduce;
  useEffect(() => {
    if (!moving) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(sweep, { toValue: 1, duration: 2200, useNativeDriver: true }),
      Animated.delay(1400),
      Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [moving, sweep]);
  const translateX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-width * 1.2, width * 1.2] });
  const stops: readonly (readonly [string, number])[] = holo
    ? [['#FF7AD9', 0.22], ['#7AE7FF', 0.2], ['#FFFFFF', 0.42], ['#B8FF7A', 0.2], ['#FFD27A', 0.22]]
    : [[tint, 0], [tint, 0.12], ['#FFFFFF', 0.32], [tint, 0.12], [tint, 0]];
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, moving ? { transform: [{ translateX }] } : null]}>
      <Svg width={width} height={height} aria-hidden>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="0.3" stopColor={stops[0][0]} stopOpacity={stops[0][1]} />
            <Stop offset="0.42" stopColor={stops[1][0]} stopOpacity={stops[1][1]} />
            <Stop offset="0.5" stopColor={stops[2][0]} stopOpacity={stops[2][1]} />
            <Stop offset="0.58" stopColor={stops[3][0]} stopOpacity={stops[3][1]} />
            <Stop offset="0.7" stopColor={stops[4][0]} stopOpacity={stops[4][1]} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

/** Card stock: team-colour wash fading to night, with two printed stripes. */
export function Stock({ width, height, primary, secondary }: { width: number; height: number; primary: string; secondary: string }) {
  const id = `stock-${useId().replace(/[^\w-]/g, '')}`;
  return (
    <Svg style={StyleSheet.absoluteFill} width={width} height={height} viewBox="0 0 100 140" preserveAspectRatio="none"
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={primary} stopOpacity={0.95} />
          <Stop offset="0.55" stopColor={primary} stopOpacity={0.32} />
          <Stop offset="1" stopColor="#0B101B" stopOpacity={1} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="140" fill="#0B101B" />
      <Rect x="0" y="0" width="100" height="140" fill={`url(#${id})`} />
      <Polygon points="-10,70 110,26 110,34 -10,78" fill={secondary} opacity={0.16} />
      <Polygon points="-10,82 110,38 110,41 -10,85" fill={secondary} opacity={0.1} />
    </Svg>
  );
}

function StandCardImpl({
  competitorId, rarity, serial, width = 150, finish = 'base', eventId = null, count, favorite, won, animated = false,
}: StandCardProps) {
  const now = useNow(60_000);
  const face = cardFace(competitorId, now);
  const c = face?.competitor;
  const height = width * 1.4;
  const s = width / 150;
  const big = width >= 140;
  const tiny = width < 112;
  const frame = colors.rarity[rarity];
  const holo = finish === 'holo';
  const gameDay = !!eventId;
  const run = printRun(rarity, finish, gameDay);
  const primary = readableOnDark(c?.colors?.[0] ?? '#334155', 0.06);
  const secondary = c?.colors?.[1] ?? '#FFFFFF';
  const plate = mix(primary, '#0B101B', 0.55);
  const day = eventId ? gameDayDate(eventId) : null;
  const dayText = day ? new Date(day).toLocaleDateString([], { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '';
  const team = c?.parentId ? competitorById(c.parentId)?.name ?? null : null;
  const foil = FOIL[rarity];
  const label = [
    `${rarityLabel(rarity)}${holo ? ' Holo' : ''}${gameDay ? ' Game Day' : ''} Stand Card: ${c?.name ?? 'Unknown'}`,
    face ? `rated ${face.rating}${face.form ? `, in form plus ${face.form.boost}` : ''}` : null,
    face?.rookie ? 'rookie card' : null,
    `serial ${foilSerial(serial, run)}`,
    count && count > 1 ? `${count} copies` : null,
    favorite ? 'favorite' : null,
    won ? 'won its game' : null,
  ].filter(Boolean).join(', ');

  return (
    <View style={[styles.card, { width, height, borderColor: frame, borderWidth: rarity === 'legendary' || holo ? 3 : 2 }]}
      accessibilityLabel={label}>
      <Stock width={width} height={height} primary={primary} secondary={secondary} />
      {holo || rarity === 'epic' || rarity === 'legendary' ? (
        <Sheen width={width} height={height} holo={holo} animated={animated} tint={frame} />
      ) : null}
      <View pointerEvents="none" style={[styles.inner, { borderRadius: radius.md - 4 }]} />

      {/* The art. */}
      <View style={[styles.art, { top: height * (big ? 0.17 : 0.2), height: height * (big ? 0.36 : 0.42) }]} pointerEvents="none">
        <CompetitorBadge id={competitorId} size={width * (big ? 0.42 : 0.48)} />
      </View>

      {/* Top: rating and role on the left; set logo, rarity and RC on the right. */}
      <View style={[styles.top, { padding: 7 * s }]}>
        <View style={styles.ratingBox}>
          <Text style={[styles.rating, { fontSize: (tiny ? 26 : 34) * s, lineHeight: (tiny ? 27 : 35) * s }]}>{face?.rating ?? '–'}</Text>
          <Text style={[styles.role, { fontSize: 9 * s }]} numberOfLines={1}>{face?.role.toUpperCase()}</Text>
          <View style={{ marginTop: 2 * s }}><Icon name={sportIcon(c?.sportId ?? '')} size={11 * s} color={colors.text} /></View>
          {face?.form && !tiny ? (
            <View style={[styles.formChip, { paddingHorizontal: 4 * s, marginTop: 3 * s }]}>
              <Text style={[styles.formText, { fontSize: 8 * s }]}>▲{face.form.boost}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.topRight}>
          {!tiny ? <Text style={[styles.setLogo, { fontSize: 9 * s }]} numberOfLines={1}>{SET_LOGO}</Text> : null}
          <View style={[styles.rarityPill, { borderColor: frame, paddingHorizontal: 5 * s }]}>
            <Text style={[styles.rarity, { color: frame, fontSize: 8 * s }]} numberOfLines={1}>
              {holo ? 'HOLO ' : ''}{rarityLabel(rarity).toUpperCase()}
            </Text>
          </View>
          {face?.rookie ? (
            <View style={[styles.rc, { width: 20 * s, height: 15 * s }]}>
              <Text style={[styles.rcText, { fontSize: 10 * s }]}>RC</Text>
            </View>
          ) : null}
        </View>
      </View>

      {gameDay ? (
        <View style={[styles.ribbon, { top: height * 0.3, paddingVertical: 1 * s }]}>
          <Text style={[styles.ribbonText, { fontSize: 8 * s }]} numberOfLines={1}>GAME DAY{dayText ? ` · ${dayText.toUpperCase()}` : ''}</Text>
        </View>
      ) : null}

      {/* Name plate, attributes and footer. */}
      <View style={styles.bottom}>
        <View style={[styles.plate, { backgroundColor: plate, paddingVertical: 4 * s, paddingHorizontal: 7 * s, borderColor: frame }]}>
          <Text style={[styles.name, { fontSize: (big ? 16 : 14) * s, lineHeight: (big ? 17 : 15) * s }]} numberOfLines={2}>
            {c?.name ?? 'Unknown'}
          </Text>
          {!tiny ? <Text style={[styles.meta, { fontSize: 8.5 * s }]} numberOfLines={1}>{team ?? c?.home ?? ''}</Text> : null}
        </View>
        {big && face ? (
          <View style={[styles.attrs, { paddingHorizontal: 7 * s, paddingTop: 5 * s }]}>
            {face.attributes.map((a) => (
              <View key={a.label} style={styles.attr}>
                <Text style={[styles.attrValue, { fontSize: 13 * s }]}>{a.value}</Text>
                <Text style={[styles.attrLabel, { fontSize: 8 * s }]}>{a.label}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={[styles.footer, { paddingHorizontal: 7 * s, paddingBottom: 6 * s, paddingTop: 4 * s }]}>
          <Text style={[styles.code, { fontSize: 8.5 * s }]} numberOfLines={1}>{face?.checklist ?? ''}</Text>
          <View style={[styles.serialBox, { backgroundColor: run ? foil[0] : 'rgba(10,14,23,0.6)', borderColor: run ? foil[1] : colors.line, paddingHorizontal: 5 * s }]}>
            <Text style={[styles.serial, { fontSize: 10 * s, color: run ? '#0A0E17' : colors.text }]}>{foilSerial(serial, run)}</Text>
          </View>
        </View>
      </View>

      {won ? (
        <View style={[styles.won, { top: height * 0.42 }]}>
          <Text style={[styles.wonText, { fontSize: 11 * s }]}>WON</Text>
        </View>
      ) : null}
      {count && count > 1 ? (
        <View style={[styles.count, { top: height * 0.22 }]}><Text style={styles.countText}>×{count}</Text></View>
      ) : null}
      {favorite ? <View style={[styles.fav, { top: height * 0.5 }]}><Icon name="star" size={Math.max(12, 13 * s)} color={colors.accent} /></View> : null}
    </View>
  );
}

export const StandCard = memo(StandCardImpl);

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, backgroundColor: '#0B101B', overflow: 'hidden' },
  inner: { position: 'absolute', top: 3, left: 3, right: 3, bottom: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between' },
  ratingBox: { alignItems: 'center' },
  rating: { fontFamily: fonts.black, color: colors.text, fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  role: { fontFamily: fonts.bold, color: colors.text, letterSpacing: 0.8, opacity: 0.9 },
  formChip: { backgroundColor: colors.win, borderRadius: 3 },
  formText: { fontFamily: fonts.black, color: '#0A0E17' },
  topRight: { alignItems: 'flex-end', gap: 3, flexShrink: 1, marginLeft: 4 },
  setLogo: { fontFamily: fonts.black, color: colors.text, fontStyle: 'italic', letterSpacing: 0.4, opacity: 0.9 },
  rarityPill: { borderWidth: 1, borderRadius: 999, backgroundColor: 'rgba(10,14,23,0.6)' },
  rarity: { fontFamily: fonts.heavy, letterSpacing: 0.8 },
  rc: { borderRadius: 3, backgroundColor: '#F4F6FA', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#C8102E' },
  rcText: { fontFamily: fonts.black, color: '#C8102E' },
  ribbon: { position: 'absolute', left: 6, right: 6, backgroundColor: colors.live, borderRadius: 3, alignItems: 'center' },
  ribbonText: { fontFamily: fonts.black, color: '#FFFFFF', letterSpacing: 0.8 },
  art: { position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  plate: { borderTopWidth: 1.5, borderBottomWidth: 1.5 },
  name: { fontFamily: fonts.black, color: colors.text, textTransform: 'uppercase', letterSpacing: 0.2 },
  meta: { fontFamily: fonts.semibold, color: 'rgba(244,246,250,0.75)', letterSpacing: 0.3 },
  attrs: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 1 },
  attr: { width: '33.33%', flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  attrValue: { fontFamily: fonts.heavy, color: colors.text, fontVariant: ['tabular-nums'] },
  attrLabel: { fontFamily: fonts.bold, color: colors.textDim, letterSpacing: 0.5 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  code: { fontFamily: fonts.bold, color: colors.textDim, letterSpacing: 0.6, flexShrink: 1 },
  serialBox: { borderRadius: 3, borderWidth: 1 },
  serial: { fontFamily: fonts.black, fontVariant: ['tabular-nums'], letterSpacing: 0.3 },
  won: { position: 'absolute', right: -4, transform: [{ rotate: '-14deg' }], borderWidth: 2, borderColor: colors.win,
    backgroundColor: 'rgba(10,14,23,0.8)', borderRadius: 6, paddingHorizontal: 6 },
  wonText: { fontFamily: fonts.black, color: colors.win, letterSpacing: 1 },
  count: { position: 'absolute', right: 4, backgroundColor: colors.bg, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1,
    borderWidth: 1, borderColor: colors.line },
  countText: { color: colors.text, fontSize: 11, fontWeight: '900', fontVariant: ['tabular-nums'] },
  fav: { position: 'absolute', left: 6 },
});
