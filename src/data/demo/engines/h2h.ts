// Generic simulator for two-sided team sports (soccer, rugby, basketball, and more).
// It writes the whole match script up front from a seed, then reveals it as real
// time passes, so every phone sees the same live match.
import { MINUTE } from '@/lib/format';
import { createRng } from '@/lib/random';

import type { EntryState, EventMeta, EventState, StatsSection } from '../../types';
import type { GameStats } from '../players/types';
import { squadFor, venueFor, competitorById } from '../world';
import {
  cachedScript, disruptedState, fill, mmss, nameOf, playsUpTo, preMatchNote, progressAt, shortOf,
  sortTimeline, statusAt, strengthOf, type TimedPlay, emptyGameStats,
} from './common';
import { H2H_CONFIGS, type H2HConfig, type PeriodDef } from './h2hSports';

interface PeriodBound {
  def: PeriodDef;
  start: number;
  end: number;
  clockBefore: number; // game minutes elapsed before this period
  breakAfter: { realMin: number; label: string } | null;
}

interface ScoreHit {
  at: number;
  side: 0 | 1;
  points: number;
  tag: string;
  player: string;
  period: number;
}

interface H2HScript {
  cfg: H2HConfig;
  bounds: PeriodBound[];
  endsAt: number;
  hits: ScoreHit[];
  tagHits: { at: number; side: 0 | 1; tag: string }[];
  timeline: TimedPlay[];
  rel: number;
  shootoutWinner: 0 | 1 | null;
  statNoise: number[];
}

interface Draft {
  period: number;
  within: number;
  side: 0 | 1;
  kind: 'score' | 'flavor' | 'miss';
  tag: string;
  points: number;
  importance: 1 | 2 | 3;
  show: boolean;
  template: string;
  player: string;
}

const FULL_TIME_SPORTS = new Set(['soccer', 'rugby_union', 'rugby_league', 'aussie_rules', 'netball']);

function realTime(b: PeriodBound, within: number): number {
  return Math.round(b.start + (within / b.def.clockMin) * (b.end - b.start));
}

function clockLabel(cfg: H2HConfig, b: PeriodBound, within: number): string {
  if (cfg.clock === 'up') {
    if (b.def.short === 'OT') return `ET ${Math.floor(b.clockBefore + within) + 1}'`;
    const minute = Math.floor(b.clockBefore + within) + 1;
    return `${minute}'`;
  }
  return `${b.def.short} ${mmss(b.def.clockMin - within)}`;
}

function buildBounds(meta: EventMeta, cfg: H2HConfig): PeriodBound[] {
  const bounds: PeriodBound[] = [];
  let t = meta.startsAt;
  let clock = 0;
  cfg.periods.forEach((def, i) => {
    const brk = cfg.breaks[i] ?? null;
    bounds.push({ def, start: t, end: t + def.realMin * MINUTE, clockBefore: clock, breakAfter: brk });
    t += def.realMin * MINUTE + (brk ? brk.realMin * MINUTE : 0);
    clock += def.clockMin;
  });
  return bounds;
}

function buildScript(meta: EventMeta): H2HScript {
  const cfg = H2H_CONFIGS[meta.sportId] ?? H2H_CONFIGS.soccer;
  const rng = createRng(`h2h:${meta.id}`);
  const [homeId, awayId] = meta.competitorIds;
  const sH = strengthOf(homeId) + cfg.homeEdge;
  const sA = strengthOf(awayId);
  const rel = sH / (sH + sA);
  const spread = 1.2 * (cfg.strengthSpread ?? 1);
  const factor = [1 + spread * (rel - 0.5), 1 + spread * (0.5 - rel)];
  const squads = [squadFor(homeId, 14), squadFor(awayId, 14)];
  const pickPlayer = (side: 0 | 1) => squads[side][Math.floor(Math.pow(rng.next(), 1.7) * squads[side].length)];
  const bounds = buildBounds(meta, cfg);
  const totalClock = cfg.periods.reduce((a, p) => a + p.clockMin, 0);
  const drafts: Draft[] = [];

  const placeClock = (clock: number) => {
    let acc = 0;
    for (let i = 0; i < bounds.length; i++) {
      const len = bounds[i].def.clockMin;
      if (clock < acc + len) return { period: i, within: clock - acc };
      acc += len;
    }
    return { period: bounds.length - 1, within: bounds[bounds.length - 1].def.clockMin - 0.01 };
  };

  const addScoring = (side: 0 | 1, periodFilter: number | null, meanScale: number) => {
    for (const type of cfg.scoring) {
      const mu = type.mean * factor[side] * meanScale;
      // rng.normal's spread is about 3.5 standard deviations wide.
      const n = cfg.countNoise === undefined ? rng.poisson(mu)
        : Math.max(0, Math.round(rng.normal(mu, Math.sqrt(mu) * cfg.countNoise * 3.46)));
      for (let k = 0; k < n; k++) {
        const pos = periodFilter === null
          ? placeClock(rng.float(0, totalClock))
          : { period: periodFilter, within: rng.float(0, bounds[periodFilter].def.clockMin * 0.98) };
        const player = pickPlayer(side);
        drafts.push({ ...pos, side, kind: 'score', tag: type.tag, points: type.points, importance: type.importance,
          show: rng.chance(type.feedChance), template: rng.pick(type.templates), player });
        if (type.follow) {
          const f = type.follow;
          const within = Math.min(pos.within + 0.4, bounds[pos.period].def.clockMin - 0.01);
          const kicker = squads[side][(side + 9) % squads[side].length];
          if (rng.chance(f.chance)) {
            drafts.push({ period: pos.period, within, side, kind: 'score', tag: f.tag, points: f.points, importance: 1,
              show: true, template: rng.pick(f.templates), player: kicker });
          } else {
            drafts.push({ period: pos.period, within, side, kind: 'miss', tag: `${f.tag}_MISS`, points: 0, importance: 1,
              show: true, template: rng.pick(f.missTemplates), player: kicker });
          }
        }
      }
    }
  };

  addScoring(0, null, 1);
  addScoring(1, null, 1);
  for (const flavor of cfg.flavor) {
    const n = rng.poisson(flavor.mean);
    for (let k = 0; k < n; k++) {
      const start = flavor.lateOnly ? totalClock * 0.5 : 0;
      const pos = placeClock(rng.float(start, totalClock));
      const side: 0 | 1 = rng.chance(rel) ? 0 : 1;
      drafts.push({ ...pos, side, kind: 'flavor', tag: flavor.tag, points: 0, importance: flavor.importance,
        show: true, template: rng.pick(flavor.templates), player: pickPlayer(side) });
    }
  }

  // Overtime when the rules demand a winner.
  const regTotals = [0, 1].map((s) => drafts.filter((d) => d.side === s).reduce((a, d) => a + d.points, 0));
  let shootoutWinner: 0 | 1 | null = null;
  let endsAt = bounds[bounds.length - 1].end;
  if (regTotals[0] === regTotals[1] && cfg.tie === 'overtime' && cfg.overtime) {
    const last = bounds[bounds.length - 1];
    last.breakAfter = { realMin: 5, label: 'End of regulation' };
    const otStart = last.end + 5 * MINUTE;
    const ot: PeriodBound = {
      def: cfg.overtime, start: otStart, end: otStart + cfg.overtime.realMin * MINUTE,
      clockBefore: totalClock, breakAfter: null,
    };
    bounds.push(ot);
    const otIndex = bounds.length - 1;
    endsAt = ot.end;
    if (cfg.overtime.suddenDeath) {
      if (rng.chance(cfg.overtime.shootout ? 0.55 : 0.85)) {
        const side: 0 | 1 = rng.chance(rel) ? 0 : 1;
        const type = cfg.scoring.length > 1 && rng.chance(0.4) ? cfg.scoring[1] : cfg.scoring[0];
        const within = rng.float(0.3, cfg.overtime.clockMin * 0.95);
        drafts.push({ period: otIndex, within, side, kind: 'score', tag: type.tag, points: type.points, importance: 3,
          show: true, template: rng.pick(type.templates), player: pickPlayer(side) });
        endsAt = realTime(ot, within) + 2 * MINUTE;
        ot.end = endsAt;
      } else if (cfg.overtime.shootout) {
        shootoutWinner = rng.chance(rel) ? 0 : 1;
        endsAt = ot.end + 6 * MINUTE;
      }
    } else {
      const scale = cfg.overtime.clockMin / totalClock;
      addScoring(0, otIndex, scale);
      addScoring(1, otIndex, scale);
      const otTotals = [0, 1].map((s) => drafts.filter((d) => d.side === s).reduce((a, d) => a + d.points, 0));
      if (otTotals[0] === otTotals[1]) {
        const side: 0 | 1 = rng.chance(rel) ? 0 : 1;
        const ft = cfg.scoring[cfg.scoring.length - 1];
        drafts.push({ period: otIndex, within: cfg.overtime.clockMin - 0.05, side, kind: 'score', tag: ft.tag,
          points: ft.points, importance: 3, show: true, template: `Clutch! {player} wins it at the death for {team}!`,
          player: pickPlayer(side) });
      }
    }
  }

  // Minor moments (shots, fouls, rebounds...) from their own seed, so they never
  // shift a score, a result, or the settlement of a Call.
  const detailRng = createRng(`h2h-detail:${meta.id}`);
  for (const det of cfg.detail ?? []) {
    const n = detailRng.poisson(det.mean);
    for (let k = 0; k < n; k++) {
      const pos = placeClock(detailRng.float(det.lateOnly ? totalClock * 0.5 : 0.3, totalClock));
      const side: 0 | 1 = detailRng.chance(rel) ? 0 : 1;
      const squad = squads[side];
      drafts.push({ ...pos, side, kind: 'flavor', tag: det.tag, points: 0, importance: det.importance, show: true,
        template: detailRng.pick(det.templates), player: squad[Math.floor(Math.pow(detailRng.next(), 1.25) * squad.length)] });
    }
  }

  // Turn drafts into a timeline with running scores.
  const teamIds = [homeId, awayId];
  const ordered = drafts
    .map((d) => ({ ...d, at: realTime(bounds[d.period], d.within) }))
    .sort((a, b) => a.at - b.at);
  const running = [0, 0];
  const timeline: TimedPlay[] = [];
  const hits: ScoreHit[] = [];
  const tagHits: H2HScript['tagHits'] = [];
  const venue = competitorById(homeId) ? venueFor(competitorById(homeId)!) : meta.venue;
  timeline.push({ at: meta.startsAt, clock: cfg.clock === 'up' ? "1'" : `${cfg.periods[0].short} ${mmss(cfg.periods[0].clockMin)}`,
    description: fill(cfg.startText, { team: nameOf(homeId), venue }), competitorId: null, importance: 1, tag: 'START', scoreAfter: '0-0' });

  for (const d of ordered) {
    const b = bounds[d.period];
    if (d.at >= endsAt) continue;
    tagHits.push({ at: d.at, side: d.side, tag: d.tag });
    if (d.points > 0) {
      running[d.side] += d.points;
      hits.push({ at: d.at, side: d.side, points: d.points, tag: d.tag, player: d.player, period: d.period });
    }
    if (!d.show) continue;
    timeline.push({
      at: d.at,
      clock: clockLabel(cfg, b, d.within),
      description: fill(d.template, { player: d.player, team: nameOf(teamIds[d.side]), opp: nameOf(teamIds[1 - d.side]) }),
      competitorId: teamIds[d.side],
      importance: d.importance,
      tag: d.tag,
      scoreAfter: d.points > 0 ? `${running[0]}-${running[1]}` : null,
    });
  }

  // Period ends, with the score at that moment.
  bounds.forEach((b, i) => {
    const isLast = i === bounds.length - 1;
    const at = isLast ? Math.min(endsAt - 1, b.end) : b.end;
    const score = [0, 1].map((s) => hits.filter((h) => h.side === s && h.at <= at).reduce((a, h) => a + h.points, 0));
    const line = `${shortOf(homeId)} ${score[0]}-${score[1]} ${shortOf(awayId)}`;
    if (!isLast) {
      const label = b.breakAfter?.label ?? `End of ${b.def.label}`;
      const extra = label === 'End of regulation' ? ' — we are heading to overtime!' : '';
      timeline.push({ at, clock: label, description: `${label}: ${line}${extra}`, competitorId: null,
        importance: label === 'End of regulation' ? 3 : 2, tag: 'PERIOD', scoreAfter: `${score[0]}-${score[1]}` });
    }
  });
  if (shootoutWinner !== null) {
    timeline.push({ at: endsAt - 2 * MINUTE, clock: 'Shootout', importance: 3, tag: 'SHOOTOUT',
      description: `${nameOf(teamIds[shootoutWinner])} win the shootout!`, competitorId: teamIds[shootoutWinner],
      scoreAfter: `${running[0]}-${running[1]}` });
  }
  const winner = running[0] > running[1] ? 0 : running[1] > running[0] ? 1 : shootoutWinner;
  // Football codes say "Full time"; US sports say "Final".
  const fullTime = FULL_TIME_SPORTS.has(meta.sportId);
  const endWord = fullTime ? 'Full time' : 'Final';
  timeline.push({
    at: endsAt - 1, clock: fullTime ? 'FT' : 'Final', importance: 3, tag: 'FINAL', competitorId: winner === null ? null : teamIds[winner],
    description: winner === null
      ? `${endWord}: honours even. ${nameOf(homeId)} ${running[0]}-${running[1]} ${nameOf(awayId)}.`
      : `${endWord}: ${nameOf(teamIds[winner])} win! ${nameOf(homeId)} ${running[0]}-${running[1]} ${nameOf(awayId)}.`,
    scoreAfter: `${running[0]}-${running[1]}`,
  });

  const statNoise = cfg.stats.map(() => rng.float(-1, 1));
  return { cfg, bounds, endsAt, hits, tagHits, timeline: sortTimeline(timeline), rel, shootoutWinner, statNoise };
}

function periodLabel(script: H2HScript, now: number): string {
  const { cfg, bounds } = script;
  for (const b of bounds) {
    if (now >= b.start && now < b.end) {
      const within = ((now - b.start) / (b.end - b.start)) * b.def.clockMin;
      return clockLabel(cfg, b, within);
    }
    if (b.breakAfter && now >= b.end && now < b.end + b.breakAfter.realMin * MINUTE) return b.breakAfter.label;
  }
  return script.shootoutWinner !== null ? 'Shootout' : 'Final minutes';
}

/** The game clock at `now` ("78'", "Q4 2:19", "Half-time"), or null when not live. Cheap. */
export function h2hClock(meta: EventMeta, now: number): string | null {
  if (meta.disruption) return null;
  const script = cachedScript(`h2h:${meta.id}`, () => buildScript(meta));
  if (now < meta.startsAt || now >= script.endsAt) return null;
  return periodLabel(script, now);
}

function statsFor(meta: EventMeta, script: H2HScript, now: number, progress: number): StatsSection[] {
  if (progress <= 0) return [preMatchNote(meta)];
  const { cfg, bounds, hits, tagHits, rel } = script;
  const [homeId, awayId] = meta.competitorIds;
  const columns = ['Team', ...bounds.map((b) => b.def.short), 'T'];
  const rows = [0, 1].map((side) => {
    const cells = bounds.map((b, i) => (now < b.start ? '–'
      : String(hits.filter((h) => h.side === side && h.period === i && h.at <= now).reduce((a, h) => a + h.points, 0))));
    const total = hits.filter((h) => h.side === side && h.at <= now).reduce((a, h) => a + h.points, 0);
    const id = side === 0 ? homeId : awayId;
    return { key: id, competitorId: id, cells: [shortOf(id), ...cells, String(total)], emphasis: true };
  });

  const items = cfg.stats.map((def, i) => {
    const noise = script.statNoise[i];
    if (def.kind === 'possession') {
      const home = Math.round(50 + (rel - 0.5) * 30 + noise * 4);
      return { label: def.label, home, away: 100 - home, suffix: '%' };
    }
    if (def.kind === 'count') {
      const count = (side: number) => tagHits.filter((t) => t.side === side && t.at <= now && def.tags.includes(t.tag)).length;
      const base = (def.base ?? 0) * progress;
      return { label: def.label, home: Math.round(count(0) + base * (0.8 + rel * 0.4)), away: Math.round(count(1) + base * (1.2 - rel * 0.4)) };
    }
    if (def.suffix === '%') {
      return { label: def.label, home: Math.round(def.mean + noise * def.spread * 0.5 + (rel - 0.5) * 8),
        away: Math.round(def.mean - noise * def.spread * 0.4 - (rel - 0.5) * 8), suffix: '%' };
    }
    const scale = progress * def.mean;
    return { label: def.label, home: Math.max(0, Math.round(scale * (1 + (rel - 0.5) * 0.4 + noise * def.spread / def.mean * 0.3))),
      away: Math.max(0, Math.round(scale * (1 - (rel - 0.5) * 0.4 - noise * def.spread / def.mean * 0.3))) };
  });

  const byPlayer = new Map<string, { side: number; pts: number }>();
  for (const h of hits) {
    if (h.at > now) continue;
    const key = `${h.side}|${h.player}`;
    const cur = byPlayer.get(key) ?? { side: h.side, pts: 0 };
    cur.pts += h.points;
    byPlayer.set(key, cur);
  }
  const top = [...byPlayer.entries()].sort((a, b) => b[1].pts - a[1].pts).slice(0, 6);
  const sections: StatsSection[] = [
    { type: 'table', title: 'Scoring by period', columns, rows },
    { type: 'compare', title: 'Match stats', items },
  ];
  if (top.length > 0) {
    sections.push({
      type: 'table', title: 'Top scorers', columns: ['Player', 'Team', cfg.totalWord === 'goals' ? 'Goals' : 'Pts'],
      rows: top.map(([key, v]) => ({ key, cells: [key.split('|')[1], shortOf(v.side === 0 ? homeId : awayId), String(v.pts)] })),
    });
  }
  return sections;
}

/** Average combined score for a sport, used to set over/under lines. */
export function expectedTotal(cfg: H2HConfig): number {
  return Math.round(cfg.scoring.reduce(
    (a, t) => a + t.mean * 2 * (t.points + (t.follow ? t.follow.chance * t.follow.points : 0)), 0));
}

export function simulateH2H(meta: EventMeta, now: number): EventState {
  if (meta.disruption) return disruptedState(meta);
  const script = cachedScript(`h2h:${meta.id}`, () => buildScript(meta));
  const status = statusAt(meta, script.endsAt, now);
  const progress = progressAt(meta, script.endsAt, now);
  const [homeId, awayId] = meta.competitorIds;
  const scored = (side: number) => script.hits.filter((h) => h.side === side && h.at <= now);
  const points = [0, 1].map((s) => scored(s).reduce((a, h) => a + h.points, 0));
  const finished = status === 'finished';
  const winner = points[0] > points[1] ? 0 : points[1] > points[0] ? 1 : script.shootoutWinner;

  const entries: EntryState[] = [homeId, awayId].map((id, side) => {
    const counts: Record<string, number> = {};
    for (const h of scored(side)) counts[h.tag] = (counts[h.tag] ?? 0) + 1;
    return {
      competitorId: id,
      role: side === 0 ? 'home' : 'away',
      score: status === 'scheduled' ? null : points[side],
      scoreText: status !== 'scheduled' && script.cfg.scoreText ? script.cfg.scoreText(counts, points[side]) : null,
      position: null,
      isWinner: finished ? (winner === null ? null : winner === side) : null,
      note: finished && script.shootoutWinner === side ? 'SO' : null,
    };
  });

  const firstHit = script.hits[0];
  const resultText = !finished ? null : winner === null
    ? `Draw, ${points[0]}-${points[1]}`
    : `${nameOf(meta.competitorIds[winner])} won ${Math.max(...points)}-${Math.min(...points)}${script.shootoutWinner !== null ? ' (shootout)' : ''}`;

  return {
    meta,
    status,
    periodLabel: status === 'live' ? periodLabel(script, now) : null,
    progress,
    entries,
    plays: playsUpTo(meta, script.timeline, now),
    stats: statsFor(meta, script, now, progress),
    resultText,
    facts: {
      homeScore: points[0],
      awayScore: points[1],
      total: points[0] + points[1],
      winner: winner === null ? 'draw' : winner === 0 ? 'home' : 'away',
      firstScore: firstHit ? (firstHit.side === 0 ? 'home' : 'away') : 'none',
      expectedTotal: expectedTotal(script.cfg),
    },
    endsAt: script.endsAt,
  };
}

/**
 * Per-player stats for one event (the whole game; readers cut it at "now").
 * TODO(players): attribute every stat to roster players. Until then nobody scores.
 */
export function h2hGameStats(meta: EventMeta): GameStats {
  return emptyGameStats(meta);
}
