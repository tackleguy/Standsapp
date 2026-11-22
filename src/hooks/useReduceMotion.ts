import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { useSettingsStore } from '@/store/settings';

/** Respects the phone's reduce-motion setting, unless the fan overrides it in Settings. */
export function useReduceMotion(): boolean {
  const pref = useSettingsStore((s) => s.motion);
  const [system, setSystem] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (alive) setSystem(v); }).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystem);
    return () => { alive = false; sub.remove(); };
  }, []);
  if (pref === 'reduce') return true;
  if (pref === 'full') return false;
  return system;
}
