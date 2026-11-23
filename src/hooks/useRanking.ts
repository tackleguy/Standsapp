// Leaderboards and fan profiles over the ranking model. Boards refresh every
// 15 seconds so totals tick up as games finish; your own row comes from your device.
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { fanProfile } from '@/data/demo/fanProfile';
import {
  buildBoard, myScore, referenceTime, weekCheckpoint, type BoardScope, type BoardView, type MeInput, type Period,
} from '@/data/demo/ranking';
import { currentTime } from '@/lib/format';
import { summarizeRecord } from '@/logic/predictions';
import { useUserStore } from '@/store/user';

const asPromise = <T,>(fn: () => T) => new Promise<T>((resolve, reject) => {
  try { resolve(fn()); } catch (e) { reject(e); }
});

/** Your current win streak from your settled Calls, newest first. */
function currentStreak(predictions: { status: string; settledAt: number | null }[]): number {
  const settled = predictions.filter((p) => p.status === 'won' || p.status === 'lost')
    .sort((a, b) => (b.settledAt ?? 0) - (a.settledAt ?? 0));
  let n = 0;
  for (const p of settled) {
    if (p.status !== 'won') break;
    n++;
  }
  return n;
}

/** What the ranking model needs to know about you, for a period and scope. */
export function useMeInput(period: Period, sportId: string | null, includeMe: boolean, now: number): MeInput | null {
  const profile = useUserStore((s) => s.profile);
  const ledger = useUserStore((s) => s.ledger);
  const predictions = useUserStore((s) => s.predictions);
  const followedSports = useUserStore((s) => s.followedSports);
  // Bucket time so the board does not rebuild on every tick.
  const bucket = Math.floor(now / 15_000) * 15_000;
  return useMemo(() => {
    if (!includeMe || profile.isGuest) return null;
    const record = summarizeRecord(predictions);
    return {
      username: profile.username,
      displayName: profile.displayName,
      avatarSeed: profile.avatarSeed,
      favoriteSportId: followedSports[0] ?? null,
      score: myScore(ledger, predictions, period, sportId, bucket),
      refScore: myScore(ledger, predictions, period, sportId, referenceTime(period, bucket)),
      checkpointScore: myScore(ledger, predictions, 'week', null, weekCheckpoint(bucket)),
      winRate: record.winRate,
      streak: currentStreak(predictions),
    };
  }, [includeMe, profile, ledger, predictions, followedSports, period, sportId, bucket]);
}

function scopeKey(scope: BoardScope): string {
  return scope.kind === 'group' ? `group:${scope.fanIds.join(',')}` : scope.kind === 'sport' ? `sport:${scope.sportId}` : 'global';
}

/** A leaderboard for a period and scope, with you placed in it. */
export function useBoard(period: Period, scope: BoardScope, me: MeInput | null) {
  return useQuery<BoardView>({
    queryKey: ['board', period, scopeKey(scope), me],
    queryFn: () => asPromise(() => buildBoard(period, scope, currentTime(), me)),
    refetchInterval: 15_000,
    placeholderData: keepPreviousData,
  });
}

export function useFanProfile(id: string) {
  return useQuery({
    queryKey: ['fan', id],
    queryFn: () => asPromise(() => fanProfile(id, currentTime())),
    refetchInterval: 30_000,
  });
}
