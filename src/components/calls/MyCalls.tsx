// Your record and every Call you have made.
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useNow } from '@/hooks/useNow';
import { formatMultiplier, formatNumber, timeAgo } from '@/lib/format';
import { potentialPayout, summarizeRecord } from '@/logic/predictions';
import { useUserStore, type Prediction } from '@/store/user';
import { colors, radius, space, type } from '@/theme/tokens';

import { Icon, sportIcon } from '../ui/Icon';
import { StatTile } from '../ui/Misc';
import { EmptyState } from '../ui/StateViews';

export function MyCallsList() {
  const predictions = useUserStore((s) => s.predictions);
  const record = summarizeRecord(predictions);
  const sorted = [...predictions].sort((a, b) => (a.status === 'open' ? -1 : 0) - (b.status === 'open' ? -1 : 0) || b.placedAt - a.placedAt);
  return (
    <FlatList
      data={sorted}
      keyExtractor={(p) => p.id}
      ListHeaderComponent={
        <View style={styles.tiles}>
          <StatTile label="Calls made" value={String(record.made)} />
          <StatTile label="Won" value={String(record.won)} />
          <StatTile label="Win rate" value={`${record.winRate}%`} accent />
          <StatTile label="Net Clout" value={`${record.net >= 0 ? '+' : ''}${formatNumber(record.net)}`} />
        </View>
      }
      ListEmptyComponent={<EmptyState icon="flash" title="No Calls yet" body="Pick an event and make the call. Every fan starts with 1,000 free Clout." />}
      renderItem={({ item }) => <PredictionRow p={item} />}
      contentContainerStyle={{ paddingBottom: 60 }}
    />
  );
}

function PredictionRow({ p }: { p: Prediction }) {
  const router = useRouter();
  const now = useNow(30_000);
  const tone = p.status === 'won' ? colors.win : p.status === 'lost' ? colors.live : p.status === 'void' ? colors.textDim : colors.accent;
  const label = p.status === 'open' ? 'Pending' : p.status === 'won' ? `+${formatNumber(p.payout ?? 0)}` : p.status === 'void' ? 'Refunded' : `−${p.stake}`;
  return (
    <Pressable onPress={() => router.push({ pathname: '/event/[id]', params: { id: p.eventId } })} accessibilityRole="button"
      accessibilityLabel={`${p.question} ${p.optionLabel}, ${label}`} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceHigh }]}>
      <View style={styles.icon}><Icon name={sportIcon(p.sportId)} size={18} color={colors.accent} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.event} numberOfLines={1}>{p.eventTitle}</Text>
        <Text style={styles.q} numberOfLines={1}>{p.question}</Text>
        <Text style={styles.pick} numberOfLines={1}>{p.optionLabel} · {p.stake} at {formatMultiplier(p.multiplier)}
          {p.status === 'open' ? ` · to win ${formatNumber(potentialPayout(p.stake, p.multiplier))}` : ''}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Text style={[styles.result, { color: tone }]}>{label}</Text>
        <Text style={styles.ago}>{timeAgo(p.settledAt ?? p.placedAt, now)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, padding: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomWidth: 1, borderColor: colors.line },
  icon: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  event: { ...type.label, color: colors.textDim },
  q: { fontSize: 15, fontWeight: '700', color: colors.text },
  pick: { ...type.label, color: colors.textDim },
  result: { fontSize: 15, fontWeight: '900', fontVariant: ['tabular-nums'] },
  ago: { ...type.label, fontSize: 11, color: colors.loss },
});
