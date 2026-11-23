// The big live scoreboard at the top of an event. Shrinks once you scroll.
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { sportById } from '@/config/sports';
import { competitorById, getWorld } from '@/data/api';
import type { EntryState, EventState } from '@/data/types';
import { useNow } from '@/hooks/useNow';
import { formatDay, formatTime, timeUntil } from '@/lib/format';
import { colors, radius, space, type } from '@/theme/tokens';

import { CompetitorBadge } from '../Badge';
import { Icon, sportIcon } from '../ui/Icon';
import { StatusPill } from '../ui/LiveDot';
import { statusLabel } from './ScoreCard';
import { FlashScore } from './FlashScore';

function Side({ entry, align, compact, format, finished }: {
  entry: EntryState; align: 'left' | 'right'; compact: boolean; format: EventState['meta']['format']; finished: boolean;
}) {
  const router = useRouter();
  const c = competitorById(entry.competitorId);
  const dim = finished && entry.isWinner === false;
  return (
    <Pressable onPress={() => router.push({ pathname: '/competitor/[id]', params: { id: entry.competitorId } })}
      accessibilityRole="button" accessibilityLabel={`Open ${c?.name ?? 'team'}`}
      style={[styles.side, align === 'right' && styles.sideRight]}>
      <CompetitorBadge id={entry.competitorId} size={compact ? 30 : 52} />
      {!compact && <Text style={[styles.sideName, dim && styles.dim]} numberOfLines={2}>{c?.name}</Text>}
      {compact && <Text style={[styles.sideShort, dim && styles.dim]}>{c?.shortName}</Text>}
      {entry.note && !finished ? <Text style={styles.note}>{entry.note}</Text> : null}
      {format === 'innings' && entry.scoreText ? <Text style={[styles.inningsText, dim && styles.dim]}>{entry.scoreText}</Text> : null}
    </Pressable>
  );
}

export function EventHeader({ state, compact = false }: { state: EventState; compact?: boolean }) {
  const now = useNow(30_000);
  const { meta } = state;
  const sport = sportById(meta.sportId);
  const comp = getWorld().competitionById.get(meta.competitionId);
  const live = state.status === 'live';
  const finished = state.status === 'finished';
  const label = statusLabel({ status: state.status, periodLabel: state.periodLabel, startsAt: new Date(meta.startsAt).toISOString() });
  const isRace = meta.format === 'race';
  const home = state.entries.find((e) => e.role === 'home');
  const away = state.entries.find((e) => e.role === 'away');
  const bigScore = (e?: EntryState) => (e?.score === null || e?.score === undefined ? (state.status === 'scheduled' ? '' : e?.scoreText ?? '–') : String(e.score));

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      {!compact && (
        <View style={styles.topRow}>
          <Icon name={sportIcon(meta.sportId)} size={14} color={colors.textDim} />
          <Text style={styles.comp} numberOfLines={1}>{sport?.name} · {comp?.name}</Text>
        </View>
      )}
      {isRace ? (
        <View style={styles.raceBlock}>
          <Text style={[styles.raceTitle, compact && { fontSize: 18 }]} numberOfLines={1}>{meta.title}</Text>
          {!compact && <Text style={styles.venue}>{meta.venue}</Text>}
          <View style={styles.podium}>
            {[...state.entries].sort((a, b) => (a.position ?? 99) - (b.position ?? 99)).slice(0, 3).map((e, i) => (
              <View key={e.competitorId} style={styles.podiumItem}>
                <Text style={styles.podiumPos}>P{i + 1}</Text>
                <CompetitorBadge id={e.competitorId} size={compact ? 22 : 28} />
                <Text style={styles.podiumName} numberOfLines={1}>{competitorById(e.competitorId)?.shortName}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : home && away ? (
        <View style={styles.scoreRow}>
          <Side entry={home} align="left" compact={compact} format={meta.format} finished={finished} />
          <View style={styles.center}>
            {meta.format === 'head_to_head' && state.status !== 'scheduled' ? (
              <View style={styles.scores}>
                <FlashScore value={bigScore(home)} style={[styles.big, compact && styles.bigCompact, finished && home.isWinner === false && styles.dim]} />
                <Text style={[styles.dash, compact && { fontSize: 20 }]}>–</Text>
                <FlashScore value={bigScore(away)} style={[styles.big, compact && styles.bigCompact, finished && away.isWinner === false && styles.dim]} />
              </View>
            ) : state.status === 'scheduled' ? (
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.kickoff}>{formatTime(meta.startsAt)}</Text>
                {!compact && <Text style={styles.until}>{formatDay(meta.startsAt)} · {timeUntil(meta.startsAt, now)}</Text>}
              </View>
            ) : <Text style={styles.vs}>v</Text>}
            {meta.format === 'head_to_head' && (home.scoreText || away.scoreText) && state.status !== 'scheduled' && !compact ? (
              <Text style={styles.sub}>{home.scoreText ?? ''}  ·  {away.scoreText ?? ''}</Text>
            ) : null}
          </View>
          <Side entry={away} align="right" compact={compact} format={meta.format} finished={finished} />
        </View>
      ) : null}
      <View style={styles.statusRow}>
        <StatusPill label={label} live={live} tone={finished ? 'final' : state.status === 'scheduled' ? 'default' : 'warn'} />
        {finished && state.resultText && !compact ? <Text style={styles.result} numberOfLines={1}>{state.resultText}</Text> : null}
      </View>
      {live ? <View style={styles.track}><View style={[styles.fill, { width: `${Math.round(state.progress * 100)}%` }]} /></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.line, paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm },
  wrapCompact: { paddingVertical: space.sm, gap: 4 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  comp: { ...type.label, color: colors.textDim, textTransform: 'uppercase', flex: 1 },
  scoreRow: { flexDirection: 'row', alignItems: 'center' },
  side: { flex: 1, alignItems: 'center', gap: 6 },
  sideRight: {},
  sideName: { ...type.label, fontSize: 14, color: colors.text, textAlign: 'center' },
  sideShort: { ...type.label, color: colors.text },
  note: { ...type.label, fontSize: 10, color: colors.accent },
  inningsText: { fontSize: 15, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  center: { alignItems: 'center', minWidth: 120 },
  scores: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  big: { ...type.score, fontSize: 44, color: colors.text },
  bigCompact: { fontSize: 26 },
  dash: { fontSize: 30, color: colors.textDim, fontWeight: '300' },
  vs: { fontSize: 22, color: colors.textDim, fontWeight: '700' },
  kickoff: { fontSize: 26, fontWeight: '800', color: colors.text },
  until: { ...type.label, color: colors.textDim, marginTop: 2 },
  sub: { ...type.label, color: colors.textDim, marginTop: 2 },
  dim: { color: colors.loss },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  result: { ...type.label, color: colors.text, flexShrink: 1 },
  track: { height: 3, backgroundColor: colors.surfaceHigh, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: 3, backgroundColor: colors.live },
  raceBlock: { alignItems: 'center', gap: 4 },
  raceTitle: { fontSize: 22, fontWeight: '900', color: colors.text },
  venue: { ...type.label, color: colors.textDim },
  podium: { flexDirection: 'row', gap: space.lg, marginTop: 4 },
  podiumItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  podiumPos: { ...type.label, color: colors.accent },
  podiumName: { ...type.label, color: colors.text },
});
