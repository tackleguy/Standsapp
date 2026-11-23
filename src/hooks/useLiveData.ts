// React Query hooks over the data layer. Live things refresh every few seconds;
// cached data shows instantly while fresh data loads in the background.
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import {
  getCompetitor, getDayEvents, getEvent, getEventCalls, getOpenCalls, search,
} from '@/data/api';
import { currentTime, DAY } from '@/lib/format';

const asPromise = <T,>(fn: () => T) => new Promise<T>((resolve, reject) => {
  try { resolve(fn()); } catch (e) { reject(e); }
});

export function useDayEvents(dayStart: number) {
  return useQuery({
    queryKey: ['day-events', dayStart],
    queryFn: () => asPromise(() => getDayEvents(dayStart, currentTime())),
    refetchInterval: () => {
      const t = currentTime();
      return t >= dayStart && t < dayStart + DAY ? 4000 : 30_000;
    },
    placeholderData: keepPreviousData,
  });
}

export function useEvent(id: string) {
  return useQuery({
    queryKey: ['event', id],
    queryFn: () => asPromise(() => getEvent(id, currentTime())),
    refetchInterval: (q) => (q.state.data?.status === 'live' ? 2000 : q.state.data?.status === 'scheduled' ? 10_000 : false),
  });
}

export function useEventCalls(id: string) {
  return useQuery({
    queryKey: ['calls', id],
    queryFn: () => asPromise(() => getEventCalls(id, currentTime())),
    refetchInterval: 3000,
  });
}

export function useOpenCalls(sportIds: string[]) {
  return useQuery({
    queryKey: ['open-calls', sportIds.join(',')],
    queryFn: () => asPromise(() => getOpenCalls(currentTime(), sportIds)),
    refetchInterval: 6000,
    placeholderData: keepPreviousData,
  });
}

export function useCompetitor(id: string) {
  return useQuery({
    queryKey: ['competitor', id],
    queryFn: () => asPromise(() => getCompetitor(id, currentTime())),
    refetchInterval: 15_000,
  });
}

export function useSearch(query: string) {
  return useQuery({
    queryKey: ['search', query.trim().toLowerCase()],
    queryFn: () => asPromise(() => search(query)),
    placeholderData: keepPreviousData,
  });
}
