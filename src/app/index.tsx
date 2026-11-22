import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { launchSports } from '@/config/sports';
import { colors, space, type } from '@/theme/tokens';

// Phase 0 placeholder: proves the app runs and uses the Stands look.
export default function Home() {
  const firstSports = launchSports(1).map((s) => s.name).join(' · ');

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.center}>
        <View style={styles.glow} />
        <Text style={styles.wordmark} accessibilityRole="header">
          Stands
        </Text>
        <Text style={styles.tagline}>Every sport. One crowd.</Text>
        <Text style={styles.sports}>{firstSports}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  glow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: colors.accent,
    opacity: 0.08,
  },
  wordmark: {
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: -1,
    color: colors.text,
  },
  tagline: { ...type.title, color: colors.accent, marginTop: space.sm },
  sports: { ...type.label, color: colors.textDim, marginTop: space.xl, textAlign: 'center' },
});
