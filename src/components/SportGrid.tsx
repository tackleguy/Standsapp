// A grid of every sport with its icon, for choosing what to follow.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SPORTS } from '@/config/sports';
import { colors, radius, space, type } from '@/theme/tokens';

import { Icon, sportIcon } from './ui/Icon';

export function SportGrid({ selected, onToggle }: { selected: string[]; onToggle: (id: string) => void }) {
  return (
    <View style={styles.grid}>
      {SPORTS.map((s) => {
        const on = selected.includes(s.id);
        return (
          <Pressable key={s.id} onPress={() => onToggle(s.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
            accessibilityLabel={s.name} style={({ pressed }) => [styles.tile, on && styles.tileOn, pressed && { opacity: 0.85 }]}>
            <Icon name={sportIcon(s.id)} size={26} color={on ? colors.accentInk : colors.accent} />
            <Text style={[styles.name, on && styles.nameOn]} numberOfLines={1}>{s.name}</Text>
            {s.launchWave === 1 ? <Text style={[styles.tag, on && styles.nameOn]}>FEATURED</Text> : null}
            {on ? <View style={styles.check}><Icon name="checkmark" size={14} color={colors.accent} /></View> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingHorizontal: space.lg },
  tile: { width: '31.5%', aspectRatio: 1, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line,
    alignItems: 'center', justifyContent: 'center', gap: 6, padding: space.sm },
  tileOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  name: { ...type.label, fontSize: 12, color: colors.text, textAlign: 'center' },
  nameOn: { color: colors.accentInk },
  tag: { ...type.label, fontSize: 8, color: colors.textDim },
  check: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.accentInk, alignItems: 'center', justifyContent: 'center' },
});
