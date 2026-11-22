// Draws the Stats tab: box scores, race classifications, cricket scorecards, and comparisons.
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { StatsSection } from '@/data/types';
import { colors, radius, space, type } from '@/theme/tokens';

function Table({ section }: { section: Extract<StatsSection, { type: 'table' }> }) {
  const router = useRouter();
  const wide = section.columns.length > 6;
  const firstWide = !['Pos', 'Judge'].includes(section.columns[0]);
  const table = (
    <View style={styles.table}>
      <View style={[styles.tr, styles.thead]}>
        {section.columns.map((c, i) => (
          <Text key={c + i} style={[styles.th, cellStyle(i, firstWide, section.columns[i], wide)]} numberOfLines={1}>{c}</Text>
        ))}
      </View>
      {section.rows.map((row) => {
        const content = row.cells.map((cell, i) => (
          <Text key={i} numberOfLines={1}
            style={[styles.td, cellStyle(i, firstWide, section.columns[i], wide), row.emphasis && styles.emph]}>{cell}</Text>
        ));
        return row.competitorId ? (
          <Pressable key={row.key} style={({ pressed }) => [styles.tr, pressed && styles.pressed]} accessibilityRole="button"
            accessibilityLabel={row.cells.join(', ')}
            onPress={() => router.push({ pathname: '/competitor/[id]', params: { id: row.competitorId as string } })}>
            {content}
          </Pressable>
        ) : <View key={row.key} style={styles.tr}>{content}</View>;
      })}
    </View>
  );
  return (
    <View style={styles.block}>
      <Text style={styles.title}>{section.title}</Text>
      {wide ? <ScrollView horizontal showsHorizontalScrollIndicator={false}>{table}</ScrollView> : table}
    </View>
  );
}

function cellStyle(i: number, firstWide: boolean, column: string, wide: boolean) {
  if (wide) return i === 0 ? { width: 56 } : { width: 34, textAlign: 'center' as const };
  if (column === 'Player' || column === 'Driver' || column === 'Rider' || column === 'Batter' || column === 'Bowler') return { flex: 3 };
  if (i === 0 && firstWide) return { flex: 3 };
  return { flex: 1, textAlign: i === 0 ? ('left' as const) : ('right' as const) };
}

function Compare({ section }: { section: Extract<StatsSection, { type: 'compare' }> }) {
  return (
    <View style={styles.block}>
      <Text style={styles.title}>{section.title}</Text>
      {section.items.map((item) => {
        const total = Math.max(1, item.home + item.away);
        const homeWins = item.home >= item.away;
        return (
          <View key={item.label} style={styles.cmp} accessibilityLabel={`${item.label}: ${item.home} to ${item.away}`}>
            <View style={styles.cmpLabels}>
              <Text style={[styles.cmpVal, homeWins && styles.cmpLead]}>{item.home}{item.suffix ?? ''}</Text>
              <Text style={styles.cmpLabel}>{item.label}</Text>
              <Text style={[styles.cmpVal, !homeWins && styles.cmpLead]}>{item.away}{item.suffix ?? ''}</Text>
            </View>
            <View style={styles.bars}>
              <View style={styles.barHalf}><View style={[styles.bar, styles.barHome, { width: `${(item.home / total) * 100}%` }, homeWins && styles.barLead]} /></View>
              <View style={styles.barHalf}><View style={[styles.bar, { width: `${(item.away / total) * 100}%` }, !homeWins && styles.barLead]} /></View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function StatsView({ sections }: { sections: StatsSection[] }) {
  return (
    <View style={styles.wrap}>
      {sections.map((s, i) => {
        if (s.type === 'table') return <Table key={i} section={s} />;
        if (s.type === 'compare') return <Compare key={i} section={s} />;
        return (
          <View key={i} style={styles.block}>
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.note}>{s.text}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg },
  block: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space.lg, gap: space.sm },
  title: { ...type.label, color: colors.textDim, textTransform: 'uppercase' },
  table: { minWidth: '100%' },
  tr: { flexDirection: 'row', alignItems: 'center', minHeight: 36, borderBottomWidth: 1, borderColor: colors.line, gap: 6 },
  thead: { minHeight: 28 },
  pressed: { backgroundColor: colors.surfaceHigh },
  th: { ...type.label, fontSize: 11, color: colors.textDim },
  td: { fontSize: 14, color: colors.text, fontVariant: ['tabular-nums'] },
  emph: { fontWeight: '800' },
  note: { ...type.body, color: colors.text },
  cmp: { gap: 6, marginTop: 4 },
  cmpLabels: { flexDirection: 'row', alignItems: 'center' },
  cmpVal: { width: 60, fontSize: 15, fontWeight: '700', color: colors.textDim, fontVariant: ['tabular-nums'] },
  cmpLead: { color: colors.text },
  cmpLabel: { flex: 1, textAlign: 'center', ...type.label, color: colors.textDim },
  bars: { flexDirection: 'row', gap: 4 },
  barHalf: { flex: 1, height: 6, backgroundColor: colors.surfaceHigh, borderRadius: 3, overflow: 'hidden' },
  bar: { height: 6, backgroundColor: colors.loss, borderRadius: 3, alignSelf: 'flex-start' },
  barHome: { alignSelf: 'flex-end' },
  barLead: { backgroundColor: colors.accent },
});
