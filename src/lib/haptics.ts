// Haptic taps for rating a play, placing a call, and revealing a card.
// On the web these quietly do nothing.
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { useSettingsStore } from '@/store/settings';

function enabled(): boolean {
  return Platform.OS !== 'web' && useSettingsStore.getState().haptics;
}

export function tapLight() {
  if (enabled()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

export function tapMedium() {
  if (enabled()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
}

export function tapSuccess() {
  if (enabled()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

export function tapError() {
  if (enabled()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
}
