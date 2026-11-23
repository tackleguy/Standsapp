import { sportById } from '@/config/sports';
import { competitorById, getWorld, recordLine, watchersFor } from '@/data/api';
import type { EventState } from '@/data/types';
import { HOUR } from '@/lib/format';

import type { CardEvent } from './ScoreCard';

/**
 * Shapes an event from the data layer into what ScoreCard draws. Pass `now` to
 * include the live crowd and each side's season record.
 */
export function toCardEvent(state: EventState, followed: Set<string>, now?: number): CardEvent {
  const comp = getWorld().competitionById.get(state.meta.competitionId);
  const live = state.status === 'live';
  const nearStart = state.status === 'scheduled' && now !== undefined && state.meta.startsAt - now < 2 * HOUR;
  const keyPlay = live ? [...state.plays].reverse().find((p) => p.importance >= 2 && p.tag !== 'PERIOD') ?? null : null;
  return {
    id: state.meta.id,
    sportId: state.meta.sportId,
    title: state.meta.title,
    format: state.meta.format,
    status: state.status,
    startsAt: new Date(state.meta.startsAt).toISOString(),
    periodLabel: state.periodLabel,
    competitionName: comp?.name ?? null,
    isDemo: state.meta.isDemo,
    followed: state.meta.competitorIds.some((id) => followed.has(id) || followed.has(competitorById(id)?.parentId ?? '')),
    sportName: sportById(state.meta.sportId)?.name,
    resultText: state.resultText,
    progress: state.progress,
    watchers: now !== undefined && (live || nearStart) ? watchersFor(state, now) : null,
    keyPlay: keyPlay ? { clock: keyPlay.clock, tag: keyPlay.tag, text: keyPlay.description, competitorId: keyPlay.competitorId } : null,
    entries: state.entries.map((e) => {
      const c = competitorById(e.competitorId);
      return {
        competitorId: e.competitorId,
        name: c?.name ?? 'Unknown',
        shortName: c?.shortName ?? '?',
        kind: c?.kind ?? 'team',
        colors: c?.colors ?? null,
        record: now !== undefined ? recordLine(e.competitorId, now) : null,
        role: e.role,
        score: e.score,
        scoreText: e.scoreText,
        position: e.position,
        isWinner: e.isWinner,
        note: e.note,
      };
    }),
  };
}
