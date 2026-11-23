import { useEffect } from 'react';

import { formatNumber } from '@/lib/format';
import { tapSuccess } from '@/lib/haptics';
import { toast } from '@/store/toast';
import { useUserStore } from '@/store/user';

/** Pays out finished Calls and card bonuses automatically, every few seconds. */
export function useSettlementLoop(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const run = () => {
      const r = useUserStore.getState().settle(Date.now());
      if (r.won > 0) {
        tapSuccess();
        toast(`Your Call${r.won > 1 ? 's' : ''} came in! +${formatNumber(r.clout)} Clout`, 'success');
      } else if (r.refunded > 0) {
        toast(`${r.refunded} Call${r.refunded > 1 ? 's were' : ' was'} void. Stakes refunded.`, 'info');
      } else if (r.lost > 0) {
        toast(`${r.lost} Call${r.lost > 1 ? 's' : ''} settled. Not this time.`, 'info');
      }
      if (r.tix > 0) toast(`Your Stand Cards earned +${r.tix} Tix`, 'success');
    };
    run();
    const id = setInterval(run, 8000);
    return () => clearInterval(id);
  }, [enabled]);
}
