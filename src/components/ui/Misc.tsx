// Small shared pieces: section headings, cards, demo labels, segmented tabs, avatars, text fields.
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { avatarColors } from '@/lib/badge';
import { colors, radius, space, type } from '@/theme/tokens';

export function SectionHeading({ title, right, live }: { title: string; right?: ReactNode; live?: boolean }) {
  return (
    <View style={styles.heading}>
      <Text style={[styles.headingText, live && { color: colors.live }]} accessibilityRole="header">{title}</Text>
      {right}
    </View>
  );
}

export function Surface({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.surface, style]}>{children}</View>;
}

export function DemoTag({ compact = false }: { compact?: boolean }) {
  return (
    <View style={styles.demo} accessibilityLabel="Demo data">
      <Text style={styles.demoText}>{compact ? 'DEMO' : 'Demo data'}</Text>
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string; badge?: number }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="tab" accessibilityState={{ selected: on }}
            accessibilityLabel={o.label} style={[styles.segment, on && styles.segmentOn]}>
            <Text style={[styles.segmentText, on && styles.segmentTextOn]} numberOfLines={1}>{o.label}</Text>
            {o.badge ? <View style={styles.segBadge}><Text style={styles.segBadgeText}>{o.badge > 99 ? '99+' : o.badge}</Text></View> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function Avatar({ seed, name, size = 36 }: { seed: string; name: string; size?: number }) {
  const [bg, fg] = avatarColors(seed);
  const initials = name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}
      accessibilityElementsHidden importantForAccessibility="no">
      <Text style={{ color: fg, fontWeight: '800', fontSize: size * 0.38 }}>{initials}</Text>
    </View>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string | null }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.loss}
        accessibilityLabel={label}
        {...props}
        style={[styles.input, error ? styles.inputError : null, props.style]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.tile}>
      <Text style={[styles.tileValue, accent && { color: colors.accent }]} numberOfLines={1}>{value}</Text>
      <Text style={styles.tileLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, marginTop: space.lg, marginBottom: space.sm },
  headingText: { ...type.label, color: colors.textDim, textTransform: 'uppercase', fontSize: 12 },
  surface: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space.lg },
  demo: { borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 6, paddingVertical: 1, alignSelf: 'flex-start' },
  demoText: { ...type.label, fontSize: 10, color: colors.textDim, letterSpacing: 0.8 },
  segmented: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, padding: 4, gap: 4, borderWidth: 1, borderColor: colors.line },
  segment: { flex: 1, minHeight: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  segmentOn: { backgroundColor: colors.surfaceHigh },
  segmentText: { ...type.label, fontSize: 13, color: colors.textDim },
  segmentTextOn: { color: colors.text },
  segBadge: { backgroundColor: colors.live, borderRadius: 8, paddingHorizontal: 5, minWidth: 16, alignItems: 'center' },
  segBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  field: { gap: 6 },
  fieldLabel: { ...type.label, color: colors.textDim },
  input: { minHeight: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface,
    paddingHorizontal: space.lg, color: colors.text, fontSize: 16 },
  inputError: { borderColor: colors.live },
  error: { ...type.label, color: '#FF8A95' },
  tile: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space.md, gap: 2 },
  tileValue: { fontSize: 22, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  tileLabel: { ...type.label, color: colors.textDim },
});
