// One score card for all three sport shapes: head-to-head, race, and innings.
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { crowdLabel } from '@/data/demo/crowd';
import { tagGlyph } from '@/lib/tagGlyph';
import { colors, fonts, radius, space, type } from '@/theme/tokens';

import { Badge } from '../Badge';
import { Icon } from '../ui/Icon';
import { LiveDot } from '../ui/LiveDot';
import { FlashScore } from './FlashScore';

export interface CardEntry {
  competitorId: string;
  name: string;
  shortName: string;
  kind: 'team' | 'athlete';
  colors?: readonly [string, string] | null;
  /** Season record or standing: "12-4", "8-3-2", "P2 · 143 pts". */
  record?: string | null;
  role: 'home' | 'away' | 'entrant';
  score: number | null;
  scoreText: string | null;
  position: number | null;
  isWinner: boolean | null;
  note?: string | null;
}

export interface CardEvent {
  id: string;
  sportId?: string;
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
  /** Fans watching on Stands right now (live, or about to start). */
  watchers?: number | null;
  /** The latest big moment, for live cards. */
  keyPlay?: { clock: string; tag: string | null; text: string; competitorId: string | null } | null;
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

function Status({ event }: { event: CardEvent }) {
  if (event.status === 'live') {
    return (
      <View style={styles.statusLive}>
        <LiveDot size={6} />
        <Text style={styles.statusLiveText} numberOfLines={1}>{statusLabel(event)}</Text>
      </View>
    );
  }
  const warn = event.status === 'postponed' || event.status === 'cancelled';
  return (
    <Text style={[styles.statusText, event.status === 'finished' && styles.statusFinal, warn && { color: colors.accent }]} numberOfLines={1}>
      {event.status === 'finished' ? 'FT' : statusLabel(event)}
    </Text>
  );
}

function ScoreCardImpl({ event, onPress }: { event: CardEvent; onPress: () => void }) {
  const live = event.status === 'live';
  const isRace = event.format === 'race';
  const rows = isRace
    ? [...event.entries].sort((a, b) => (a.position ?? 999) - (b.position ?? 999)).slice(0, 3)
    : [...event.entries].sort((a, b) => (a.role === 'home' ? -1 : 0) - (b.role === 'home' ? -1 : 0));
  const showRaceRows = !isRace || event.status !== 'scheduled';

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
          {isRace ? event.title : event.competitionName ?? ''}
        </Text>
        <Status event={event} />
      </View>

      {isRace && !showRaceRows ? (
        <Text style={styles.raceSoon} numberOfLines={1}>{event.competitionName} · {event.entries.length} on the grid</Text>
      ) : null}

      {rows.length === 0 && <Text style={styles.empty}>Line-up to be announced</Text>}

      {showRaceRows && rows.map((entry) => {
        const dim = event.status === 'finished' && entry.isWinner === false;
        const isText = event.format !== 'head_to_head' || (entry.score === null && entry.scoreText !== null);
        return (
          <View key={entry.competitorId} style={styles.row}>
            {isRace ? <Text style={styles.position}>{entry.position ?? '-'}</Text> : null}
            {isRace
              ? <View style={[styles.livery, { backgroundColor: entry.colors?.[0] ?? colors.line }]} />
              : <Badge name={entry.name} shortName={entry.shortName} kind={entry.kind} size={30} colors={entry.colors} />}
            <View style={styles.nameBox}>
              <Text style={[styles.name, dim && styles.dim, isRace && styles.nameRace]} numberOfLines={1}>{entry.name}</Text>
              {entry.record && event.format === 'head_to_head' ? <Text style={styles.record} numberOfLines={1}>{entry.record}</Text> : null}
            </View>
            {entry.note && live ? <Text style={styles.note}>{entry.note}</Text> : null}
            {event.format === 'head_to_head' && entry.scoreText && entry.score !== null ? (
              <Text style={[styles.subScore, dim && styles.dim]}>{entry.scoreText}</Text>
            ) : null}
            {event.status === 'scheduled' && !isRace ? null : (
              <FlashScore
                value={isRace ? entry.scoreText ?? '' : scoreOf(entry, event.format)}
                style={[isText ? styles.scoreText : styles.score, dim && styles.dim, entry.isWinner && styles.winner]}
              />
            )}
          </View>
        );
      })}

      {live && typeof event.progress === 'number' ? (
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.round(event.progress * 100)}%` }]} /></View>
      ) : null}

      {live ? (
        <View style={styles.footer}>
          {event.watchers ? (
            <View style={styles.watch}>
              <Icon name="eye" size={13} color={colors.textDim} />
              <Text style={styles.watchText}>{crowdLabel(event.watchers)}</Text>
            </View>
          ) : null}
          {event.keyPlay ? (
            <Text style={styles.keyPlay} numberOfLines={1}>
              {tagGlyph(event.keyPlay.tag)} <Text style={styles.keyClock}>{event.keyPlay.clock}</Text> {event.keyPlay.text}
            </Text>
          ) : null}
        </View>
      ) : event.status === 'scheduled' && event.watchers ? (
        <View style={styles.footer}>
          <View style={styles.watch}>
            <Icon name="people" size={13} color={colors.textDim} />
            <Text style={styles.watchText}>{crowdLabel(event.watchers)} here early</Text>
          </View>
        </View>
      ) : event.status === 'finished' && event.resultText ? (
        <Text style={styles.result} numberOfLines={1}>{event.resultText}</Text>
      ) : null}
    </Pressable>
  );
}

export const ScoreCard = memo(ScoreCardImpl);

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: space.md,
    marginHorizontal: space.lg, marginBottom: space.sm, borderWidth: 1, borderColor: colors.line },
  cardLive: { borderColor: 'rgba(255,77,94,0.32)' },
  pressed: { backgroundColor: colors.surfaceHigh },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: 4 },
  competition: { fontFamily: fonts.bold, fontSize: 13, letterSpacing: 0.9, color: colors.textDim, flex: 1, textTransform: 'uppercase' },
  statusLive: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 200 },
  statusLiveText: { fontFamily: fonts.heavy, fontSize: 15, color: colors.live, letterSpacing: 0.3, fontVariant: ['tabular-nums'] },
  statusText: { fontFamily: fonts.bold, fontSize: 15, color: colors.textDim, fontVariant: ['tabular-nums'], maxWidth: 200 },
  statusFinal: { color: colors.text },
  raceSoon: { ...type.label, color: colors.textDim, paddingVertical: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 42 },
  position: { fontFamily: fonts.heavy, fontSize: 16, color: colors.textDim, width: 16, textAlign: 'center' },
  livery: { width: 4, height: 22, borderRadius: 2 },
  nameBox: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text, flexShrink: 1 },
  nameRace: { fontSize: 15, fontWeight: '600' },
  record: { fontFamily: fonts.semibold, fontSize: 13, color: colors.loss, fontVariant: ['tabular-nums'] },
  note: { fontFamily: fonts.bold, fontSize: 12, color: colors.accent, letterSpacing: 0.5, textTransform: 'uppercase' },
  subScore: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textDim, fontVariant: ['tabular-nums'] },
  score: { ...type.score, fontSize: 28, color: colors.text, minWidth: 28, textAlign: 'right' },
  scoreText: { fontFamily: fonts.bold, fontSize: 17, color: colors.text, fontVariant: ['tabular-nums'] },
  winner: { color: colors.text },
  dim: { color: colors.loss },
  empty: { ...type.body, color: colors.textDim },
  progressTrack: { height: 2, borderRadius: 1, backgroundColor: colors.surfaceHigh, marginTop: space.sm, overflow: 'hidden' },
  progressFill: { height: 2, backgroundColor: colors.live },
  footer: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm },
  watch: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  watchText: { fontFamily: fonts.bold, fontSize: 13, color: colors.textDim, fontVariant: ['tabular-nums'] },
  keyPlay: { flex: 1, fontSize: 13, color: colors.textDim },
  keyClock: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  result: { fontSize: 13, fontWeight: '600', color: colors.textDim, marginTop: space.xs },
});
