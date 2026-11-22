// An event: sticky scoreboard plus Feed, Track (motorsport), Chat, Calls, and Stats.
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { ChatView } from '@/components/chat/ChatView';
import { EventHeader } from '@/components/event/EventHeader';
import { CallsTab, FeedTab } from '@/components/event/EventTabs';
import { StatsView } from '@/components/event/StatsView';
import { TrackTab } from '@/components/track/TrackTab';
import { IconButton } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Misc';
import { Header, Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/StateViews';
import { sportById } from '@/config/sports';
import { useAccountGate } from '@/hooks/useAccountGate';
import { useEvent } from '@/hooks/useLiveData';
import { hasTrackMap } from '@/lib/tracks';
import { useUserStore } from '@/store/user';
import { space } from '@/theme/tokens';

type Tab = 'feed' | 'track' | 'chat' | 'calls' | 'stats';

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
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
  const showTrack = hasTrackMap(state.meta.sportId);
  const active: Tab = tab ?? (showTrack && state.status === 'live' ? 'track' : 'feed');
  const options: { value: Tab; label: string; badge?: number }[] = [
    { value: 'feed', label: 'Feed' },
    ...(showTrack ? [{ value: 'track' as Tab, label: 'Track' }] : []),
    { value: 'chat', label: 'Chat' },
    { value: 'calls', label: 'Calls', badge: myCalls || undefined },
    { value: 'stats', label: 'Stats' },
  ];

  return (
    <Screen>
      <Header title={state.meta.title} subtitle={sport?.name} back
        right={<IconButton icon="share-outline" label="Share" onPress={() => shareEvent(state.meta.title)} />} />
      <EventHeader state={state} compact={compact && active !== 'chat'} />
      <View style={styles.tabs}><Segmented value={active} onChange={(t) => { setTab(t); setCompact(false); }} options={options} /></View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        {active === 'feed' && <FeedTab state={state} onScroll={onScroll} />}
        {active === 'track' && <TrackTab state={state} onScroll={onScroll} />}
        {active === 'chat' && <ChatView threadId={`event:${state.meta.id}`} onNeedAccount={() => require('join the chat')} />}
        {active === 'calls' && <CallsTab state={state} onScroll={onScroll} />}
        {active === 'stats' && (
          <ScrollView onScroll={onScroll} scrollEventThrottle={32}><StatsView sections={state.stats} /></ScrollView>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
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
