import { useEffect, useState } from 'react';

import { useSettingsStore } from '@/store/settings';
import { useUserStore } from '@/store/user';

/** True once saved data has been loaded from the device. */
export function useHydrated(): boolean {
  const [ready, setReady] = useState(
    () => useUserStore.persist.hasHydrated() && useSettingsStore.persist.hasHydrated(),
  );
  useEffect(() => {
    const check = () => setReady(useUserStore.persist.hasHydrated() && useSettingsStore.persist.hasHydrated());
    const a = useUserStore.persist.onFinishHydration(check);
    const b = useSettingsStore.persist.onFinishHydration(check);
    check();
    return () => { a(); b(); };
  }, []);
  return ready;
}
