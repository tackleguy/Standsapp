// Calls hub: every open prediction across live and upcoming events, plus your record.
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CallCard } from '@/components/calls/CallCard';
import { MyCallsList } from '@/components/calls/MyCalls';
import { Chip } from '@/components/ui/Chip';
import { sportIcon } from '@/components/ui/Icon';
import { Segmented } from '@/components/ui/Misc';
import { Header, Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/StateViews';
import { SPORTS, sportById } from '@/config/sports';
import { useAccountGate } from '@/hooks/useAccountGate';
import { useOpenCalls } from '@/hooks/useLiveData';
import { useNow } from '@/hooks/useNow';
import { formatNumber } from '@/lib/format';
import { CLOUT_DISCLAIMER } from '@/logic/rules';
import { useUserStore } from '@/store/user';
import { colors, space, type } from '@/theme/tokens';

export default function CallsScreen() {
  const router = useRouter();
  const now = useNow(5000);
  const [view, setView] = useState<'open' | 'mine'>('open');
  const followed = useUserStore((s) => s.followedSports);
  const [sport, setSport] = useState<string>('mine');
  const sportIds = sport === 'mine' ? followed : sport === 'all' ? [] : [sport];
  const open = useOpenCalls(sportIds);
  const clout = useUserStore((s) => s.clout);
  const active = useUserStore((s) => s.predictions.filter((p) => p.status === 'open').length);
  const { require } = useAccountGate();
  const chipIds = ['mine', 'all', ...SPORTS.map((s) => s.id)];

  return (
    <Screen>
      <Header title="Calls" large right={<Text style={styles.balance}>⚡ {formatNumber(clout)}</Text>} />
      <View style={styles.seg}>
        <Segmented value={view} onChange={setView} options={[
          { value: 'open', label: 'Make a call' }, { value: 'mine', label: 'My calls', badge: active || undefined },
        ]} />
      </View>
      {view === 'mine' ? <MyCallsList /> : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ flexGrow: 0 }}>
            {chipIds.map((id) => (
              <Chip key={id} label={id === 'mine' ? 'My sports' : id === 'all' ? 'All sports' : sportById(id)?.name ?? id}
                icon={id === 'mine' ? 'star' : id === 'all' ? 'apps' : sportIcon(id)} selected={sport === id} onPress={() => setSport(id)} />
            ))}
          </ScrollView>
          {open.isLoading ? <Skeleton rows={3} height={200} /> : open.isError ? <ErrorState onRetry={() => open.refetch()} /> : (
            <FlashList
              data={(open.data ?? []).slice(0, 60)}
              keyExtractor={(x) => x.call.id}
              ListHeaderComponent={<Text style={styles.disclaimer}>{CLOUT_DISCLAIMER}</Text>}
              ListEmptyComponent={<EmptyState icon="flash" title="No open Calls" body="Try another sport, or check back when the next events open." />}
              renderItem={({ item }) => (
                <CallCard call={item.call} eventTitle={item.state.meta.title} sportId={item.state.meta.sportId} now={now} showEvent
                  onOpenEvent={() => router.push({ pathname: '/event/[id]', params: { id: item.state.meta.id } })}
                  onNeedAccount={() => require('make Calls')} />
              )}
            />
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  balance: { ...type.label, color: colors.accent, fontSize: 15 },
  seg: { paddingHorizontal: space.lg, paddingBottom: space.sm },
  chips: { gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.sm },
  disclaimer: { ...type.label, color: colors.textDim, textAlign: 'center', padding: space.md, paddingHorizontal: space.xl, lineHeight: 17 },
});
