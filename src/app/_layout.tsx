import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { colors } from '@/theme/tokens';

// Navigation uses our night palette so no white flashes appear between screens.
const standsTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.line,
    primary: colors.accent,
  },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={standsTheme}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </ThemeProvider>
  );
}
