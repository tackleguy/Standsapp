import { Link, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { Badge } from '@/components/Badge';
import { Button } from '@/components/ui/Button';
import { LiveDot } from '@/components/ui/LiveDot';
import { Screen } from '@/components/ui/Screen';
import { SPORTS } from '@/config/sports';
import { competitorById, crowdLabel, watchersFor } from '@/data/api';
import { useDayEvents } from '@/hooks/useLiveData';
import { useNow } from '@/hooks/useNow';
import { startOfLocalDay } from '@/lib/format';
import { colors, fonts, radius, space, type } from '@/theme/tokens';

export default function Welcome() {
  const router = useRouter();
  const now = useNow(60_000);
  const events = useDayEvents(startOfLocalDay(now));

  // Show what is happening right now: the busiest live games and the crowd.
  const live = useMemo(() => {
    const t = Math.max(now, events.dataUpdatedAt);
    const list = (events.data ?? []).filter((s) => s.status === 'live' && s.meta.format === 'head_to_head')
      .map((s) => ({ s, watchers: watchersFor(s, t) }));
    const total = (events.data ?? []).filter((s) => s.status === 'live').reduce((a, s) => a + watchersFor(s, t), 0);
    return { games: list.sort((a, b) => b.watchers - a.watchers).slice(0, 3), count: (events.data ?? []).filter((s) => s.status === 'live').length, total };
  }, [events.data, events.dataUpdatedAt, now]);

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.glow} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <RadialGradient id="welcome-flood" cx="50" cy="0" r="70" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={colors.accent} stopOpacity={0.22} />
              <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill="url(#welcome-flood)" />
        </Svg>
      </View>
      <View style={styles.wrap}>
        <View style={styles.hero}>
          <Text style={styles.word} accessibilityRole="header">Stands</Text>
          <Text style={styles.tag}>Every sport. One crowd.</Text>
          {live.count > 0 ? (
            <View style={styles.liveRow}>
              <LiveDot />
              <Text style={styles.live}>{live.count} games live now · {crowdLabel(live.total)} fans watching</Text>
            </View>
          ) : (
            <Text style={styles.liveQuiet}>Live scores, play-by-play, and the chat — {SPORTS.length} sports</Text>
          )}
          {live.games.length > 0 ? (
            <View style={styles.scores}>
              {live.games.map(({ s, watchers }) => {
                const [home, away] = s.entries;
                return (
                  <View key={s.meta.id} style={styles.score}>
                    {[home, away].map((e) => {
                      const c = competitorById(e.competitorId);
                      return (
                        <View key={e.competitorId} style={styles.side}>
                          <Badge name={c?.name ?? '?'} shortName={c?.shortName} kind={c?.kind} colors={c?.colors} size={22} />
                          <Text style={styles.short}>{c?.shortName}</Text>
                          <Text style={styles.num}>{e.score ?? 0}</Text>
                        </View>
                      );
                    })}
                    <Text style={styles.clock} numberOfLines={1}>{s.periodLabel}</Text>
                    <Text style={styles.watching}>{crowdLabel(watchers)} watching</Text>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
        <View style={styles.points}>
          {[
            ['Rate the big moments', 'Every play, scored 1 to 10 by the crowd.'],
            ['Make the call', 'Predict with free Clout. No real money, ever.'],
            ['Collect Stand Cards', 'Open packs with Tix you earn by showing up.'],
            ['Climb the leaderboard', 'Weekly ranks, tiers, and your own Sections.'],
          ].map(([t, b]) => (
            <View key={t} style={styles.point}>
              <Text style={styles.pointTitle}>{t}</Text>
              <Text style={styles.pointBody}>{b}</Text>
            </View>
          ))}
        </View>
        <View style={styles.bottom}>
          <Button label="Get started" icon="arrow-forward" onPress={() => router.push('/sports')} />
          <Text style={styles.legal}>
            Free to play. Ages 13+. By continuing you agree to our{' '}
            <Link href="/rules" style={styles.link}>community rules</Link> and{' '}
            <Link href="/privacy" style={styles.link}>privacy policy</Link>.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 420 },
  wrap: { flex: 1, padding: space.xl, justifyContent: 'space-between', maxWidth: 560, width: '100%', alignSelf: 'center' },
  hero: { alignItems: 'center', marginTop: space.xl, gap: space.sm },
  word: { ...type.display, fontSize: 84, lineHeight: 90, color: colors.text, textTransform: 'uppercase', fontStyle: 'italic' },
  tag: { fontFamily: fonts.bold, fontSize: 22, color: colors.accent, letterSpacing: 1.2, textTransform: 'uppercase' },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  live: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, letterSpacing: 0.4 },
  liveQuiet: { ...type.label, color: colors.textDim, marginTop: space.sm },
  scores: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  score: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(255,77,94,0.3)', padding: space.sm, gap: 4 },
  side: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  short: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.textDim, letterSpacing: 0.5 },
  num: { fontFamily: fonts.heavy, fontSize: 20, color: colors.text, fontVariant: ['tabular-nums'] },
  clock: { fontFamily: fonts.heavy, fontSize: 13, color: colors.live, fontVariant: ['tabular-nums'] },
  watching: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textDim },
  points: { gap: space.lg },
  point: { borderLeftWidth: 3, borderColor: colors.accent, paddingLeft: space.md },
  pointTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  pointBody: { ...type.body, color: colors.textDim },
  bottom: { gap: space.md },
  legal: { ...type.label, color: colors.textDim, textAlign: 'center', lineHeight: 18 },
  link: { color: colors.accent, textDecorationLine: 'underline' },
});
