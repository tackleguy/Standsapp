// One score card for all three sport shapes: head-to-head, race, and innings.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, space, type } from '@/theme/tokens';

import { Badge } from '../Badge';
import { Icon } from '../ui/Icon';
import { StatusPill } from '../ui/LiveDot';
import { FlashScore } from './FlashScore';

export interface CardEntry {
  competitorId: string;
  name: string;
  shortName: string;
  kind: 'team' | 'athlete';
  colors?: readonly [string, string] | null;
  role: 'home' | 'away' | 'entrant';
  score: number | null;
  scoreText: string | null;
  position: number | null;
  isWinner: boolean | null;
  note?: string | null;
}

export interface CardEvent {
  id: string;
  title: string;
  format: 'head_to_head' | 'race' | 'innings';
  status: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';
  startsAt: string;
  periodLabel: string | null;
  competitionName: string | null;
  entries: CardEntry[];
  isDemo?: boolean;
  followed?: boolean;
  sportName?: string;
  resultText?: string | null;
  progress?: number;
}

export function statusLabel(e: Pick<CardEvent, 'status' | 'periodLabel' | 'startsAt'>): string {
  if (e.status === 'live') return e.periodLabel ?? 'LIVE';
  if (e.status === 'finished') return 'Final';
  if (e.status === 'postponed') return 'Postponed';
  if (e.status === 'cancelled') return 'Cancelled';
  return new Date(e.startsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function scoreOf(entry: CardEntry, format: CardEvent['format']): string {
  if (format === 'innings') return entry.scoreText ?? '-';
  if (entry.score === null) return entry.scoreText ?? '-';
  return String(entry.score);
}

export function ScoreCard({ event, onPress }: { event: CardEvent; onPress: () => void }) {
  const live = event.status === 'live';
  const rows = event.format === 'race'
    ? [...event.entries].sort((a, b) => (a.position ?? 999) - (b.position ?? 999)).slice(0, 3)
    : [...event.entries].sort((a, b) => (a.role === 'home' ? -1 : 0) - (b.role === 'home' ? -1 : 0));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${statusLabel(event)}`}
      style={({ pressed }) => [styles.card, live && styles.cardLive, pressed && styles.pressed]}
    >
      <View style={styles.header}>
        {event.followed ? <Icon name="star" size={12} color={colors.accent} /> : null}
        <Text style={styles.competition} numberOfLines={1}>
          {event.format === 'race' ? event.title : event.competitionName ?? ''}
        </Text>
        <StatusPill label={statusLabel(event)} live={live} tone={event.status === 'finished' ? 'final' : event.status === 'postponed' || event.status === 'cancelled' ? 'warn' : 'default'} />
      </View>

      {rows.length === 0 && <Text style={styles.empty}>Line-up to be announced</Text>}

      {rows.map((entry) => {
        const dim = event.status === 'finished' && entry.isWinner === false;
        const isText = event.format !== 'head_to_head' || (entry.score === null && entry.scoreText !== null);
        return (
          <View key={entry.competitorId} style={styles.row}>
            {event.format === 'race' && <Text style={styles.position}>{entry.position ?? '-'}</Text>}
            <Badge name={entry.name} shortName={entry.shortName} kind={entry.kind} size={28} colors={entry.colors} />
            <Text style={[styles.name, dim && styles.dim, entry.isWinner && styles.winner]} numberOfLines={1}>{entry.name}</Text>
            {entry.note && event.status === 'live' ? <Text style={styles.note}>{entry.note}</Text> : null}
            {event.format === 'head_to_head' && entry.scoreText && entry.score !== null ? (
              <Text style={[styles.subScore, dim && styles.dim]}>{entry.scoreText}</Text>
            ) : null}
            <FlashScore
              value={event.format === 'race' ? entry.scoreText ?? '' : scoreOf(entry, event.format)}
              style={[isText ? styles.scoreText : styles.score, dim && styles.dim]}
            />
          </View>
        );
      })}
      {live && typeof event.progress === 'number' ? (
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.round(event.progress * 100)}%` }]} /></View>
      ) : null}
      {event.status === 'finished' && event.resultText ? <Text style={styles.result} numberOfLines={1}>{event.resultText}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.lg,
    marginHorizontal: space.lg, marginBottom: space.md, borderWidth: 1, borderColor: colors.line },
  cardLive: { borderColor: 'rgba(255,77,94,0.35)' },
  pressed: { backgroundColor: colors.surfaceHigh },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.sm },
  competition: { ...type.label, color: colors.textDim, flex: 1, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 },
  position: { ...type.label, color: colors.textDim, width: 18, textAlign: 'center' },
  name: { ...type.title, fontSize: 17, color: colors.text, flex: 1 },
  winner: { color: colors.text },
  note: { ...type.label, fontSize: 10, color: colors.accent },
  subScore: { ...type.label, color: colors.textDim, fontVariant: ['tabular-nums'] },
  score: { ...type.score, fontSize: 26, color: colors.text },
  scoreText: { ...type.body, color: colors.text, fontVariant: ['tabular-nums'], fontWeight: '700' },
  dim: { color: colors.loss },
  empty: { ...type.body, color: colors.textDim },
  progressTrack: { height: 3, borderRadius: 2, backgroundColor: colors.surfaceHigh, marginTop: space.sm, overflow: 'hidden' },
  progressFill: { height: 3, backgroundColor: colors.live },
  result: { ...type.label, color: colors.textDim, marginTop: space.sm },
});
