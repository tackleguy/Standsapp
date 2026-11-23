// Football only: the field with the ball spot, the line to gain and the down,
// drawn from the offense's point of view (own goal line on the left).
import { StyleSheet, Text, View } from 'react-native';

import { competitorById, footballSituation } from '@/data/api';
import type { EventState } from '@/data/types';
import { useNow } from '@/hooks/useNow';
import { withAlpha } from '@/lib/color';
import { colors, fonts, space, type } from '@/theme/tokens';

import { CompetitorBadge } from '../Badge';
import { teamColor } from './teamColor';

const MARKS = ['G', '10', '20', '30', '40', '50', '40', '30', '20', '10', 'G'];

export function FieldStrip({ state }: { state: EventState }) {
  const now = useNow(2000);
  if (state.meta.sportId !== 'american_football' || state.status !== 'live') return null;
  const s = footballSituation(state.meta, now);
  if (!s) return null;
  const color = teamColor(s.offenseId);
  const ball = Math.min(100, Math.max(0, s.yardLine));
  const toGain = s.down > 0 ? Math.min(100, ball + s.distance) : null;
  const team = competitorById(s.offenseId);
  return (
    <View style={styles.wrap} accessibilityLabel={`${team?.name ?? ''} ball. ${s.text} at the ${s.spot}.`}>
      <View style={styles.row}>
        <CompetitorBadge id={s.offenseId} size={18} />
        <Text style={styles.team} numberOfLines={1}>{team?.shortName} ball ›</Text>
        <Text style={styles.down}>{s.text}</Text>
        <Text style={styles.spot}>{s.spot}</Text>
      </View>
      <View style={styles.field}>
        <View style={[styles.endzone, { left: 0 }]} />
        <View style={[styles.endzone, { right: 0 }]} />
        {toGain !== null ? (
          <View style={[styles.drive, { left: `${ball}%`, width: `${Math.max(0.5, toGain - ball)}%`, backgroundColor: withAlpha(color, 0.75) }]} />
        ) : null}
        {toGain !== null && toGain < 100 ? <View style={[styles.gainLine, { left: `${toGain}%` }]} /> : null}
        <View style={[styles.ball, { left: `${ball}%`, backgroundColor: color }]} />
      </View>
      <View style={styles.marks}>
        {MARKS.map((m, i) => <Text key={i} style={styles.mark}>{m}</Text>)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.xs, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  team: { ...type.label, color: colors.textDim, flex: 1 },
  down: { fontFamily: fonts.heavy, fontSize: 18, color: colors.text },
  spot: { fontFamily: fonts.bold, fontSize: 15, color: colors.textDim },
  field: { height: 14, borderRadius: 7, backgroundColor: colors.surfaceHigh, justifyContent: 'center' },
  endzone: { position: 'absolute', top: 0, bottom: 0, width: '4%', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 7 },
  drive: { position: 'absolute', top: 3, bottom: 3, borderRadius: 4 },
  gainLine: { position: 'absolute', top: -3, bottom: -3, width: 3, marginLeft: -1.5, backgroundColor: '#FFD43B', borderRadius: 2 },
  ball: { position: 'absolute', width: 16, height: 10, marginLeft: -8, borderRadius: 5, borderWidth: 2, borderColor: '#FFFFFF' },
  marks: { flexDirection: 'row', justifyContent: 'space-between' },
  mark: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textDim, width: 18, textAlign: 'center' },
});
