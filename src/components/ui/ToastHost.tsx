import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToastStore } from '@/store/toast';
import { colors, radius, space, type } from '@/theme/tokens';

import { Icon } from './Icon';

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  const insets = useSafeAreaInsets();
  if (toasts.length === 0) return null;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + space.sm }]}>
      {toasts.map((t) => (
        <Pressable key={t.id} onPress={() => dismiss(t.id)} accessibilityRole="alert" accessibilityLabel={t.message}
          style={[styles.toast, t.tone === 'success' && styles.success, t.tone === 'error' && styles.error]}>
          <Icon name={t.tone === 'success' ? 'checkmark-circle' : t.tone === 'error' ? 'alert-circle' : 'information-circle'}
            size={20} color={t.tone === 'success' ? colors.win : t.tone === 'error' ? colors.live : colors.accent} />
          <Text style={styles.text}>{t.message}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.lg, right: space.lg, gap: space.sm, alignItems: 'center', zIndex: 1000 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.surfaceHigh, borderRadius: radius.md,
    paddingHorizontal: space.lg, paddingVertical: space.md, borderWidth: 1, borderColor: colors.line, maxWidth: 520, width: '100%',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  success: { borderColor: 'rgba(61,220,151,0.5)' },
  error: { borderColor: 'rgba(255,77,94,0.6)' },
  text: { ...type.body, color: colors.text, flex: 1 },
});
