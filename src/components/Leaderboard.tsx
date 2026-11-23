// Weekly leaderboard: Clout won from Calls in the last seven days.
import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { useLeaderboard } from '@/hooks/useLiveData';
import { useNow } from '@/hooks/useNow';
import { formatNumber } from '@/lib/format';
import { useUserStore, weeklyCloutWon } from '@/store/user';
import { colors, space, type } from '@/theme/tokens';

import { Avatar } from './ui/Misc';
import { ErrorState, Skeleton } from './ui/StateViews';

export function Leaderboard({ fanIds, includeMe = true }: { fanIds?: string[]; includeMe?: boolean }) {
  const board = useLeaderboard(fanIds);
  const profile = useUserStore((s) => s.profile);
  const ledger = useUserStore((s) => s.ledger);
  const now = useNow(60_000);
  const rows = useMemo(() => {
    const list = [...(board.data ?? [])];
    if (includeMe) {
      list.push({ userId: 'me', username: profile.username, displayName: profile.displayName, avatarSeed: profile.avatarSeed,
        cloutWon: weeklyCloutWon(ledger, now), isMe: true });
    }
    return list.sort((a, b) => b.cloutWon - a.cloutWon).map((r, i) => ({ ...r, rank: i + 1 }));
  }, [board.data, includeMe, profile, ledger, now]);

  if (board.isLoading) return <Skeleton rows={6} height={52} />;
  if (board.isError) return <ErrorState onRetry={() => board.refetch()} />;
  const me = rows.find((r) => r.isMe);
  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.userId}
      ListHeaderComponent={me ? (
        <View style={styles.meBox}>
          <Text style={styles.meRank}>#{me.rank}</Text>
          <Text style={styles.meText}>Your rank this week · +{formatNumber(me.cloutWon)} Clout won</Text>
        </View>
      ) : undefined}
      renderItem={({ item }) => (
        <View style={[styles.row, item.isMe && styles.rowMe]} accessibilityLabel={`Rank ${item.rank}, ${item.displayName}, ${item.cloutWon} Clout`}>
          <Text style={[styles.rank, item.rank <= 3 && { color: colors.accent }]}>{item.rank}</Text>
          <Avatar seed={item.avatarSeed} name={item.displayName} size={34} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{item.isMe ? 'You' : item.displayName}</Text>
            <Text style={styles.handle} numberOfLines={1}>@{item.username}</Text>
          </View>
          <Text style={styles.score}>+{formatNumber(item.cloutWon)}</Text>
        </View>
      )}
      contentContainerStyle={{ paddingBottom: 60 }}
    />
  );
}

const styles = StyleSheet.create({
  meBox: { flexDirection: 'row', alignItems: 'center', gap: space.md, margin: space.lg, padding: space.lg, borderRadius: 14, backgroundColor: 'rgba(255,182,39,0.1)', borderWidth: 1, borderColor: 'rgba(255,182,39,0.35)' },
  meRank: { fontSize: 28, fontWeight: '900', color: colors.accent },
  meText: { ...type.body, color: colors.text, flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 56 },
  rowMe: { backgroundColor: colors.surface },
  rank: { width: 28, fontSize: 16, fontWeight: '900', color: colors.textDim, textAlign: 'center' },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  handle: { ...type.label, fontSize: 11, color: colors.loss },
  score: { fontSize: 16, fontWeight: '900', color: colors.text, fontVariant: ['tabular-nums'] },
});
