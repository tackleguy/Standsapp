// Words around a play card: the score before it, the clock, and football's down and distance.
import { competitorById } from '@/data/api';
import type { EventState, Play } from '@/data/types';

const ORD = ['', '1st', '2nd', '3rd', '4th'];

/** "1st & 10", "3rd & Goal"; empty for kicks. */
export function downDistance(play: Play): string {
  const f = play.football;
  if (!f || f.down < 1) return '';
  return `${ORD[f.down] ?? `${f.down}th`} & ${f.distance >= 100 - f.yardLine ? 'Goal' : f.distance}`;
}

/** The score right before each play, by play id ("7-3"). */
export function scoresBefore(plays: Play[]): Map<string, string> {
  const out = new Map<string, string>();
  let current = '0-0';
  const sorted = [...plays].sort((a, b) => a.seq - b.seq);
  for (const p of sorted) {
    out.set(p.id, current);
    if (p.scoreAfter) current = p.scoreAfter;
  }
  return out;
}

/** "Q1 14:17 · 1st & 10" (football) or just the clock. */
export function clockAndDown(play: Play): string {
  return [play.clock, downDistance(play)].filter(Boolean).join(' · ');
}

/** "NE 7-3 SEA" for two-sided events, null for fields. */
export function scoreWithTeams(state: EventState, score: string | undefined): string | null {
  if (state.meta.competitorIds.length !== 2 || !score) return null;
  const [h, a] = state.meta.competitorIds.map((id) => competitorById(id)?.shortName ?? '?');
  return `${h} ${score} ${a}`;
}

/** The result for one side: "W 27-20", "L 3-1", "P3", "DNF", "Live · Q3 4:12". */
export function sideResult(state: EventState, sideId: string): { text: string; tone: 'win' | 'loss' | 'live' | 'plain' } {
  if (state.status === 'live') return { text: `Live${state.periodLabel ? ` · ${state.periodLabel}` : ''}`, tone: 'live' };
  if (state.status === 'scheduled') return { text: 'Upcoming', tone: 'plain' };
  if (state.status !== 'finished') return { text: state.status === 'cancelled' ? 'Cancelled' : 'Postponed', tone: 'plain' };
  const mine = state.entries.find((e) => e.competitorId === sideId);
  if (state.entries.length === 2) {
    const other = state.entries.find((e) => e.competitorId !== sideId);
    const score = mine?.score !== null && other?.score !== null && mine?.score !== undefined && other?.score !== undefined
      ? `${mine.scoreText ?? mine.score}-${other.scoreText ?? other.score}` : '';
    if (mine?.isWinner) return { text: `W ${score}`.trim(), tone: 'win' };
    if (mine?.isWinner === false) return { text: `L ${score}`.trim(), tone: 'loss' };
    return { text: `D ${score}`.trim(), tone: 'plain' };
  }
  if (mine?.note === 'DNF') return { text: 'DNF', tone: 'loss' };
  if (mine?.position) return { text: `P${mine.position}`, tone: mine.position <= 3 ? 'win' : 'plain' };
  return { text: 'Final', tone: 'plain' };
}
