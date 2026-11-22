import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, space, type } from '@/theme/tokens';

import { Icon } from './Icon';

export function Screen({ children, edges = ['top'] }: { children: ReactNode; edges?: Edge[] }) {
  return <SafeAreaView edges={edges} style={styles.screen}>{children}</SafeAreaView>;
}

interface HeaderProps {
  title: string;
  subtitle?: string | null;
  back?: boolean;
  right?: ReactNode;
  large?: boolean;
}

export function Header({ title, subtitle, back = false, right, large = false }: HeaderProps) {
  const router = useRouter();
  return (
    <View style={styles.header}>
      {back && (
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Icon name="chevron-back" size={24} />
        </Pressable>
      )}
      <View style={styles.titles}>
        <Text style={large ? styles.titleLarge : styles.title} numberOfLines={1} accessibilityRole="header">{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.sm, minHeight: 56, gap: space.sm },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -space.sm, borderRadius: 22 },
  pressed: { backgroundColor: colors.surfaceHigh },
  titles: { flex: 1 },
  title: { ...type.title, color: colors.text },
  titleLarge: { fontSize: 30, fontWeight: '900', letterSpacing: -0.5, color: colors.text },
  subtitle: { ...type.label, color: colors.textDim, marginTop: 2 },
  right: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
