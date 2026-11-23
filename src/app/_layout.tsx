import {
  BarlowCondensed_600SemiBold, BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold, BarlowCondensed_900Black,
} from '@expo-google-fonts/barlow-condensed';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastHost } from '@/components/ui/ToastHost';
import { useHydrated } from '@/hooks/useHydrated';
import { useLiveAlerts } from '@/hooks/useLiveAlerts';
import { useSettlementLoop } from '@/hooks/useSettlementLoop';
import { useUserStore } from '@/store/user';
import { colors, fonts } from '@/theme/tokens';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1500, retry: 1, refetchOnWindowFocus: true } },
});

const standsTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.surface, text: colors.text, border: colors.line, primary: colors.accent },
};

export default function RootLayout() {
  const hydrated = useHydrated();
  const [fontsLoaded, fontError] = useFonts({
    [fonts.semibold]: BarlowCondensed_600SemiBold,
    [fonts.bold]: BarlowCondensed_700Bold,
    [fonts.heavy]: BarlowCondensed_800ExtraBold,
    [fonts.black]: BarlowCondensed_900Black,
  });
  // Never block the app on fonts: if they fail, the system font is used instead.
  const ready = hydrated && (fontsLoaded || !!fontError);
  const onboarded = useUserStore((s) => s.onboarded);
  useSettlementLoop(hydrated && onboarded);
  useLiveAlerts(hydrated && onboarded);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <ThemeProvider value={standsTheme}>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
            <Stack.Protected guard={!onboarded} redirectTo="/">
              <Stack.Screen name="(onboarding)" />
            </Stack.Protected>
            <Stack.Protected guard={onboarded} redirectTo="/welcome">
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="event/[id]" />
              <Stack.Screen name="competitor/[id]" />
              <Stack.Screen name="player/[id]" />
              <Stack.Screen name="pick" />
              <Stack.Screen name="section/[id]" />
              <Stack.Screen name="search" options={{ animation: 'fade' }} />
              <Stack.Screen name="settings" />
              <Stack.Screen name="follows" />
              <Stack.Screen name="leaderboard" />
              <Stack.Screen name="standings/[sportId]" />
              <Stack.Screen name="fan/[id]" />
              <Stack.Screen name="earnings" />
              <Stack.Screen name="pack" options={{ presentation: 'modal' }} />
              <Stack.Screen name="card/[id]" />
              <Stack.Screen name="set/[id]" />
              <Stack.Screen name="tradeup" />
              <Stack.Screen name="account" options={{ presentation: 'modal' }} />
            </Stack.Protected>
            <Stack.Screen name="privacy" />
            <Stack.Screen name="rules" />
          </Stack>
          <ToastHost />
          {!ready && (
            <View style={styles.splash}>
              <Text style={styles.word}>Stands</Text>
              <ActivityIndicator color={colors.accent} />
            </View>
          )}
        </ThemeProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  splash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 16 },
  word: { fontSize: 44, fontWeight: '900', color: colors.text, letterSpacing: -1 },
});
