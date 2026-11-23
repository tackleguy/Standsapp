// Top of the Today screen: wordmark, wallet, search, day picker, and sport switcher.
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SPORTS, sportById } from '@/config/sports';
import { DAY, formatNumber, relativeDayLabel, utcDayKey } from '@/lib/format';
import { canGateCheck } from '@/logic/gateCheck';
import { useNow } from '@/hooks/useNow';
import { useUserStore } from '@/store/user';
import { colors, radius, space, type } from '@/theme/tokens';

import { IconButton } from './ui/Button';
import { Chip } from './ui/Chip';
import { sportIcon } from './ui/Icon';
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
}

export function TodayHeader({ dayStart, today, onDay, sport, onSport, liveCounts, totalLive, liveOnly, onLiveOnly }: Props) {
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
        <Pressable onPress={() => onLiveOnly(!liveOnly)} style={styles.ticker} accessibilityRole="button"
          accessibilityLabel={liveOnly ? 'Show all events' : `Show only the ${totalLive} live events`}>
          <LiveDot />
          <Text style={styles.tickerText}>{totalLive} live now</Text>
          <Text style={styles.tickerCta}>{liveOnly ? 'Show all' : 'Live only'}</Text>
        </Pressable>
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
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.sm },
  word: { ...type.display, fontSize: 38, color: colors.text, flex: 1, textTransform: 'uppercase', fontStyle: 'italic' },
  wallet: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.surface, borderRadius: radius.pill,
    paddingHorizontal: space.md, minHeight: 40, borderWidth: 1, borderColor: colors.line },
  walletText: { ...type.label, color: colors.accent, fontSize: 13 },
  walletDim: { ...type.label, color: colors.text, fontSize: 13 },
  gateDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.win },
  ticker: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginHorizontal: space.lg, marginTop: space.md, paddingHorizontal: space.md,
    minHeight: 40, borderRadius: radius.md, backgroundColor: 'rgba(255,77,94,0.1)', borderWidth: 1, borderColor: 'rgba(255,77,94,0.3)' },
  tickerText: { ...type.label, color: colors.text, flex: 1, fontSize: 13 },
  tickerCta: { ...type.label, color: '#FF8A95' },
  days: { gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md },
  day: { paddingHorizontal: space.md, minHeight: 36, justifyContent: 'center', borderRadius: radius.sm },
  dayOn: { backgroundColor: colors.surfaceHigh },
  dayText: { ...type.label, color: colors.textDim, fontSize: 14 },
  dayTextOn: { color: colors.text },
  chips: { gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md },
});
