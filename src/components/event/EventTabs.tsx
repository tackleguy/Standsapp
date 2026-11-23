// The Feed and Calls tabs of the event screen.
import { FlashList } from '@shopify/flash-list';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import type { EventState } from '@/data/types';
import { useAccountGate } from '@/hooks/useAccountGate';
import { useEventCalls } from '@/hooks/useLiveData';
import { useNow } from '@/hooks/useNow';
import { formatDay, formatTime, timeUntil } from '@/lib/format';
import { CLOUT_DISCLAIMER } from '@/logic/rules';
import { useUserStore } from '@/store/user';
import { colors, fonts, space, type } from '@/theme/tokens';

import { CallCard } from '../calls/CallCard';
import { GamePackBanner } from '../cards/GamePackBanner';
import { LiveDot } from '../ui/LiveDot';
import { Segmented } from '../ui/Misc';
import { EmptyState, ErrorState, Skeleton } from '../ui/StateViews';
import { PlayRow } from './PlayRow';
import { WinProbChart } from './WinProbChart';

type ScrollHandler = (e: NativeSyntheticEvent<NativeScrollEvent>) => void;

export function FeedTab({ state, onScroll }: { state: EventState; onScroll: ScrollHandler }) {
  const now = useNow(10_000);
  const [filter, setFilter] = useState<'all' | 'key'>('all');
  const ratings = useUserStore((s) => s.ratings);
  const rate = useUserStore((s) => s.ratePlay);
  const { isGuest, require } = useAccountGate();
  const plays = useMemo(() => {
    const list = filter === 'key' ? state.plays.filter((p) => p.importance >= 2 || p.tag === 'PERIOD') : state.plays;
    return [...list].reverse();
  }, [state.plays, filter]);
  const keyCount = useMemo(() => state.plays.filter((p) => p.importance >= 2).length, [state.plays]);

  const header = (
    <View>
      <WinProbChart state={state} now={now} title={state.status === 'live' ? 'Live win probability' : 'How it swung'} />
      <View style={styles.feedHead}>
        {state.status === 'live' ? (
          <View style={styles.liveNote}>
            <LiveDot />
            <Text style={styles.liveText}>Live play-by-play</Text>
            <Text style={styles.liveSub}>Updates automatically</Text>
          </View>
        ) : null}
        <GamePackBanner state={state} now={now} />
        <Segmented value={filter} onChange={setFilter}
          options={[{ value: 'all', label: `All plays · ${state.plays.length}` }, { value: 'key', label: `Key moments · ${keyCount}` }]} />
      </View>
    </View>
  );

  if (state.status === 'scheduled') {
    return (
      <ScrollView onScroll={onScroll} scrollEventThrottle={32}>
        <View style={styles.feedHead}><GamePackBanner state={state} now={now} /></View>
        <EmptyState icon="time" title={`Starts ${timeUntil(state.meta.startsAt, now)}`}
          body={`${formatDay(state.meta.startsAt)} at ${formatTime(state.meta.startsAt)} · ${state.meta.venue}. The play-by-play begins at the start.`} />
      </ScrollView>
    );
  }
  if (state.status === 'postponed' || state.status === 'cancelled') {
    return <EmptyState icon="alert-circle" title={state.status === 'postponed' ? 'Postponed' : 'Cancelled'} body="Any Calls on this event are refunded automatically." />;
  }
  return (
    <FlashList
      data={plays}
      keyExtractor={(p) => p.id}
      getItemType={(p) => (p.importance === 3 ? 'big' : p.importance === 2 ? 'key' : 'minor')}
      // New plays slide in at the top, under the chart, instead of nudging the list away from them.
      maintainVisibleContentPosition={{ disabled: true }}
      onScroll={onScroll}
      scrollEventThrottle={32}
      ListHeaderComponent={header}
      ListEmptyComponent={<EmptyState icon="hourglass" title="Waiting for the first play" />}
      renderItem={({ item }) => (
        <PlayRow play={item} now={now} sportId={state.meta.sportId} myRating={ratings[item.id]} canRate={!isGuest}
          onRate={(n) => rate(item.id, n)} onNeedAccount={() => require('rate plays')} />
      )}
      ListFooterComponent={<View style={{ height: 40 }} />}
    />
  );
}

export function CallsTab({ state, onScroll }: { state: EventState; onScroll: ScrollHandler }) {
  const now = useNow(5000);
  const calls = useEventCalls(state.meta.id);
  const { require } = useAccountGate();
  if (calls.isLoading) return <Skeleton rows={3} height={180} />;
  if (calls.isError) return <ErrorState onRetry={() => calls.refetch()} />;
  const list = calls.data ?? [];
  return (
    <ScrollView onScroll={onScroll} scrollEventThrottle={32} contentContainerStyle={{ paddingTop: space.md, paddingBottom: 60 }}>
      <Text style={styles.disclaimer}>{CLOUT_DISCLAIMER}</Text>
      {list.length === 0 ? <EmptyState icon="flash" title="No Calls on this event" /> : list.map((c) => (
        <CallCard key={c.id} call={c} eventTitle={state.meta.title} sportId={state.meta.sportId} now={now}
          onNeedAccount={() => require('make Calls')} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  feedHead: { padding: space.lg, gap: space.md },
  liveNote: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  liveText: { fontFamily: fonts.heavy, fontSize: 15, letterSpacing: 0.6, color: colors.text, textTransform: 'uppercase' },
  liveSub: { ...type.label, color: colors.loss, marginLeft: 'auto' },
  disclaimer: { ...type.label, color: colors.textDim, textAlign: 'center', paddingHorizontal: space.xl, marginBottom: space.md, lineHeight: 17 },
});
