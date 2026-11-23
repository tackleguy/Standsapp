// Live score alerts anywhere in the app: when a team you follow (or a game you
// have an open Call on) has a big moment, a banner drops in. Tap to open the game.
// Quiet by design: no alerts for the game you are already watching, nothing
// from before you opened the app, and at most one banner every 20 seconds.
import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';

import { headlineFor } from '@/components/event/playIcons';
import { teamColor } from '@/components/event/teamColor';
import { competitorById, getAlertCandidates } from '@/data/api';
import type { EventState, Play } from '@/data/types';
import { liveAlert } from '@/store/toast';
import { useUserStore } from '@/store/user';

const POLL_MS = 8000;
const MIN_GAP_MS = 20_000;
const QUIET_TAGS = new Set(['PERIOD', 'INNINGS', 'LEAD', 'SC', 'DNF']);

function scoreLine(state: EventState, play: Play): string {
  const [h, a] = state.meta.competitorIds;
  const hs = competitorById(h)?.shortName ?? '';
  const as = competitorById(a)?.shortName ?? '';
  if (state.meta.format === 'race') return state.meta.title;
  if (play.scoreAfter && /^\d+-\d+$/.test(play.scoreAfter)) return `${hs} ${play.scoreAfter} ${as}`;
  const home = state.entries.find((e) => e.role === 'home');
  const away = state.entries.find((e) => e.role === 'away');
  const fmt = (e: typeof home) => e?.scoreText ?? String(e?.score ?? 0);
  return `${hs} ${fmt(home)} · ${as} ${fmt(away)}`;
}

export function useLiveAlerts(enabled: boolean) {
  const pathname = usePathname();
  const path = useRef(pathname);
  useEffect(() => { path.current = pathname; }, [pathname]);

  useEffect(() => {
    if (!enabled) return;
    const seen = new Set<string>();
    const primed = new Set<string>();
    let lastShown = 0;
    const tick = () => {
      const s = useUserStore.getState();
      const callIds = s.predictions.filter((p) => p.status === 'open').map((p) => p.eventId);
      const now = Date.now();
      let candidates: EventState[] = [];
      try {
        candidates = getAlertCandidates(now, s.followedCompetitors, callIds);
      } catch {
        return; // Alerts are a nice-to-have; never let them break the app.
      }
      for (const state of candidates) {
        const big = state.plays.filter((p) => p.importance === 3 && !seen.has(p.id));
        big.forEach((p) => seen.add(p.id));
        // The first look at a game only records what already happened.
        if (!primed.has(state.meta.id)) { primed.add(state.meta.id); continue; }
        const play = [...big].reverse().find((p) => !QUIET_TAGS.has(p.tag ?? '') && headlineFor(p.tag, state.meta.sportId));
        if (!play) continue;
        if (path.current === `/event/${state.meta.id}`) continue;
        if (now - lastShown < MIN_GAP_MS) continue;
        lastShown = now;
        liveAlert({
          title: `${headlineFor(play.tag, state.meta.sportId)} ${scoreLine(state, play)}`,
          message: play.description,
          color: play.competitorId ? teamColor(play.competitorId) : '#FFB627',
          href: `/event/${state.meta.id}`,
          meta: play.clock,
        });
      }
      if (seen.size > 5000) { seen.clear(); primed.clear(); }
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, [enabled]);
}
