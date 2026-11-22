// Small preferences remembered on this device.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type MotionPref = 'system' | 'reduce' | 'full';

interface SettingsState {
  haptics: boolean;
  motion: MotionPref;
  selectedSport: string; // 'all' or a sport id, remembered on Today
  liveOnly: boolean;
  setHaptics: (on: boolean) => void;
  setMotion: (m: MotionPref) => void;
  setSelectedSport: (id: string) => void;
  setLiveOnly: (on: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      haptics: true,
      motion: 'system',
      selectedSport: 'all',
      liveOnly: false,
      setHaptics: (haptics) => set({ haptics }),
      setMotion: (motion) => set({ motion }),
      setSelectedSport: (selectedSport) => set({ selectedSport }),
      setLiveOnly: (liveOnly) => set({ liveOnly }),
    }),
    { name: 'stands-settings', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
