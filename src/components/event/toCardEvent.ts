import { sportById } from '@/config/sports';
import { competitorById, getWorld } from '@/data/api';
import type { EventState } from '@/data/types';

import type { CardEvent } from './ScoreCard';

/** Shapes an event from the data layer into what ScoreCard draws. */
export function toCardEvent(state: EventState, followed: Set<string>): CardEvent {
  const comp = getWorld().competitionById.get(state.meta.competitionId);
  return {
    id: state.meta.id,
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
    entries: state.entries.map((e) => {
      const c = competitorById(e.competitorId);
      return {
        competitorId: e.competitorId,
        name: c?.name ?? 'Unknown',
        shortName: c?.shortName ?? '?',
        kind: c?.kind ?? 'team',
        colors: c?.colors ?? null,
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
