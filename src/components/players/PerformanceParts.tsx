// Pieces of the player Performance page: the stat grid, the rating breakdown
// chart and the compact play rows.
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { GridCell, StatLine } from '@/data/playerApi';
import type { EventState, Play } from '@/data/types';
import { formatPoints } from '@/logic/fantasy';
import { colors, fonts, radius, space, type } from '@/theme/tokens';

import { Icon } from '../ui/Icon';
import { clockAndDown, scoreWithTeams } from './playText';

/** Rows of stats: value on top, label underneath, like a box score. */
export function StatGrid({ rows, line, points }: { rows: GridCell[][]; line: StatLine; points: number }) {
  return (
    <View style={styles.grid}>
      {rows.map((row, i) => (
        <View key={i} style={styles.gridRow}>
          {row.map((c) => (
            <View key={c.label} style={styles.gridCell}>
              <Text style={styles.gridValue} numberOfLines={1} adjustsFontSizeToFit>{c.value(line)}</Text>
              <Text style={styles.gridLabel} numberOfLines={1}>{c.label}</Text>
            </View>
          ))}
        </View>
      ))}
      <View style={styles.gridRow}>
        <View style={styles.gridCell}>
          <Text style={[styles.gridValue, { color: colors.win }]}>{formatPoints(points)}</Text>
          <Text style={styles.gridLabel}>FPS</Text>
        </View>
      </View>
    </View>
  );
}

/** One bar per period; the best period is highlighted. */
export function RatingChart({ labels, values }: { labels: string[]; values: number[] }) {
  const max = Math.max(1, ...values);
  const best = values.indexOf(Math.max(...values));
  return (
    <View style={styles.chart} accessibilityLabel={`Rating by period: ${labels.map((l, i) => `${l} ${values[i]?.toFixed(2) ?? 0}`).join(', ')}`}>
      {labels.map((label, i) => {
        const v = values[i] ?? 0;
        const h = Math.max(4, Math.round((v / max) * 110));
        return (
          <View key={`${label}-${i}`} style={styles.barCol}>
            <Text style={[styles.barValue, i === best && v > 0 && { color: colors.text }]}>{v.toFixed(2)}</Text>
            <View style={[styles.bar, { height: h, opacity: i === best && v > 0 ? 1 : 0.55 }]} />
            <Text style={styles.barLabel} numberOfLines={1}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** A compact play row: score and situation, the headline and the play's rating. */
function PlayMiniImpl({ play, state, scoreBefore, onPress }: { play: Play; state: EventState; scoreBefore?: string; onPress?: () => void }) {
  const score = scoreWithTeams(state, scoreBefore);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${play.headline ?? play.description}, ${play.clock}`}
      style={({ pressed }) => [styles.play, pressed && { opacity: 0.85 }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.playMeta} numberOfLines={1}>{[score, clockAndDown(play)].filter(Boolean).join(' · ')}</Text>
        <Text style={styles.playTitle} numberOfLines={1}>{play.headline ?? play.description}</Text>
        {play.headline ? <Text style={styles.playDesc} numberOfLines={2}>{play.description}</Text> : null}
      </View>
      {play.impact !== undefined ? <Impact value={play.impact} /> : null}
    </Pressable>
  );
}

export const PlayMini = memo(PlayMiniImpl);

/** The play rating chip: a bolt and a number. */
export function Impact({ value, big }: { value: number; big?: boolean }) {
  return (
    <View style={styles.impact} accessibilityLabel={`Rating ${value.toFixed(1)}`}>
      <Icon name="flash" size={big ? 16 : 12} color={colors.accent} />
      <Text style={[styles.impactText, big && { fontSize: 20 }]}>{value.toFixed(1)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: space.md },
  gridRow: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.sm },
  gridCell: { minWidth: '14.28%', flexGrow: 1, alignItems: 'center', paddingHorizontal: 2 },
  gridValue: { fontFamily: fonts.heavy, fontSize: 22, color: colors.text, fontVariant: ['tabular-nums'] },
  gridLabel: { ...type.label, fontSize: 10, color: colors.textDim, marginTop: 1 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, height: 160, paddingTop: space.sm },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  barValue: { fontFamily: fonts.bold, fontSize: 13, color: colors.textDim, fontVariant: ['tabular-nums'] },
  bar: { width: '100%', maxWidth: 64, borderTopLeftRadius: radius.sm, borderTopRightRadius: radius.sm, backgroundColor: colors.win },
  barLabel: { ...type.label, color: colors.textDim },
  play: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: 1, borderColor: colors.line },
  playMeta: { ...type.label, fontSize: 11, color: colors.textDim },
  playTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  playDesc: { fontSize: 13, color: colors.textDim, lineHeight: 18 },
  impact: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  impactText: { fontFamily: fonts.heavy, fontSize: 16, color: colors.text, fontVariant: ['tabular-nums'] },
});
