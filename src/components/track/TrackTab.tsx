// The Track tab for motorsport: live map, race status, and a timing tower.
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { competitorById } from '@/data/demo/world';
import { raceSnapshot } from '@/data/demo/engines/race';
import type { EventState } from '@/data/types';
import { useNow } from '@/hooks/useNow';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { formatTime, timeUntil } from '@/lib/format';
import { useUserStore } from '@/store/user';
import { colors, radius, space, type } from '@/theme/tokens';

import { CompetitorBadge } from '../Badge';
import { LiveDot } from '../ui/LiveDot';
import { DemoTag } from '../ui/Misc';
import { TrackMap, teamColors } from './TrackMap';

export function TrackTab({ state, onScroll }: { state: EventState; onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void }) {
  const reduce = useReduceMotion();
  const now = useNow(state.status === 'live' ? (reduce ? 2000 : 200) : 10_000);
  const snapshot = useMemo(() => raceSnapshot(state.meta, now), [state.meta, now]);
  const followedList = useUserStore((s) => s.followedCompetitors);
  const followed = useMemo(() => new Set(followedList), [followedList]);
  const [selected, setSelected] = useState<string | null>(null);
  const sel = snapshot.cars.find((c) => c.competitorId === selected) ?? null;
  const selComp = competitorById(selected);

  const banner = snapshot.phase === 'grid' ? `Cars on the grid · lights out ${timeUntil(state.meta.startsAt + 120_000, now)} (${formatTime(state.meta.startsAt + 120_000)})`
    : snapshot.phase === 'formation' ? 'Formation lap'
      : snapshot.phase === 'finished' ? 'Chequered flag · final classification'
        : `Lap ${snapshot.currentLap} of ${snapshot.laps}${snapshot.safetyCar ? ' · SAFETY CAR' : ''}`;

  return (
    <ScrollView onScroll={onScroll} scrollEventThrottle={32} contentContainerStyle={styles.body}>
      <View style={[styles.banner, snapshot.safetyCar && styles.bannerSc]}>
        {state.status === 'live' ? <LiveDot /> : null}
        <Text style={styles.bannerText}>{banner}</Text>
        <DemoTag compact />
      </View>
      <TrackMap circuit={state.meta.venue} snapshot={snapshot} selectedId={selected} followed={followed}
        onSelect={(id) => setSelected(id === selected ? null : id)} />
      <View style={styles.lapBar}>
        <View style={[styles.lapFill, { width: `${Math.min(100, ((snapshot.phase === 'finished' ? snapshot.laps : snapshot.currentLap - 1) / snapshot.laps) * 100)}%` }]} />
      </View>
      <Text style={styles.venue}>{state.meta.venue} · tap a car or a name to track it</Text>

      {sel && selComp ? (
        <View style={styles.selCard}>
          <CompetitorBadge id={sel.competitorId} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={styles.selName}>P{sel.position} · {selComp.name}</Text>
            <Text style={styles.selSub}>{competitorById(selComp.parentId)?.name ?? ''} · {sel.retired ? 'Retired' : sel.inPit ? 'In the pit lane' : sel.gap}</Text>
          </View>
        </View>
      ) : null}

      <Text style={styles.towerTitle}>Live timing</Text>
      <View style={styles.tower}>
        {snapshot.cars.map((car) => {
          const c = competitorById(car.competitorId);
          const { fill } = teamColors(car.competitorId);
          const on = car.competitorId === selected;
          return (
            <Pressable key={car.competitorId} onPress={() => setSelected(on ? null : car.competitorId)} accessibilityRole="button"
              accessibilityLabel={`Position ${car.position}, ${c?.name}, ${car.retired ? 'retired' : car.gap}`}
              style={[styles.row, on && styles.rowOn, followed.has(car.competitorId) && styles.rowFollowed]}>
              <Text style={styles.pos}>{car.position}</Text>
              <View style={[styles.teamBar, { backgroundColor: fill }]} />
              <Text style={styles.code}>{c?.shortName}</Text>
              <Text style={[styles.name, car.retired && styles.out]} numberOfLines={1}>{c?.name}</Text>
              <Text style={[styles.gap, car.inPit && { color: colors.accent }, car.retired && styles.out]}>
                {car.retired ? 'DNF' : car.inPit ? 'PIT' : car.gap}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.md, paddingBottom: 80 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, minHeight: 40, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  bannerSc: { borderColor: colors.accent, backgroundColor: 'rgba(255,182,39,0.12)' },
  bannerText: { ...type.label, fontSize: 13, color: colors.text, flex: 1 },
  lapBar: { height: 4, borderRadius: 2, backgroundColor: colors.surfaceHigh, overflow: 'hidden' },
  lapFill: { height: 4, backgroundColor: colors.live },
  venue: { ...type.label, color: colors.textDim, textAlign: 'center' },
  selCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: '#FFFFFF' },
  selName: { fontSize: 16, fontWeight: '800', color: colors.text },
  selSub: { ...type.label, color: colors.textDim },
  towerTitle: { ...type.label, color: colors.textDim, textTransform: 'uppercase', marginTop: space.sm },
  tower: { borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44, paddingHorizontal: space.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.line },
  rowOn: { backgroundColor: colors.surfaceHigh },
  rowFollowed: { borderLeftWidth: 3, borderLeftColor: colors.win },
  pos: { width: 24, fontSize: 15, fontWeight: '900', color: colors.text, textAlign: 'center', fontVariant: ['tabular-nums'] },
  teamBar: { width: 4, height: 22, borderRadius: 2 },
  code: { width: 40, fontSize: 14, fontWeight: '900', color: colors.text },
  name: { flex: 1, ...type.label, fontSize: 13, color: colors.textDim },
  gap: { fontSize: 13, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  out: { color: colors.loss },
});
