// The big games right now: a swipeable row of hero scoreboards at the top of Today.
import { useRouter } from 'expo-router';
import { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { crowdLabel } from '@/data/demo/crowd';
import { colors, fonts, radius, space } from '@/theme/tokens';

import { Badge } from './Badge';
import { playIcon } from './event/playIcons';
import type { CardEntry, CardEvent } from './event/ScoreCard';
import { FlashScore } from './event/FlashScore';
import { Icon } from './ui/Icon';
import { LiveDot } from './ui/LiveDot';
import { TeamGlow } from './ui/TeamGlow';

const GAP = space.md;

export function FeaturedEvents({ events }: { events: CardEvent[] }) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(520, width) - space.lg * 2 - (events.length > 1 ? 28 : 0);
  if (events.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={cardWidth + GAP}
      snapToAlignment="start" contentContainerStyle={styles.strip}>
      {events.map((e) => <Hero key={e.id} event={e} width={cardWidth} />)}
    </ScrollView>
  );
}

const Hero = memo(function Hero({ event, width }: { event: CardEvent; width: number }) {
  const router = useRouter();
  const open = () => router.push({ pathname: '/event/[id]', params: { id: event.id } });
  const isRace = event.format === 'race';
  const home = event.entries.find((e) => e.role === 'home');
  const away = event.entries.find((e) => e.role === 'away');
  const podium = isRace ? [...event.entries].sort((a, b) => (a.position ?? 99) - (b.position ?? 99)).slice(0, 3) : [];
  const leaderColor = podium[0]?.colors?.[0] ?? null;

  return (
    <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`Featured: ${event.title}, ${event.periodLabel ?? 'live'}`}
      style={({ pressed }) => [styles.hero, { width }, pressed && { opacity: 0.92 }]}>
      <TeamGlow left={isRace ? leaderColor : home?.colors?.[0]} right={isRace ? podium[1]?.colors?.[0] : away?.colors?.[0]} strength={0.55} />
      <View style={styles.top}>
        <View style={styles.livePill}>
          <LiveDot size={6} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
        <Text style={styles.comp} numberOfLines={1}>{event.competitionName}</Text>
        {event.watchers ? (
          <View style={styles.watch}>
            <Icon name="eye" size={13} color={colors.text} />
            <Text style={styles.watchText}>{crowdLabel(event.watchers)}</Text>
          </View>
        ) : null}
      </View>

      {isRace ? (
        <View style={styles.raceBody}>
          <Text style={styles.raceTitle} numberOfLines={1}>{event.title}</Text>
          {podium.map((p) => (
            <View key={p.competitorId} style={styles.raceRow}>
              <Text style={styles.racePos}>{p.position}</Text>
              <View style={[styles.livery, { backgroundColor: p.colors?.[0] ?? colors.line }]} />
              <Text style={styles.raceName} numberOfLines={1}>{p.name}</Text>
              <Text style={styles.raceGap} numberOfLines={1}>{p.scoreText}</Text>
            </View>
          ))}
        </View>
      ) : home && away ? (
        <View style={styles.body}>
          <Side entry={home} />
          <View style={styles.center}>
            {event.format === 'innings' ? (
              <>
                <Text style={styles.inningsScore} numberOfLines={1}>{home.scoreText ?? '–'}</Text>
                <Text style={styles.inningsScore} numberOfLines={1}>{away.scoreText ?? '–'}</Text>
              </>
            ) : (
              <View style={styles.scoreRow}>
                <FlashScore value={String(home.score ?? 0)} style={styles.big} />
                <Text style={styles.dash}>-</Text>
                <FlashScore value={String(away.score ?? 0)} style={styles.big} />
              </View>
            )}
            <Text style={styles.clock} numberOfLines={1}>{event.periodLabel}</Text>
          </View>
          <Side entry={away} />
        </View>
      ) : null}

      {typeof event.progress === 'number' ? (
        <View style={styles.track}><View style={[styles.fill, { width: `${Math.round(event.progress * 100)}%` }]} /></View>
      ) : null}
      {event.keyPlay ? (
        <Text style={styles.key} numberOfLines={1}>
          {playIcon(event.keyPlay.tag, event.sportId ?? '')} <Text style={styles.keyClock}>{event.keyPlay.clock}</Text>  {event.keyPlay.text}
        </Text>
      ) : <Text style={styles.key}> </Text>}
    </Pressable>
  );
});

function Side({ entry }: { entry: CardEntry }) {
  return (
    <View style={styles.side}>
      <Badge name={entry.name} shortName={entry.shortName} kind={entry.kind} size={52} colors={entry.colors} />
      <Text style={styles.short} numberOfLines={1}>{entry.shortName}</Text>
      {entry.record ? <Text style={styles.record} numberOfLines={1}>{entry.record}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { gap: GAP, paddingHorizontal: space.lg, paddingBottom: space.sm },
  hero: { borderRadius: radius.lg, backgroundColor: '#101726', borderWidth: 1, borderColor: colors.line, overflow: 'hidden',
    padding: space.lg, gap: space.sm, minHeight: 196 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.live, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  liveText: { fontFamily: fonts.black, fontSize: 13, color: '#FFFFFF', letterSpacing: 1 },
  comp: { flex: 1, fontFamily: fonts.bold, fontSize: 13, color: colors.text, letterSpacing: 0.9, textTransform: 'uppercase', opacity: 0.85 },
  watch: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(10,14,23,0.55)', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  watchText: { fontFamily: fonts.bold, fontSize: 13, color: colors.text, fontVariant: ['tabular-nums'] },
  body: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.xs },
  side: { flex: 1, alignItems: 'center', gap: 2 },
  short: { fontFamily: fonts.heavy, fontSize: 18, color: colors.text, letterSpacing: 0.8 },
  record: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textDim, fontVariant: ['tabular-nums'] },
  center: { alignItems: 'center', minWidth: 130 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  big: { fontFamily: fonts.black, fontSize: 54, color: colors.text, fontVariant: ['tabular-nums'], lineHeight: 60 },
  dash: { fontFamily: fonts.bold, fontSize: 34, color: colors.textDim },
  inningsScore: { fontFamily: fonts.heavy, fontSize: 22, color: colors.text, fontVariant: ['tabular-nums'] },
  clock: { fontFamily: fonts.heavy, fontSize: 16, color: colors.live, letterSpacing: 0.4, fontVariant: ['tabular-nums'] },
  track: { height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  fill: { height: 2, backgroundColor: colors.live },
  key: { fontSize: 13, color: colors.textDim },
  keyClock: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  raceBody: { gap: 4, paddingVertical: space.xs },
  raceTitle: { fontFamily: fonts.black, fontSize: 24, color: colors.text, textTransform: 'uppercase', letterSpacing: 0.3 },
  raceRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 26 },
  racePos: { fontFamily: fonts.heavy, fontSize: 17, color: colors.text, width: 16, textAlign: 'center' },
  livery: { width: 4, height: 18, borderRadius: 2 },
  raceName: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  raceGap: { fontFamily: fonts.bold, fontSize: 15, color: colors.textDim, fontVariant: ['tabular-nums'] },
});
