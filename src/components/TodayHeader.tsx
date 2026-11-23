// Top of the Today screen: wordmark, wallet, search, live scores ticker, day picker,
// sport switcher, and a link to the sport's table.
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SPORTS, sportById } from '@/config/sports';
import { leagueName } from '@/data/api';
import { DAY, formatNumber, relativeDayLabel, utcDayKey } from '@/lib/format';
import { canGateCheck } from '@/logic/gateCheck';
import { useNow } from '@/hooks/useNow';
import { useUserStore } from '@/store/user';
import { colors, fonts, radius, space, type } from '@/theme/tokens';

import type { CardEvent } from './event/ScoreCard';
import { IconButton } from './ui/Button';
import { Chip } from './ui/Chip';
import { Icon, sportIcon } from './ui/Icon';
import { LiveDot } from './ui/LiveDot';

interface Props {
  dayStart: number;
  today: number;
  onDay: (d: number) => void;
  sport: string;
  onSport: (id: string) => void;
  liveCounts: Record<string, number>;
  totalLive: number;
  liveOnly: boolean;
  onLiveOnly: (v: boolean) => void;
  /** Live games for the scores ticker. */
  strip: CardEvent[];
}

export function TodayHeader({ dayStart, today, onDay, sport, onSport, liveCounts, totalLive, liveOnly, onLiveOnly, strip }: Props) {
  const router = useRouter();
  const clout = useUserStore((s) => s.clout);
  const tix = useUserStore((s) => s.tix);
  const followed = useUserStore((s) => s.followedSports);
  const lastGate = useUserStore((s) => s.lastGateCheck);
  const clock = useNow(60_000);
  const gateReady = canGateCheck(lastGate, utcDayKey(clock));
  const order = ['all', ...followed, ...SPORTS.map((s) => s.id).filter((id) => !followed.includes(id))];
  const days = [-1, 0, 1, 2, 3].map((d) => today + d * DAY);

  return (
    <View>
      <View style={styles.top}>
        <Text style={styles.word} accessibilityRole="header">Stands</Text>
        <Pressable onPress={() => router.push('/me')} accessibilityRole="button" accessibilityLabel={`${clout} Clout and ${tix} Tix. Open wallet`} style={styles.wallet}>
          <Text style={styles.walletText}>⚡ {formatNumber(clout, true)}</Text>
          <Text style={styles.walletDim}>🎟 {tix}</Text>
          {gateReady ? <View style={styles.gateDot} /> : null}
        </Pressable>
        <IconButton icon="search" label="Search" onPress={() => router.push('/search')} />
      </View>
      {totalLive > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ticker}>
          <Pressable onPress={() => onLiveOnly(!liveOnly)} accessibilityRole="button"
            accessibilityLabel={liveOnly ? 'Show all events' : `Show only the ${totalLive} live events`}
            style={[styles.liveToggle, liveOnly && styles.liveToggleOn]}>
            <LiveDot size={7} />
            <Text style={styles.liveToggleText}>{totalLive} LIVE</Text>
            <Text style={styles.liveToggleCta}>{liveOnly ? 'All' : 'Only'}</Text>
          </Pressable>
          {strip.map((e) => <TickerItem key={e.id} event={e} onPress={() => router.push({ pathname: '/event/[id]', params: { id: e.id } })} />)}
        </ScrollView>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
        {days.map((d) => {
          const on = d === dayStart;
          return (
            <Pressable key={d} onPress={() => onDay(d)} accessibilityRole="tab" accessibilityState={{ selected: on }}
              style={[styles.day, on && styles.dayOn]}>
              <Text style={[styles.dayText, on && styles.dayTextOn]}>{relativeDayLabel(d, today)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {order.map((id) => (
          <Chip key={id} label={id === 'all' ? 'All' : sportById(id)?.name ?? id} icon={id === 'all' ? 'apps' : sportIcon(id)}
            selected={sport === id} onPress={() => onSport(id)}
            count={id === 'all' ? totalLive : liveCounts[id]} live />
        ))}
      </ScrollView>
      {sport !== 'all' ? (
        <Pressable onPress={() => router.push({ pathname: '/standings/[sportId]', params: { sportId: sport } })}
          accessibilityRole="button" accessibilityLabel={`${leagueName(sport)} standings`}
          style={({ pressed }) => [styles.tableLink, pressed && { backgroundColor: colors.surfaceHigh }]}>
          <Icon name="podium" size={16} color={colors.accent} />
          <Text style={styles.tableText} numberOfLines={1}>{leagueName(sport)} standings</Text>
          <Icon name="chevron-forward" size={16} color={colors.textDim} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** One live game in the ticker: "BRA 1  RIV 1  76'". */
function TickerItem({ event, onPress }: { event: CardEvent; onPress: () => void }) {
  const isRace = event.format === 'race';
  const sides = isRace
    ? [...event.entries].sort((a, b) => (a.position ?? 99) - (b.position ?? 99)).slice(0, 1)
    : [...event.entries].sort((a, b) => (a.role === 'home' ? -1 : 0) - (b.role === 'home' ? -1 : 0));
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${event.title}, ${event.periodLabel ?? 'live'}`}
      style={({ pressed }) => [styles.tick, pressed && { backgroundColor: colors.surfaceHigh }]}>
      {isRace ? (
        <Text style={styles.tickName} numberOfLines={1}>{event.title.split(' ')[0]} · P1 {sides[0]?.shortName}</Text>
      ) : sides.map((s) => (
        <View key={s.competitorId} style={styles.tickSide}>
          <View style={[styles.tickColor, { backgroundColor: s.colors?.[0] ?? colors.line }]} />
          <Text style={styles.tickName}>{s.shortName}</Text>
          <Text style={styles.tickScore}>{event.format === 'innings' ? (s.scoreText ?? '–').split(' ')[0] : s.score ?? 0}</Text>
        </View>
      ))}
      <Text style={styles.tickClock} numberOfLines={1}>{event.periodLabel}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.sm },
  word: { ...type.display, fontSize: 38, color: colors.text, flex: 1, textTransform: 'uppercase', fontStyle: 'italic' },
  liveToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, minHeight: 40, borderRadius: radius.md,
    backgroundColor: 'rgba(255,77,94,0.12)', borderWidth: 1, borderColor: 'rgba(255,77,94,0.35)' },
  liveToggleOn: { backgroundColor: 'rgba(255,77,94,0.28)', borderColor: colors.live },
  liveToggleText: { fontFamily: fonts.black, fontSize: 15, color: colors.text, letterSpacing: 0.8 },
  liveToggleCta: { fontFamily: fonts.bold, fontSize: 13, color: '#FF8A95', letterSpacing: 0.5, textTransform: 'uppercase' },
  tick: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, minHeight: 40, borderRadius: radius.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, maxWidth: 260 },
  tickSide: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tickColor: { width: 3, height: 14, borderRadius: 2 },
  tickName: { fontFamily: fonts.bold, fontSize: 14, color: colors.textDim, letterSpacing: 0.5 },
  tickScore: { fontFamily: fonts.heavy, fontSize: 16, color: colors.text, fontVariant: ['tabular-nums'] },
  tickClock: { fontFamily: fonts.heavy, fontSize: 13, color: colors.live, fontVariant: ['tabular-nums'] },
  tableLink: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginHorizontal: space.lg, marginBottom: space.sm, paddingHorizontal: space.md,
    minHeight: 44, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  tableText: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.text, letterSpacing: 0.6, textTransform: 'uppercase' },
  wallet: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.surface, borderRadius: radius.pill,
    paddingHorizontal: space.md, minHeight: 40, borderWidth: 1, borderColor: colors.line },
  walletText: { ...type.label, color: colors.accent, fontSize: 13 },
  walletDim: { ...type.label, color: colors.text, fontSize: 13 },
  gateDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.win },
  ticker: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md },
  days: { gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md },
  day: { paddingHorizontal: space.md, minHeight: 36, justifyContent: 'center', borderRadius: radius.sm },
  dayOn: { backgroundColor: colors.surfaceHigh },
  dayText: { ...type.label, color: colors.textDim, fontSize: 14 },
  dayTextOn: { color: colors.text },
  chips: { gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md },
});
