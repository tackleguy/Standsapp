import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { useUserStore } from '@/store/user';

/**
 * Guests can browse everything. Commenting, making Calls, and collecting cards
 * need a free account; this sends guests to the sign-up screen first.
 */
export function useAccountGate() {
  const isGuest = useUserStore((s) => s.profile.isGuest);
  const router = useRouter();
  const require = useCallback((reason: string): boolean => {
    if (!isGuest) return true;
    router.push({ pathname: '/account', params: { reason } });
    return false;
  }, [isGuest, router]);
  return { isGuest, require };
}
