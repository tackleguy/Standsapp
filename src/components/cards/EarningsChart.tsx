// Tix your cards earned on each of the last seven days: one bar per day.
// One series, so no legend: the title names it. Today is full amber, earlier days
// softer. Labels sit on the best day and today only; tap any bar to read its value.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { withAlpha } from '@/lib/color';
import { formatNumber } from '@/lib/format';
import { colors, fonts, space, type } from '@/theme/tokens';

const HEIGHT = 120;

export function EarningsChart({ days }: { days: { day: number; total: number }[] }) {
  const [picked, setPicked] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.total));
  const best = days.reduce((b, d, i) => (d.total > days[b].total ? i : b), 0);
  const last = days.length - 1;
  const empty = days.every((d) => d.total === 0);
  const dayName = (ms: number, i: number) => (i === last ? 'Today' : new Date(ms).toLocaleDateString([], { weekday: 'short', timeZone: 'UTC' }));

  return (
    <View>
      <View style={styles.plot} accessibilityRole="summary"
        accessibilityLabel={`Tix earned per day: ${days.map((d, i) => `${dayName(d.day, i)} ${d.total}`).join(', ')}`}>
        <View style={styles.baseline} />
        {days.map((d, i) => {
          const h = d.total > 0 ? Math.max(4, Math.round((d.total / max) * (HEIGHT - 22))) : 0;
          const showLabel = picked === i || (picked === null && d.total > 0 && (i === best || i === last));
          return (
            <Pressable key={d.day} onPress={() => setPicked(picked === i ? null : i)} style={styles.slot}
              accessibilityRole="button" accessibilityLabel={`${dayName(d.day, i)}: ${d.total} Tix`} hitSlop={4}>
              {showLabel ? <Text style={styles.value}>+{formatNumber(d.total)}</Text> : null}
              <View style={[styles.bar, { height: h, backgroundColor: i === last ? colors.accent : withAlpha(colors.accent, 0.5) },
                picked === i && styles.barPicked]} />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.axis}>
        {days.map((d, i) => (
          <Text key={d.day} style={[styles.tick, i === last && { color: colors.text }]} numberOfLines={1}>{dayName(d.day, i)}</Text>
        ))}
      </View>
      {empty ? <Text style={styles.empty}>No card earnings in the last 7 days yet.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  plot: { height: HEIGHT, flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingHorizontal: 2 },
  baseline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, backgroundColor: colors.line },
  slot: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '62%', maxWidth: 28, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barPicked: { borderWidth: 1, borderColor: colors.text },
  value: { fontFamily: fonts.bold, fontSize: 13, color: colors.text, marginBottom: 3, fontVariant: ['tabular-nums'] },
  axis: { flexDirection: 'row', gap: 6, paddingHorizontal: 2, marginTop: space.xs },
  tick: { flex: 1, textAlign: 'center', ...type.label, fontSize: 10, color: colors.textDim },
  empty: { ...type.label, color: colors.textDim, textAlign: 'center', marginTop: space.sm },
});
