// The back of a Stand Card: the facts and recent form, like the stats on a real card.
import { StyleSheet, Text, View } from 'react-native';

import { sportById } from '@/config/sports';
import { competitorById, getWorld } from '@/data/api';
import { SEASON, setMembers } from '@/data/demo/cards';
import type { OwnedCard } from '@/data/types';
import { useCompetitor } from '@/hooks/useLiveData';
import { clamp, formatTime } from '@/lib/format';
import { rarityLabel } from '@/logic/cards';
import { colors, radius, space, type } from '@/theme/tokens';

import { CompetitorBadge } from '../Badge';
import { serialText } from './StandCard';

export function CardBack({ card, width }: { card: OwnedCard; width: number }) {
  const c = competitorById(card.competitorId);
  const page = useCompetitor(card.competitorId);
  const frame = colors.rarity[card.rarity];
  const scale = width / 150;
  const sport = c ? sportById(c.sportId) : undefined;
  const team = c?.parentId ? competitorById(c.parentId) : undefined;
  const league = c ? getWorld().competitionById.get(c.competitionId) : undefined;
  const members = c ? setMembers(c.sportId) : [];
  const number = members.findIndex((m) => m.id === card.competitorId) + 1;
  const record = page.data?.record;
  const next = page.data?.upcoming[0];
  const rows: [string, string][] = [
    [c?.kind === 'team' ? 'Home' : 'From', c?.home ?? '–'],
    ...(team ? [['Team', team.name] as [string, string]] : []),
    ['League', (league?.name ?? '–').replace(/^Demo /, '')],
    ['Form', record ? (record.played ? `${record.won} of ${record.played} won` : 'No games') : '…'],
    ['Next', next ? `${new Date(next.meta.startsAt).toLocaleDateString([], { weekday: 'short' })} ${formatTime(next.meta.startsAt)}` : 'Nothing soon'],
  ];
  const fs = clamp(8 * scale, 9, 12);
  return (
    <View style={[styles.card, { width, height: width * 1.4, borderColor: frame }]} accessibilityLabel={`Back of the ${c?.name ?? ''} card`}>
      <View style={[styles.band, { backgroundColor: frame }]}>
        <Text style={[styles.bandText, { fontSize: fs }]} numberOfLines={1}>
          {rarityLabel(card.rarity).toUpperCase()}{card.finish === 'holo' ? ' HOLO' : ''}{card.eventId ? ' · GAME DAY' : ''}
        </Text>
        <Text style={[styles.bandText, { fontSize: fs }]}>{serialText(card.serial, card.rarity, card.finish, !!card.eventId)}</Text>
      </View>
      <View style={styles.head}>
        <CompetitorBadge id={card.competitorId} size={34 * scale} />
        <Text style={[styles.name, { fontSize: clamp(13 * scale, 12, 19) }]} numberOfLines={2}>{c?.name ?? 'Unknown'}</Text>
      </View>
      <View style={styles.rows}>
        {rows.map(([k, v]) => (
          <View key={k} style={styles.row}>
            <Text style={[styles.key, { fontSize: fs }]}>{k}</Text>
            <Text style={[styles.value, { fontSize: fs }]} numberOfLines={1}>{v}</Text>
          </View>
        ))}
      </View>
      <Text style={[styles.foot, { fontSize: clamp(7 * scale, 9, 11) }]}>
        Stands {SEASON} · {sport?.name} set · card {number > 0 ? number : '?'} of {members.length}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, borderWidth: 2, backgroundColor: colors.surface, overflow: 'hidden', justifyContent: 'space-between' },
  band: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.sm, paddingVertical: 4, gap: space.sm },
  bandText: { fontWeight: '900', color: colors.accentInk, letterSpacing: 0.6, fontVariant: ['tabular-nums'] },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.sm },
  name: { flex: 1, fontWeight: '900', color: colors.text },
  rows: { paddingHorizontal: space.sm, gap: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm, borderBottomWidth: 1, borderColor: colors.line, paddingVertical: 3 },
  key: { ...type.label, color: colors.textDim },
  value: { fontWeight: '700', color: colors.text, flexShrink: 1, textAlign: 'right' },
  foot: { ...type.label, color: colors.textDim, textAlign: 'center', paddingBottom: space.sm },
});
