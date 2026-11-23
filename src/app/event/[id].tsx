// An event: live scoreboard plus Preview or Feed, Track (motorsport), Chat, Calls, and Stats.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { ChatView } from '@/components/chat/ChatView';
import { BigMoment } from '@/components/event/BigMoment';
import { EventHeader } from '@/components/event/EventHeader';
import { CallsTab, FeedTab } from '@/components/event/EventTabs';
import { FieldStrip } from '@/components/event/FieldStrip';
import { PlayersTab } from '@/components/event/PlayersTab';
import { PreviewTab } from '@/components/event/PreviewTab';
import { StatsView } from '@/components/event/StatsView';
import { WinProbChart } from '@/components/event/WinProbChart';
import { TrackTab } from '@/components/track/TrackTab';
import { IconButton } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Misc';
import { Header, Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/StateViews';
import { sportById } from '@/config/sports';
import { competitorById, getWorld } from '@/data/api';
import { sportStats } from '@/data/playerApi';
import type { EventState } from '@/data/types';
import { useAccountGate } from '@/hooks/useAccountGate';
import { useEvent } from '@/hooks/useLiveData';
import { useNow } from '@/hooks/useNow';
import { hasTrackMap } from '@/lib/tracks';
import { useUserStore } from '@/store/user';
import { space } from '@/theme/tokens';

type Tab = 'preview' | 'feed' | 'track' | 'chat' | 'calls' | 'stats' | 'players' | `side:${string}`;

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const event = useEvent(String(id));
  const [tab, setTab] = useState<Tab | null>(null);
  const [compact, setCompact] = useState(false);
  const { require } = useAccountGate();
  const myCalls = useUserStore((s) => s.predictions.filter((p) => p.eventId === id && p.status === 'open').length);
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    setCompact((c) => (c ? y > 20 : y > 80));
  }, []);

  if (event.isLoading) return <Screen><Header title="Loading…" back /><Skeleton rows={4} /></Screen>;
  if (event.isError) return <Screen><Header title="Event" back /><ErrorState onRetry={() => event.refetch()} /></Screen>;
  const state = event.data;
  if (!state) return <Screen><Header title="Event" back /><EmptyState icon="help-circle" title="Event not found" body="It may have been removed from the schedule." /></Screen>;

  const sport = sportById(state.meta.sportId);
  const comp = getWorld().competitionById.get(state.meta.competitionId);
  const showTrack = hasTrackMap(state.meta.sportId);
  const teamSides = state.meta.competitorIds.length === 2 && state.meta.competitorIds.every((cid) => competitorById(cid)?.kind === 'team');
  const scheduled = state.status === 'scheduled';
  const first: Tab = scheduled ? 'preview' : 'feed';
  const requested = tab === 'preview' && !scheduled ? 'feed' : tab === 'feed' && scheduled ? 'preview' : tab;
  const active: Tab = requested ?? (showTrack && state.status === 'live' ? 'track' : first);
  const options: { value: Tab; label: string; badge?: number }[] = [
    { value: first, label: scheduled ? 'Preview' : 'Feed' },
    ...(showTrack ? [{ value: 'track' as Tab, label: 'Track' }] : []),
    { value: 'chat', label: 'Chat' },
    { value: 'calls', label: 'Calls', badge: myCalls || undefined },
    ...(scheduled ? [] : [{ value: 'stats' as Tab, label: 'Stats' }]),
    // A tab per team in team sports (like "NE" and "SEA"), or one for the whole field.
    ...(scheduled || state.status === 'cancelled' || state.status === 'postponed' ? [] : teamSides
      ? state.meta.competitorIds.map((cid) => ({ value: `side:${cid}` as Tab, label: competitorById(cid)?.shortName ?? 'Team' }))
      : [{ value: 'players' as Tab, label: fieldLabel(state.meta.sportId) }]),
  ];
  const choose = (t: Tab) => { setTab(t); setCompact(false); };

  return (
    <Screen>
      <Header title={state.meta.title} subtitle={[sport?.name, comp?.name].filter(Boolean).join(' · ')} back
        right={(
          <>
            <IconButton icon="podium-outline" label="League table" onPress={() => router.push(`/standings/${state.meta.sportId}`)} />
            <IconButton icon="share-outline" label="Share" onPress={() => shareEvent(state.meta.title)} />
          </>
        )} />
      <EventHeader state={state} compact={compact && active !== 'chat'} />
      <FieldStrip state={state} />
      <View style={styles.tabs}><Segmented value={active} onChange={choose} options={options} /></View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        {active === 'preview' && <PreviewTab state={state} onScroll={onScroll} onMakeCalls={() => choose('calls')} />}
        {active === 'feed' && <FeedTab state={state} onScroll={onScroll} onOpenChat={() => choose('chat')} />}
        {active === 'track' && <TrackTab state={state} onScroll={onScroll} />}
        {active === 'chat' && <ChatView threadId={`event:${state.meta.id}`} onNeedAccount={() => require('join the chat')} />}
        {active === 'calls' && <CallsTab state={state} onScroll={onScroll} />}
        {active === 'stats' && <StatsTab state={state} onScroll={onScroll} />}
        {active === 'players' && <PlayersTab state={state} sideId={null} onScroll={onScroll} />}
        {active.startsWith('side:') && <PlayersTab key={active} state={state} sideId={active.slice(5)} onScroll={onScroll} />}
        <BigMoment state={state} />
      </KeyboardAvoidingView>
    </Screen>
  );
}

function StatsTab({ state, onScroll }: { state: EventState; onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void }) {
  const now = useNow(10_000);
  return (
    <ScrollView onScroll={onScroll} scrollEventThrottle={32}>
      <WinProbChart state={state} now={now} title={state.status === 'finished' ? 'How it swung' : 'Win probability'} />
      <StatsView sections={state.stats} />
    </ScrollView>
  );
}

/** "Drivers", "Riders", "Golfers"... for the tab listing everyone in a field. */
function fieldLabel(sportId: string): string {
  const label = sportStats(sportId).athletePos?.label;
  return label && label !== 'Player' ? `${label}s` : 'Players';
}

async function shareEvent(title: string) {
  const { Share } = await import('react-native');
  try {
    await Share.share({ message: `${title} — follow it live on Stands` });
  } catch {
    // Sharing is optional; ignore if the phone or browser does not support it.
  }
}

const styles = StyleSheet.create({
  tabs: { paddingHorizontal: space.lg, paddingVertical: space.sm },
});
