// The players in an event (one side, or the whole field) with their live
// fantasy points. Tap a player for their Performance page.
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { competitorById } from '@/data/api';
import { eventLeaders, sportStats } from '@/data/playerApi';
import type { EventState } from '@/data/types';
import { useNow } from '@/hooks/useNow';
import { fantasyTix, formatPoints } from '@/logic/fantasy';
import { useUserStore } from '@/store/user';
import { colors, fonts, radius, space, type } from '@/theme/tokens';

import { CompetitorBadge } from '../Badge';
import { PlayerAvatar } from '../players/PlayerAvatar';
import { EmptyState } from '../ui/StateViews';

export function PlayersTab({ state, sideId, onScroll }: {
  state: EventState; sideId: string | null; onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}) {
  const router = useRouter();
  const now = useNow(3000);
  const owned = useUserStore((s) => s.cards);
  const mine = useMemo(() => new Set(owned.filter((c) => c.kind === 'player').map((c) => c.playerId)), [owned]);
  const rows = useMemo(() => {
    const all = eventLeaders(state.meta, Math.min(now, state.endsAt));
    return sideId ? all.filter((r) => r.player.sideId === sideId) : all;
  }, [state.meta, state.endsAt, now, sideId]);
  const def = sportStats(state.meta.sportId);
  const team = sideId ? competitorById(sideId) : null;
  if (state.status === 'scheduled') {
    return <EmptyState icon="people" title="Line-ups are in" body="Live stats and fantasy points appear once it starts." />;
  }
  return (
    <ScrollView onScroll={onScroll} scrollEventThrottle={32} contentContainerStyle={styles.body}>
      <View style={styles.head}>
        {team ? <CompetitorBadge id={team.id} size={22} /> : null}
        <Text style={styles.title}>{team ? team.name : 'Every player'}</Text>
        <Text style={styles.headPts}>FPS</Text>
      </View>
      {rows.map((r, i) => (
        <Pressable key={r.player.id} onPress={() => router.push({ pathname: '/player/[id]', params: { id: r.player.id, event: state.meta.id } })}
          accessibilityRole="button" accessibilityLabel={`${r.player.name}, ${r.player.posLabel}, ${formatPoints(r.points)} fantasy points`}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}>
          <Text style={styles.rank}>{i + 1}</Text>
          <PlayerAvatar playerId={r.player.id} size={38} badge={!sideId} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>
              {r.player.short}{mine.has(r.player.id) ? ' 🎴' : ''} <Text style={styles.pos}>{r.player.pos}</Text>
            </Text>
            <Text style={styles.line} numberOfLines={1}>{Object.keys(r.line).length ? def.headline(r.line, r.player.pos) : 'No stats yet'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.pts, r.points <= 0 && { color: colors.textDim }]}>{formatPoints(r.points)}</Text>
            <Text style={styles.tix}>{fantasyTix(r.points)} Tix</Text>
          </View>
        </Pressable>
      ))}
      <Text style={styles.foot}>A player card earns its player's fantasy points, rounded, in Tix after every game. 🎴 = you own the card.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.sm, paddingBottom: 60 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.xs },
  title: { ...type.title, color: colors.text, flex: 1 },
  headPts: { ...type.label, color: colors.textDim },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm, borderRadius: radius.md, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.line, minHeight: 56 },
  rank: { fontFamily: fonts.bold, fontSize: 14, color: colors.textDim, width: 20, textAlign: 'center' },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  pos: { ...type.label, color: colors.textDim },
  line: { ...type.label, color: colors.textDim, marginTop: 2, fontWeight: '500' },
  pts: { fontFamily: fonts.heavy, fontSize: 20, color: colors.win },
  tix: { ...type.label, fontSize: 10, color: colors.textDim },
  foot: { ...type.label, color: colors.textDim, lineHeight: 17, fontWeight: '500', marginTop: space.sm },
});
