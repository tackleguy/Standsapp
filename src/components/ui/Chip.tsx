import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, space, type } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: IconName;
  count?: number;
  live?: boolean;
}

export function Chip({ label, selected = false, onPress, icon, count, live }: ChipProps) {
  const fg = selected ? colors.accentInk : colors.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}${count ? `, ${count} live` : ''}`}
      style={({ pressed }) => [styles.chip, selected && styles.selected, pressed && styles.pressed]}
    >
      {icon ? <Icon name={icon} size={16} color={fg} /> : null}
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
      {count ? (
        <Text style={[styles.count, live && styles.countLive, selected && styles.countSelected]}>{count}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 40, paddingHorizontal: space.md,
    borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line,
  },
  selected: { backgroundColor: colors.accent, borderColor: colors.accent },
  pressed: { opacity: 0.85 },
  label: { ...type.label, fontSize: 13 },
  count: { ...type.label, fontSize: 11, color: colors.textDim, backgroundColor: colors.surfaceHigh, borderRadius: 8, paddingHorizontal: 5, overflow: 'hidden' },
  countLive: { backgroundColor: colors.live, color: '#FFFFFF' },
  countSelected: { backgroundColor: colors.accentInk, color: colors.accent },
});
