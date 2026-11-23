// Three quick-read tiles above the feed. Football: the offense's personnel
// grouping, run rate and success rate. Other sports: the first team stats.
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { competitorById, footballTeamNumbers } from '@/data/api';
import type { EventState } from '@/data/types';
import { colors, fonts, radius, space, type } from '@/theme/tokens';

import { CompetitorBadge } from '../Badge';

interface Tile { badge: string | null; value: string; label: string; sub: string; accent?: boolean }

const PERSONNEL_TEXT: Record<string, string> = {
  '11': '1RB · 1TE · 3WR', '12': '1RB · 2TE · 2WR', '13': '1RB · 3TE · 1WR', '21': '2RB · 1TE · 2WR', '22': '2RB · 2TE · 1WR',
};

function footballTiles(state: EventState, now: number): Tile[] | null {
  const last = [...state.plays].reverse().find((p) => p.football && p.football.personnel);
  if (!last?.football) return null;
  const offenseId = last.football.offenseId;
  const side = state.meta.competitorIds.indexOf(offenseId);
  const t = footballTeamNumbers(state.meta, now)[side === 1 ? 1 : 0];
  const plays = t.runs + t.passes;
  const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '–');
  const personnel = last.football.personnel ?? '11';
  return [
    { badge: offenseId, value: personnel, label: 'PERSONNEL', sub: PERSONNEL_TEXT[personnel] ?? '' },
    { badge: offenseId, value: pct(t.runs, plays), label: 'RUN%', sub: 'this game' },
    { badge: offenseId, value: pct(t.successes, t.plays), label: 'SUCCESS%', sub: 'this game', accent: true },
  ];
}

function genericTiles(state: EventState): Tile[] | null {
  const compare = state.stats.find((s) => s.type === 'compare');
  if (!compare || compare.type !== 'compare' || state.meta.competitorIds.length !== 2) return null;
  const [h, a] = state.meta.competitorIds.map((id) => competitorById(id)?.shortName ?? '');
  return compare.items.slice(0, 3).map((it) => ({
    badge: null,
    value: `${it.home}${it.suffix ?? ''} – ${it.away}${it.suffix ?? ''}`,
    label: it.label.toUpperCase(),
    sub: `${h} v ${a}`,
  }));
}

export function FeedTiles({ state, now }: { state: EventState; now: number }) {
  const tiles = useMemo(() => (state.meta.sportId === 'american_football' ? footballTiles(state, now) : genericTiles(state)),
    [state, now]);
  if (!tiles || tiles.length === 0 || state.status === 'scheduled') return null;
  return (
    <View style={styles.row}>
      {tiles.map((t) => (
        <View key={t.label} style={styles.tile} accessibilityLabel={`${t.label}: ${t.value}. ${t.sub}`}>
          <View style={styles.top}>
            {t.badge ? <CompetitorBadge id={t.badge} size={16} /> : null}
            <Text style={[styles.value, t.accent && { color: colors.win }]} numberOfLines={1} adjustsFontSizeToFit>{t.value}</Text>
          </View>
          <Text style={styles.label} numberOfLines={1}>{t.label}</Text>
          <Text style={styles.sub} numberOfLines={1}>{t.sub}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  tile: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, padding: space.sm, gap: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  value: { fontFamily: fonts.heavy, fontSize: 22, color: colors.text, flexShrink: 1, textAlign: 'right' },
  label: { ...type.label, fontSize: 10, color: colors.textDim, textAlign: 'right' },
  sub: { ...type.label, fontSize: 10, color: colors.accent, textAlign: 'right' },
});
