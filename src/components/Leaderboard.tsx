// Leaderboards: Today, This week, or the Season; everyone, the fans you follow,
// or one sport. Top three on a podium, the top 100 below, fans around you, and
// your own place pinned to the bottom. A Section passes `fanIds` for its own board.
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SPORTS, sportById } from '@/config/sports';
import {
  countdown, movementWindowLabel, PERIODS, type BoardEntry, type BoardScope, type Period,
} from '@/data/demo/ranking';
import { SEASON_START } from '@/data/demo/season';
import { useNow } from '@/hooks/useNow';
import { useBoard, useMeInput } from '@/hooks/useRanking';
import { formatNumber } from '@/lib/format';
import { useUserStore } from '@/store/user';
import { colors, fonts, space, type } from '@/theme/tokens';

import { BoardRow } from './leaderboard/BoardRow';
import { fanHref } from './leaderboard/fanLink';
import { Podium } from './leaderboard/Podium';
import { YouBar } from './leaderboard/YouBar';
import { Chip } from './ui/Chip';
import { Icon, sportIcon } from './ui/Icon';
import { Segmented } from './ui/Misc';
import { EmptyState, ErrorState, Skeleton } from './ui/StateViews';

type Item =
  | { kind: 'row'; key: string; entry: BoardEntry }
  | { kind: 'gap'; key: string }
  | { kind: 'heading'; key: string; title: string };

const SEASON_LABEL = new Date(SEASON_START).toLocaleDateString([], { day: 'numeric', month: 'short', timeZone: 'UTC' });

export function Leaderboard({ fanIds, includeMe = true, initialPeriod = 'week' }: {
  fanIds?: string[]; includeMe?: boolean; initialPeriod?: Period;
}) {
  const router = useRouter();
  const now = useNow(15_000);
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [scope, setScope] = useState<string>('global');
  const followedFans = useUserStore((s) => s.followedFans);
  const followedSports = useUserStore((s) => s.followedSports);
  const isGuest = useUserStore((s) => s.profile.isGuest);
  const group = !!fanIds || scope === 'following';
  const sportId = !fanIds && scope !== 'global' && scope !== 'following' ? scope : null;

  const boardScope = useMemo<BoardScope>(() => {
    if (fanIds) return { kind: 'group', fanIds };
    if (scope === 'following') return { kind: 'group', fanIds: followedFans };
    if (scope === 'global') return { kind: 'global' };
    return { kind: 'sport', sportId: scope };
  }, [fanIds, scope, followedFans]);
  const me = useMeInput(period, sportId, includeMe, now);
  const board = useBoard(period, boardScope, me);
  const view = board.data;

  const items = useMemo<Item[]>(() => {
    if (!view) return [];
    const podium = view.top.length >= 3 && view.top[2].rank !== null;
    const out: Item[] = (podium ? view.top.slice(3) : view.top).map((entry) => ({ kind: 'row', key: entry.id, entry }));
    if (view.around.length > 0) {
      out.push({ kind: 'gap', key: 'gap' });
      out.push({ kind: 'heading', key: 'around', title: 'Around you' });
      for (const entry of view.around) out.push({ kind: 'row', key: `around-${entry.id}`, entry });
    }
    return out;
  }, [view]);

  const open = (e: BoardEntry) => router.push(fanHref(e.id));
  const sportOrder = useMemo(() => [...followedSports, ...SPORTS.map((s) => s.id).filter((id) => !followedSports.includes(id))], [followedSports]);

  const info = !view ? '' : period === 'today' && view.resetsAt
    ? `Resets in ${countdown(view.resetsAt - now)}`
    : period === 'week' ? `Rolling 7 days · tiers lock in ${countdown(view.tiersUpdateAt - now)}` : `Since ${SEASON_LABEL}`;

  const header = (
    <View>
      <View style={styles.controls}>
        <Segmented value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p.id, label: p.label }))} />
      </View>
      {!fanIds ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="Global" icon="globe-outline" selected={scope === 'global'} onPress={() => setScope('global')} />
          <Chip label="Following" icon="people" selected={scope === 'following'} onPress={() => setScope('following')}
            count={followedFans.length || undefined} />
          {sportOrder.map((id) => (
            <Chip key={id} label={sportById(id)?.name ?? id} icon={sportIcon(id)} selected={scope === id} onPress={() => setScope(id)} />
          ))}
        </ScrollView>
      ) : null}
      {view ? (
        <View style={styles.info}>
          <Text style={styles.infoStrong}>{group ? `${view.players} ${view.players === 1 ? 'fan' : 'fans'}` : `${formatNumber(view.ranked)} ranked`}</Text>
          <Icon name="time-outline" size={13} color={colors.textDim} />
          <Text style={styles.infoText} numberOfLines={1}>{info}</Text>
        </View>
      ) : null}
      {view && view.top.length >= 3 && view.top[2].rank !== null ? <Podium entries={view.top.slice(0, 3)} onOpen={open} /> : null}
      {view && items.length > 0 ? (
        <Text style={styles.legend}>Arrows show movement {movementWindowLabel(period)}</Text>
      ) : null}
    </View>
  );

  const empty = scope === 'following' && !fanIds && followedFans.length === 0 ? (
    <EmptyState icon="people" title="Race the fans you follow" body="Open any fan from the leaderboard or a chat and tap Follow. They show up here, ranked against you." />
  ) : view && view.top.length === 0 ? (
    <EmptyState icon="podium" title="Nobody on the board yet" body="The first winning Calls of the day land here as games finish." />
  ) : null;

  return (
    <View style={{ flex: 1 }}>
      {board.isLoading ? (<>{header}<Skeleton rows={6} height={56} /></>) : board.isError ? (<>{header}<ErrorState onRetry={() => board.refetch()} /></>) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.key}
          ListHeaderComponent={header}
          ListEmptyComponent={empty ?? undefined}
          renderItem={({ item }) => {
            if (item.kind === 'gap') return <View style={styles.gap}><Text style={styles.gapDots}>• • •</Text></View>;
            if (item.kind === 'heading') return <Text style={styles.heading}>{item.title}</Text>;
            return <BoardRow entry={item.entry} onPress={() => open(item.entry)} />;
          }}
          refreshControl={<RefreshControl refreshing={board.isFetching && !board.isLoading} onRefresh={() => { board.refetch(); }} tintColor={colors.accent} />}
          contentContainerStyle={{ paddingBottom: 130 }}
          initialNumToRender={14}
          windowSize={7}
        />
      )}
      {includeMe ? <YouBar view={view} isGuest={isGuest} now={now} group={group} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  controls: { paddingHorizontal: space.lg, paddingTop: space.sm },
  chips: { gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md },
  info: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.lg, paddingTop: space.md },
  infoStrong: { fontFamily: fonts.bold, fontSize: 14, color: colors.text, letterSpacing: 0.5, marginRight: 4 },
  infoText: { ...type.label, color: colors.textDim, flex: 1 },
  legend: { ...type.label, fontSize: 10, color: colors.loss, textAlign: 'right', paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: 4 },
  gap: { alignItems: 'center', paddingVertical: space.sm },
  gapDots: { color: colors.loss, letterSpacing: 4 },
  heading: { ...type.caps, color: colors.textDim, fontSize: 15, paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: 4 },
});
