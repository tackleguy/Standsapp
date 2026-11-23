// Calls (prediction questions) for every event: creation, live pricing, and settling.
import { DAY } from '@/lib/format';

import type { Call, CallOption, CallStatus, CallView, EventMeta, EventState } from '../types';
import { priceFromProbability, winChances } from './engines/common';
import { H2H_CONFIGS } from './engines/h2hSports';
import { finalState, simulate } from './engines';
import { planFor } from './plans';
import { competitorById } from './world';

const DRAW_CHANCE: Record<string, number> = {
  soccer: 0.26, rugby_union: 0.04, rugby_league: 0.03, aussie_rules: 0.01, netball: 0.03,
};
const LEAD_SCALE: Record<string, number> = {
  soccer: 1, ice_hockey: 1, basketball: 9, rugby_union: 7, rugby_league: 6, american_football: 7,
  aussie_rules: 12, netball: 4, baseball: 2,
};

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
const strength = (id: string | undefined) => competitorById(id)?.strength ?? 0.5;

function opt(callId: string, key: string, label: string, p: number, competitorId: string | null = null): CallOption {
  return { id: `${callId}:${key}`, label, competitorId, multiplier: priceFromProbability(p) };
}

/** Pre-match win chances for a two-sided event: [home, draw, away]. */
function sideChances(meta: EventMeta): [number, number, number] {
  const [h, a] = meta.competitorIds;
  const edge = H2H_CONFIGS[meta.sportId]?.homeEdge ?? 0.03;
  const pHome = sigmoid((strength(h) + edge - strength(a)) * 4.5);
  const draw = DRAW_CHANCE[meta.sportId] ?? 0;
  return [pHome * (1 - draw), draw, (1 - pHome) * (1 - draw)];
}

function sideOptions(meta: EventMeta, callId: string, chances: [number, number, number]): CallOption[] {
  const [h, a] = meta.competitorIds;
  const options = [opt(callId, 'home', competitorById(h)?.name ?? 'Home', chances[0], h)];
  if ((DRAW_CHANCE[meta.sportId] ?? 0) > 0) options.push(opt(callId, 'draw', 'Draw', Math.max(0.01, chances[1])));
  options.push(opt(callId, 'away', competitorById(a)?.name ?? 'Away', chances[2], a));
  return options;
}

function fieldOptions(meta: EventMeta, callId: string, take: number): CallOption[] {
  const ids = meta.competitorIds;
  const chances = winChances(ids.map((id) => strength(id)), 7);
  const ranked = ids.map((id, i) => ({ id, p: chances[i] })).sort((x, y) => y.p - x.p);
  const top = ranked.slice(0, take);
  const rest = ranked.slice(take).reduce((s, r) => s + r.p, 0);
  return [
    ...top.map((r) => opt(callId, r.id, competitorById(r.id)?.name ?? '?', r.p, r.id)),
    opt(callId, 'field', 'Anyone else', rest),
  ];
}

function yesNo(callId: string, pYes: number): CallOption[] {
  return [opt(callId, 'yes', 'Yes', pYes), opt(callId, 'no', 'No', 1 - pYes)];
}

/** Every Call for an event. Deterministic: same event, same Calls. */
export function callsForEvent(meta: EventMeta): Call[] {
  const engine = planFor(meta.sportId)?.engine ?? 'h2h';
  const pre = { opensAt: meta.startsAt - 3 * DAY, closesAt: meta.startsAt, livePriced: false };
  const live = { opensAt: meta.startsAt, closesAt: meta.startsAt + meta.durationMs * 0.75, livePriced: true };
  const id = (kind: string) => `${meta.id}:${kind}`;
  const calls: Call[] = [];

  if (engine === 'h2h' || engine === 'football' || engine === 'baseball' || engine === 'cricket' || engine === 'tennis' || engine === 'combat') {
    const chances = sideChances(meta);
    calls.push({ id: id('winner'), eventId: meta.id, kind: 'winner', question: 'Who wins?', ...pre,
      options: sideOptions(meta, id('winner'), chances) });
  }
  if (engine === 'h2h' || engine === 'football' || engine === 'baseball') {
    const expected = Number(simulate(meta, meta.startsAt - 1).facts.expectedTotal ?? 0);
    const line = Math.floor(expected) + 0.5;
    const word = H2H_CONFIGS[meta.sportId]?.totalWord ?? 'runs';
    calls.push({ id: id('total'), eventId: meta.id, kind: 'total', question: `Total ${word}: over or under ${line}?`, ...pre,
      line, factKey: 'total', options: [opt(id('total'), 'over', `Over ${line}`, 0.5), opt(id('total'), 'under', `Under ${line}`, 0.5)] });
  }
  if (['soccer', 'ice_hockey', 'american_football', 'rugby_union'].includes(meta.sportId)) {
    const [h, a] = meta.competitorIds;
    const [pH, , pA] = sideChances(meta);
    const none = meta.sportId === 'soccer' ? 0.08 : meta.sportId === 'ice_hockey' ? 0.03 : 0;
    const options = [opt(id('first'), 'home', competitorById(h)?.name ?? 'Home', (pH / (pH + pA)) * (1 - none), h),
      opt(id('first'), 'away', competitorById(a)?.name ?? 'Away', (pA / (pH + pA)) * (1 - none), a)];
    if (none > 0) options.push(opt(id('first'), 'none', 'No score', none));
    calls.push({ id: id('first'), eventId: meta.id, kind: 'first_score', question: 'Who scores first?', ...pre, factKey: 'firstScore', options });
  }
  if (engine === 'cricket') {
    calls.push({ id: id('total'), eventId: meta.id, kind: 'total', question: 'First-innings total: over or under 165.5?', ...pre,
      line: 165.5, factKey: 'firstInningsRuns', options: [opt(id('total'), 'over', 'Over 165.5', 0.5), opt(id('total'), 'under', 'Under 165.5', 0.5)] });
    calls.push({ id: id('sixes'), eventId: meta.id, kind: 'total', question: 'Total sixes in the match: over or under 14.5?', ...pre,
      line: 14.5, factKey: 'totalSixes', options: [opt(id('sixes'), 'over', 'Over 14.5', 0.48), opt(id('sixes'), 'under', 'Under 14.5', 0.52)] });
  }
  if (engine === 'tennis') {
    calls.push({ id: id('sets'), eventId: meta.id, kind: 'margin', question: 'Will it go to a deciding third set?', ...pre,
      factKey: 'sets', options: yesNo(id('sets'), 0.36) });
  }
  if (engine === 'combat') {
    const mma = meta.sportId === 'mma';
    const methods = mma ? [['KO/TKO', 0.3], ['Submission', 0.24], ['Decision', 0.46]] as const : [['KO/TKO', 0.42], ['Decision', 0.58]] as const;
    calls.push({ id: id('method'), eventId: meta.id, kind: 'method', question: 'How does it end?', ...pre, factKey: 'method',
      options: methods.map(([label, p]) => opt(id('method'), label.toLowerCase().replace(/[^a-z]/g, ''), label, p)) });
  }
  if (engine === 'race' || engine === 'golf' || engine === 'cycling') {
    const golfRound = Number(/Round (\d)/.exec(meta.title)?.[1] ?? 4);
    const question = engine === 'golf' && golfRound < 4 ? `Who leads after round ${golfRound}?` : 'Who wins?';
    calls.push({ id: id('winner'), eventId: meta.id, kind: 'winner', question, ...pre, factKey: 'winnerId',
      options: fieldOptions(meta, id('winner'), 5) });
    const ranked = [...meta.competitorIds].sort((x, y) => strength(y) - strength(x));
    const subject = ranked[5] ?? ranked[ranked.length - 1];
    calls.push({ id: id('podium'), eventId: meta.id, kind: 'podium',
      question: `Will ${competitorById(subject)?.name ?? 'they'} finish in the top three?`, ...pre, factKey: 'podium', subjectId: subject,
      options: yesNo(id('podium'), 0.22) });
    if (meta.sportId === 'f1' && !meta.title.includes('Sprint')) {
      calls.push({ id: id('sc'), eventId: meta.id, kind: 'margin', question: 'Will there be a safety car?', ...pre,
        factKey: 'safetyCar', options: yesNo(id('sc'), 0.4) });
    }
    if (engine === 'cycling') {
      calls.push({ id: id('break'), eventId: meta.id, kind: 'margin', question: 'Will the breakaway survive to the finish?', ...pre,
        factKey: 'breakSurvived', options: yesNo(id('break'), 0.25) });
    }
    calls.push({ id: id('live'), eventId: meta.id, kind: 'live_winner', question: 'In-play: who wins from here?', ...live,
      factKey: 'winnerId', options: fieldOptions(meta, id('live'), 4) });
  } else {
    calls.push({ id: id('live'), eventId: meta.id, kind: 'live_winner', question: 'In-play: who wins from here?', ...live,
      options: sideOptions(meta, id('live'), sideChances(meta)) });
  }
  return calls;
}

/** Re-price an in-play Call from the current state of the event. */
export function livePrice(call: Call, state: EventState): CallOption[] {
  if (!call.livePriced || state.status !== 'live') return call.options;
  const meta = state.meta;
  const engine = planFor(meta.sportId)?.engine ?? 'h2h';
  const remaining = Math.max(0.02, 1 - state.progress);

  if (engine === 'race' || engine === 'golf' || engine === 'cycling') {
    const ordered = [...state.entries].sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
    const sharp = 0.5 + (1 - remaining) * 2.2;
    const weights = new Map(ordered.map((e, i) => [e.competitorId,
      e.note === 'DNF' ? 0 : Math.exp(-i * sharp) * Math.exp(strength(e.competitorId) * 2)]));
    const total = [...weights.values()].reduce((a, b) => a + b, 0) || 1;
    const top = ordered.filter((e) => e.note !== 'DNF').slice(0, 4).map((e) => e.competitorId);
    const topSet = new Set(top);
    const rest = [...weights.entries()].filter(([cid]) => !topSet.has(cid)).reduce((a, [, w]) => a + w, 0);
    return [
      ...top.map((cid) => opt(call.id, cid, competitorById(cid)?.name ?? '?', (weights.get(cid) ?? 0) / total, cid)),
      opt(call.id, 'field', 'Anyone else', Math.max(0.01, rest / total)),
    ];
  }

  const home = state.entries.find((e) => e.role === 'home');
  const away = state.entries.find((e) => e.role === 'away');
  const [hId, aId] = meta.competitorIds;
  const sDiff = strength(hId) - strength(aId);
  let z = sDiff * 2 * Math.sqrt(remaining);
  let draw = 0;
  if (engine === 'cricket') {
    const label = state.periodLabel ?? '';
    const need = /Need (\d+) from (\d+)/.exec(label);
    if (need) {
      const rrr = (Number(need[1]) / Math.max(1, Number(need[2]))) * 6;
      const chasingIsHome = state.facts.battingFirst === 'away';
      const zChase = (9 - rrr) * 0.7;
      z = chasingIsHome ? zChase : -zChase;
    }
  } else if (engine === 'tennis') {
    const sets = (e: typeof home) => e?.score ?? 0;
    const games = (e: typeof home) => Number((e?.scoreText ?? '').split(' ').pop() ?? 0);
    z = (sets(home) - sets(away)) * 1.7 + (games(home) - games(away)) * 0.3 + sDiff * 2;
  } else if (engine === 'combat') {
    z = sDiff * 2.5;
  } else {
    const lead = (home?.score ?? 0) - (away?.score ?? 0);
    const scale = LEAD_SCALE[meta.sportId] ?? 3;
    z = (lead / scale) / Math.sqrt(remaining) * 1.1 + sDiff * 2 * Math.sqrt(remaining);
    const base = DRAW_CHANCE[meta.sportId] ?? 0;
    if (base > 0) draw = lead === 0 ? Math.min(0.6, base * (1 + (1 - remaining) * 1.5)) : base * Math.exp(-Math.abs(lead) / scale * 1.4) * remaining;
  }
  const pHome = sigmoid(z);
  return sideOptions(meta, call.id, [pHome * (1 - draw), draw, (1 - pHome) * (1 - draw)]);
}

/** Which option won, or null when the Call is void (refund). */
export function resolveCall(call: Call, final: EventState): string | null {
  if (final.status === 'cancelled' || final.status === 'postponed') return null;
  const f = final.facts;
  const pick = (key: string) => call.options.find((o) => o.id === `${call.id}:${key}`)?.id ?? null;
  switch (call.kind) {
    case 'winner':
    case 'live_winner': {
      if (call.factKey === 'winnerId') {
        const winner = String(f.winnerId ?? '');
        return pick(winner) ?? pick('field');
      }
      const w = String(f.winner ?? '');
      return w === 'draw' ? pick('draw') : pick(w);
    }
    case 'total': {
      const value = Number(f[call.factKey ?? 'total'] ?? 0);
      return value > (call.line ?? 0) ? pick('over') : pick('under');
    }
    case 'first_score':
      return pick(String(f.firstScore ?? 'none'));
    case 'podium':
      return String(f.podium ?? '').split(',').includes(call.subjectId ?? '') ? pick('yes') : pick('no');
    case 'method':
      return pick(String(f.method ?? '').toLowerCase().replace(/[^a-z]/g, ''));
    case 'margin': {
      const value = f[call.factKey ?? ''];
      const yes = call.factKey === 'sets' ? Number(value) === 3 : value === true;
      return yes ? pick('yes') : pick('no');
    }
    default:
      return null;
  }
}

export type Outcome = 'won' | 'lost' | 'void';

/** Did a pick win? Handles "Anyone else" picks made against a live field. */
export function outcomeFor(
  call: Call, pick: { optionId: string; excludes?: string[] }, final: EventState,
): Outcome {
  if (final.status === 'cancelled' || final.status === 'postponed') return 'void';
  const key = pick.optionId.split(':').pop() ?? '';
  if (call.factKey === 'winnerId') {
    const winner = String(final.facts.winnerId ?? '');
    if (key === 'field') {
      const excluded = pick.excludes ?? call.options.map((o) => o.competitorId).filter((x): x is string => !!x);
      return excluded.includes(winner) ? 'lost' : 'won';
    }
    return key === winner ? 'won' : 'lost';
  }
  const winning = resolveCall(call, final);
  if (winning === null) return 'void';
  return winning === pick.optionId ? 'won' : 'lost';
}

/** A Call as the fan sees it right now: status, current prices, and the result. */
export function viewCall(call: Call, state: EventState, now: number): CallView {
  let status: CallStatus;
  let winningOptionId: string | null = null;
  if (state.status === 'cancelled' || state.status === 'postponed') status = 'void';
  else if (state.status === 'finished') {
    const final = finalState(state.meta);
    if (call.factKey === 'winnerId') {
      const winner = String(final.facts.winnerId ?? '');
      winningOptionId = call.options.find((o) => o.competitorId === winner)?.id ?? `${call.id}:field`;
    } else winningOptionId = resolveCall(call, final);
    status = winningOptionId ? 'settled' : 'void';
  } else if (now < call.opensAt) status = 'upcoming';
  else if (now < call.closesAt && now < state.endsAt) status = 'open';
  else status = 'closed';
  const options = status === 'open' ? livePrice(call, state) : call.options;
  return { ...call, options, status, winningOptionId };
}
