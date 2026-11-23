import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToastStore, type Toast } from '@/store/toast';
import { colors, fonts, radius, space, type } from '@/theme/tokens';

import { Icon } from './Icon';
import { LiveDot } from './LiveDot';

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  const insets = useSafeAreaInsets();
  if (toasts.length === 0) return null;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + space.sm }]}>
      {toasts.map((t) => (t.tone === 'alert'
        ? <AlertToast key={t.id} t={t} onClose={() => dismiss(t.id)} />
        : (
          <Pressable key={t.id} onPress={() => dismiss(t.id)} accessibilityRole="alert" accessibilityLabel={t.message}
            style={[styles.toast, t.tone === 'success' && styles.success, t.tone === 'error' && styles.error]}>
            <Icon name={t.tone === 'success' ? 'checkmark-circle' : t.tone === 'error' ? 'alert-circle' : 'information-circle'}
              size={20} color={t.tone === 'success' ? colors.win : t.tone === 'error' ? colors.live : colors.accent} />
            <Text style={styles.text}>{t.message}</Text>
          </Pressable>
        )))}
    </View>
  );
}

/** A live score alert: team-colour stripe, headline, the play, tap to open the game. */
function AlertToast({ t, onClose }: { t: Toast; onClose: () => void }) {
  const router = useRouter();
  return (
    <Pressable accessibilityRole="alert" accessibilityLabel={`${t.title ?? ''}. ${t.message}. Open game`}
      onPress={() => { onClose(); if (t.href) router.push(t.href as never); }}
      style={({ pressed }) => [styles.toast, styles.alert, pressed && { opacity: 0.9 }]}>
      <View style={[styles.stripe, { backgroundColor: t.color ?? colors.accent }]} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.alertHead}>
          <LiveDot size={6} />
          <Text style={styles.alertTitle} numberOfLines={1}>{t.title}</Text>
          {t.meta ? <Text style={styles.alertMeta}>{t.meta}</Text> : null}
        </View>
        <Text style={styles.alertText} numberOfLines={2}>{t.message}</Text>
      </View>
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss alert" hitSlop={10}>
        <Icon name="close" size={18} color={colors.textDim} />
      </Pressable>
    </Pressable>
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
  alert: { overflow: 'hidden', paddingLeft: space.lg + 4, backgroundColor: '#182134' },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  alertHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  alertTitle: { fontFamily: fonts.heavy, fontSize: 17, color: colors.text, letterSpacing: 0.4, flex: 1 },
  alertMeta: { fontFamily: fonts.bold, fontSize: 13, color: '#FF8A95', fontVariant: ['tabular-nums'] },
  alertText: { fontSize: 13, color: colors.textDim, lineHeight: 18 },
});
