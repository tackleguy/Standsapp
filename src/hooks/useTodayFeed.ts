// Builds the Today list: featured big games, Live, Starting soon, Later today, Final —
// followed teams first.
import { useMemo } from 'react';

import type { CardEvent } from '@/components/event/ScoreCard';
import { toCardEvent } from '@/components/event/toCardEvent';
import { competitorById } from '@/data/api';
import type { EventState } from '@/data/types';
import { DAY, HOUR } from '@/lib/format';
import { useUserStore } from '@/store/user';

import { useDayEvents } from './useLiveData';

export type FeedItem =
  | { kind: 'heading'; key: string; title: string; count: number; live?: boolean }
  | { kind: 'event'; key: string; event: CardEvent; sportId: string }
  | { kind: 'more'; key: string; hidden: number };

export function useTodayFeed(dayStart: number, sportId: string, liveOnly: boolean, showAllFinals: boolean, clockNow: number) {
  const query = useDayEvents(dayStart);
  const followedSports = useUserStore((s) => s.followedSports);
  const followedTeams = useUserStore((s) => s.followedCompetitors);

  const result = useMemo(() => {
    const states: EventState[] = query.data ?? [];
    // Live states carry their own time; the clock only decides 'soon' vs 'later'.
    const now = Math.max(clockNow, query.dataUpdatedAt);
    const followed = new Set(followedTeams);
    const liveCounts: Record<string, number> = {};
    for (const s of states) if (s.status === 'live') liveCounts[s.meta.sportId] = (liveCounts[s.meta.sportId] ?? 0) + 1;

    const filtered = states.filter((s) => (sportId === 'all' ? true : s.meta.sportId === sportId));
    const isFollowed = (s: EventState) => s.meta.competitorIds.some((id) => followed.has(id) || followed.has(competitorById(id)?.parentId ?? ''));
    const rank = (s: EventState) => (isFollowed(s) ? 0 : followedSports.includes(s.meta.sportId) ? 1 : 2);
    const byRank = (a: EventState, b: EventState) => rank(a) - rank(b) || a.meta.startsAt - b.meta.startsAt;
    const isToday = now >= dayStart && now < dayStart + DAY;

    const live = filtered.filter((s) => s.status === 'live').sort(byRank);
    const soon = filtered.filter((s) => s.status === 'scheduled' && s.meta.startsAt - now < 2 * HOUR).sort(byRank);
    const later = filtered.filter((s) => s.status === 'scheduled' && s.meta.startsAt - now >= 2 * HOUR).sort(byRank);
    const final = filtered.filter((s) => s.status === 'finished' || s.status === 'postponed' || s.status === 'cancelled')
      .sort((a, b) => rank(a) - rank(b) || b.meta.startsAt - a.meta.startsAt);

    const cards = new Map<string, CardEvent>();
    const card = (s: EventState) => {
      let c = cards.get(s.meta.id);
      if (!c) { c = toCardEvent(s, followed, now); cards.set(s.meta.id, c); }
      return c;
    };
    // The biggest crowds right now (followed teams first) get the hero treatment.
    const featured = live.map(card)
      .sort((a, b) => Number(b.followed) - Number(a.followed) || (b.watchers ?? 0) - (a.watchers ?? 0))
      .slice(0, 5);
    const strip = live.map(card);

    const items: FeedItem[] = [];
    const push = (title: string, list: EventState[], opts: { live?: boolean; cap?: number } = {}) => {
      if (list.length === 0) return;
      items.push({ kind: 'heading', key: `h-${title}`, title, count: list.length, live: opts.live });
      const shown = opts.cap && !showAllFinals ? list.slice(0, opts.cap) : list;
      for (const s of shown) items.push({ kind: 'event', key: s.meta.id, event: card(s), sportId: s.meta.sportId });
      if (shown.length < list.length) items.push({ kind: 'more', key: `more-${title}`, hidden: list.length - shown.length });
    };
    push('Live now', live, { live: true });
    if (!liveOnly) {
      push(isToday ? 'Starting soon' : 'Upcoming', isToday ? soon : [...soon, ...later]);
      if (isToday) push('Later today', later, { cap: 25 });
      push('Final', final, { cap: 12 });
    }
    return { items, liveCounts, totalLive: live.length, total: filtered.length, featured, strip };
  }, [query.data, query.dataUpdatedAt, sportId, liveOnly, showAllFinals, followedSports, followedTeams, dayStart, clockNow]);

  return { ...result, isLoading: query.isLoading, isError: query.isError, refetch: query.refetch, isFetching: query.isFetching };
}
