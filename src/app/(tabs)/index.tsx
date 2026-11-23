// Today: live scores first, then what's starting soon, later, and final.
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { ScoreCard } from '@/components/event/ScoreCard';
import { FeaturedEvents } from '@/components/FeaturedEvents';
import { TodayHeader } from '@/components/TodayHeader';
import { Button } from '@/components/ui/Button';
import { SectionHeading } from '@/components/ui/Misc';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/StateViews';
import { sportById } from '@/config/sports';
import { nextEventForSport } from '@/data/api';
import { useNow } from '@/hooks/useNow';
import { useTodayFeed, type FeedItem } from '@/hooks/useTodayFeed';
import { formatDay, formatTime, startOfLocalDay } from '@/lib/format';
import { useSettingsStore } from '@/store/settings';
import { useUserStore } from '@/store/user';
import { colors, space, type } from '@/theme/tokens';

export default function Today() {
  const router = useRouter();
  const now = useNow(60_000);
  const today = startOfLocalDay(now);
  const [dayStart, setDayStart] = useState(today);
  const [showAllFinals, setShowAllFinals] = useState(false);
  const sport = useSettingsStore((s) => s.selectedSport);
  const setSport = useSettingsStore((s) => s.setSelectedSport);
  const liveOnly = useSettingsStore((s) => s.liveOnly);
  const setLiveOnly = useSettingsStore((s) => s.setLiveOnly);
  const feed = useTodayFeed(dayStart, sport, liveOnly, showAllFinals, now);

  const header = (
    <View>
      <TodayHeader dayStart={dayStart} today={today} onDay={setDayStart} sport={sport} onSport={setSport}
        liveCounts={feed.liveCounts} totalLive={feed.totalLive} liveOnly={liveOnly} onLiveOnly={setLiveOnly} strip={feed.strip} />
      {dayStart === today && sport === 'all' && !liveOnly ? <FeaturedEvents events={feed.featured} /> : null}
    </View>
  );

  const renderItem = ({ item }: { item: FeedItem }) => {
    if (item.kind === 'heading') {
      return <SectionHeading title={`${item.title} · ${item.count}`} live={item.live} />;
    }
    if (item.kind === 'more') {
      return <Button label={`Show ${item.hidden} more`} variant="ghost" small onPress={() => setShowAllFinals(true)} style={{ marginBottom: space.md }} />;
    }
    return <ScoreCard event={item.event} onPress={() => router.push({ pathname: '/event/[id]', params: { id: item.event.id } })} />;
  };

  return (
    <Screen>
      {feed.isLoading ? (<>{header}<Skeleton rows={5} /></>) : feed.isError ? (<>{header}<ErrorState onRetry={() => feed.refetch()} /></>) : (
        <FlashList
          data={feed.items}
          keyExtractor={(i) => i.key}
          getItemType={(i) => i.kind}
          renderItem={renderItem}
          ListHeaderComponent={header}
          ListEmptyComponent={<QuietDay liveOnly={liveOnly} onShowAll={() => setLiveOnly(false)} sport={sport} now={now} />}
          ListFooterComponent={<Text style={styles.footer}>Preview season: games, scores and fans are simulated until live feeds connect.</Text>}
          refreshControl={<RefreshControl refreshing={feed.isFetching && !feed.isLoading} onRefresh={() => { feed.refetch(); }} tintColor={colors.accent} />}
        />
      )}
    </Screen>
  );
}

function QuietDay({ liveOnly, onShowAll, sport, now }: { liveOnly: boolean; onShowAll: () => void; sport: string; now: number }) {
  const router = useRouter();
  const followed = useUserStore((s) => s.followedSports);
  const next = useMemo(() => {
    const ids = sport === 'all' ? (followed.length ? followed : ['f1', 'cricket', 'rugby_union']) : [sport];
    return ids.map((id) => ({ id, meta: nextEventForSport(id, now) })).filter((x) => x.meta);
  }, [followed, sport, now]);
  if (liveOnly) return <EmptyState icon="radio" title="Nothing live right now" body="Check back soon, or see everything on today." actionLabel="Show all events" onAction={onShowAll} />;
  return (
    <View>
      <EmptyState icon="moon" title="A quiet day" body="Here is what is coming up next for your sports." />
      {next.map(({ id, meta }) => meta && (
        <Pressable key={id} style={styles.next} onPress={() => router.push({ pathname: '/event/[id]', params: { id: meta.id } })} accessibilityRole="button">
          <Text style={styles.nextSport}>{sportById(id)?.name}</Text>
          <Text style={styles.nextTitle}>{meta.title}</Text>
          <Text style={styles.nextTime}>{formatDay(meta.startsAt)} · {formatTime(meta.startsAt)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { ...type.label, color: colors.loss, textAlign: 'center', padding: space.xl },
  next: { marginHorizontal: space.lg, marginBottom: space.sm, padding: space.lg, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.line },
  nextSport: { ...type.label, color: colors.accent },
  nextTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 2 },
  nextTime: { ...type.label, color: colors.textDim, marginTop: 2 },
});
