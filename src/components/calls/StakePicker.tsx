import { Pressable, StyleSheet, Text, View } from 'react-native';

import { clampStake } from '@/logic/predictions';
import { STAKE_CHOICES, STAKE_MAX, STAKE_MIN } from '@/logic/rules';
import { colors, radius, space, type } from '@/theme/tokens';

/** Stake chips from 10 to 500 Clout, plus fine-tune buttons. Never allows a value outside the range. */
export function StakePicker({ value, onChange, balance }: { value: number; onChange: (v: number) => void; balance: number }) {
  const set = (v: number) => onChange(clampStake(v));
  return (
    <View style={styles.wrap}>
      <View style={styles.chips}>
        {STAKE_CHOICES.map((c) => {
          const on = value === c;
          const tooMuch = c > balance;
          return (
            <Pressable key={c} onPress={() => set(c)} disabled={tooMuch}
              accessibilityRole="button" accessibilityLabel={`Stake ${c} Clout`} accessibilityState={{ selected: on, disabled: tooMuch }}
              style={[styles.chip, on && styles.chipOn, tooMuch && styles.chipOff]}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{c}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.fine}>
        <Pressable onPress={() => set(value - 10)} disabled={value <= STAKE_MIN} accessibilityRole="button" accessibilityLabel="Decrease stake by 10"
          style={[styles.step, value <= STAKE_MIN && styles.chipOff]}><Text style={styles.stepText}>−10</Text></Pressable>
        <Text style={styles.value} accessibilityLiveRegion="polite">{value} Clout</Text>
        <Pressable onPress={() => set(value + 10)} disabled={value >= STAKE_MAX || value + 10 > balance} accessibilityRole="button"
          accessibilityLabel="Increase stake by 10" style={[styles.step, (value >= STAKE_MAX || value + 10 > balance) && styles.chipOff]}>
          <Text style={styles.stepText}>+10</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { minWidth: 52, height: 44, borderRadius: radius.pill, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.line },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipOff: { opacity: 0.35 },
  chipText: { fontSize: 15, fontWeight: '800', color: colors.text },
  chipTextOn: { color: colors.accentInk },
  fine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  step: { width: 64, height: 44, borderRadius: radius.sm, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  stepText: { ...type.label, color: colors.text, fontSize: 14 },
  value: { fontSize: 18, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
});
