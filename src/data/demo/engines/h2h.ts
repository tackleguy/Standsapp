// Generic simulator for two-sided team sports (soccer, rugby, basketball, and more).
// It writes the whole match script up front from a seed, then reveals it as real
// time passes, so every phone sees the same live match.
//
// Roster players make the plays: each play names the players who get the credit,
// and h2hGameStats() adds up every player's game, including the everyday stats
// (tackles, rebounds, carries...) the feed never shows. Players are chosen from
// their own seeds, so they never change a score, a result, or how a Call settles.
import { MINUTE } from '@/lib/format';
import { createRng, type Rng } from '@/lib/random';

import type { EntryState, EventMeta, EventState, StatsSection } from '../../types';
import { rosterFor } from '../players/roster';
import type { GameStats, Player, StatEvent, StatLine } from '../players/types';
import { squadFor, venueFor, competitorById } from '../world';
import {
  cachedScript, disruptedState, emptyGameStats, fill, impactOf, mmss, nameOf, playsUpTo, preMatchNote, progressAt, shortOf,
  sortTimeline, statusAt, strengthOf, type TimedPlay,
} from './common';
import { H2H_CONFIGS, type H2HConfig, type PeriodDef, type PlayerModel, type PlayModel, type PosWeights } from './h2hSports';

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
  /** Name shown in the top scorers table. */
  player: string;
  /** Roster player id, when the sport has rosters. */
  playerId: string | null;
  period: number;
}

/** A roster player's time in one game. */
interface OnField {
  player: Player;
  side: 0 | 1;
  /** Real times they came on and went off. `on` is Infinity for a bench player who never came on. */
  on: number;
  off: number;
  /** Spells in the sin bin (real times). */
  out: [number, number][];
  /** Share of the playing time in squads that rotate (1 = a full starter). */
  share: number;
  /** How well they are playing today: scales how often they get involved. */
  form: number;
}

interface Squad {
  model: PlayerModel;
  sides: [OnField[], OnField[]];
  kickers: [OnField | null, OnField | null];
  /** Stat events from the plays themselves (scoring hits included, shown in the feed or not). */
  credits: StatEvent[];
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
  winner: 0 | 1 | null;
  statNoise: number[];
  /** Roster players in the game. Null for sports still using made-up names. */
  squad: Squad | null;
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
  /** Made-up name, for sports without player rosters. */
  player: string;
}

type TimedDraft = Draft & { at: number };

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
  // Sports with rosters pick real players later, from their own seed. Every pick
  // here still draws its number from the script's seed, exactly as before, so
  // no score, time or result ever moves.
  const legacy = cfg.players ? null : [squadFor(homeId, 14), squadFor(awayId, 14)];
  const pickPlayer = (side: 0 | 1) => {
    const r = rng.next();
    return legacy ? legacy[side][Math.floor(Math.pow(r, 1.7) * legacy[side].length)] : '';
  };
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
          const kicker = legacy ? legacy[side][(side + 9) % legacy[side].length] : '';
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
      const template = detailRng.pick(det.templates);
      const r = detailRng.next();
      const player = legacy ? legacy[side][Math.floor(Math.pow(r, 1.25) * legacy[side].length)] : '';
      drafts.push({ ...pos, side, kind: 'flavor', tag: det.tag, points: 0, importance: det.importance, show: true, template, player });
    }
  }

  // Turn drafts into a timeline with running scores.
  const teamIds = [homeId, awayId];
  const ordered: TimedDraft[] = drafts
    .map((d) => ({ ...d, at: realTime(bounds[d.period], d.within) }))
    .sort((a, b) => a.at - b.at);
  const running = [0, 0];
  const timeline: TimedPlay[] = [];
  const hits: ScoreHit[] = [];
  const tagHits: H2HScript['tagHits'] = [];
  const venue = competitorById(homeId) ? venueFor(competitorById(homeId)!) : meta.venue;
  timeline.push({ at: meta.startsAt, clock: cfg.clock === 'up' ? "1'" : `${cfg.periods[0].short} ${mmss(cfg.periods[0].clockMin)}`,
    description: fill(cfg.startText, { team: nameOf(homeId), venue }), competitorId: null, importance: 1, tag: 'START', scoreAfter: '0-0' });

  const playersRng = createRng(`players:${meta.id}`);
  const squad = cfg.players ? buildSquad(meta, cfg.players, bounds, totalClock, playersRng) : null;

  for (const d of ordered) {
    const b = bounds[d.period];
    if (d.at >= endsAt) continue;
    tagHits.push({ at: d.at, side: d.side, tag: d.tag });
    const before = [running[0], running[1]];
    if (d.points > 0) running[d.side] += d.points;
    const values = { player: d.player, team: nameOf(teamIds[d.side]), opp: nameOf(teamIds[1 - d.side]) };
    const gameFraction = Math.min(1, (b.clockBefore + d.within) / totalClock);
    const cast = squad ? castPlay(squad, d, values, before, [running[0], running[1]], gameFraction, b, playersRng) : null;
    if (d.points > 0) {
      hits.push({ at: d.at, side: d.side, points: d.points, tag: d.tag, period: d.period,
        player: cast?.actor?.short ?? d.player, playerId: cast?.actor?.id ?? null });
    }
    if (!d.show) continue;
    timeline.push({
      at: d.at,
      clock: clockLabel(cfg, b, d.within),
      description: cast ? cast.description : fill(d.template, values),
      competitorId: teamIds[d.side],
      importance: d.importance,
      tag: d.tag,
      scoreAfter: d.points > 0 ? `${running[0]}-${running[1]}` : null,
      ...cast?.card,
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
  return { cfg, bounds, endsAt, hits, tagHits, timeline: sortTimeline(timeline), rel, shootoutWinner, winner, statNoise, squad };
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

/** Better players get more of the ball: a weight from 0.55 (weakest) to 1.35 (best), to a power. */
function ability(p: Player, star: number): number {
  return Math.pow(0.35 + p.skill, star);
}

function isOn(p: OnField, at: number): boolean {
  if (at < p.on || at >= p.off) return false;
  for (const [from, to] of p.out) if (at >= from && at < to) return false;
  return true;
}

function pickWeighted<T>(rng: Rng, items: readonly T[], weight: (item: T) => number): T | null {
  let total = 0;
  for (const item of items) total += Math.max(0, weight(item));
  if (total <= 0) return null;
  let r = rng.next() * total;
  let last: T | null = null;
  for (const item of items) {
    const w = Math.max(0, weight(item));
    if (w <= 0) continue;
    last = item;
    r -= w;
    if (r < 0) return item;
  }
  return last;
}

/**
 * A player on one side who is on the field at `at`, by position, share of the
 * time, form and skill. Falls back to anyone on the field (then anyone who
 * played) so a play always has someone to credit.
 */
function choose(sq: Squad, side: 0 | 1, at: number, pos: PosWeights, star: number, exclude: readonly OnField[], rng: Rng): OnField | null {
  const pool = sq.sides[side].filter((p) => isOn(p, at) && !exclude.includes(p));
  return pickWeighted(rng, pool, (p) => (pos[p.player.pos] ?? 0) * p.share * p.form * ability(p.player, star))
    ?? pickWeighted(rng, pool, (p) => p.share)
    ?? pickWeighted(rng, sq.sides[side].filter((p) => p.on !== Infinity && !exclude.includes(p)), (p) => p.share + 0.01);
}

/** Who is in the game, who comes on when, and who takes the goal kicks. */
function buildSquad(meta: EventMeta, model: PlayerModel, bounds: PeriodBound[], totalClock: number, rng: Rng): Squad {
  const sides = [0, 1].map((side) => {
    const seen: Record<string, number> = {};
    return rosterFor(meta.competitorIds[side]).map((player): OnField => {
      const index = seen[player.pos] ?? 0;
      seen[player.pos] = index + 1;
      const form = Math.exp(rng.normal(0, 0.6));
      const base: OnField = { player, side: side as 0 | 1, on: Infinity, off: Infinity, out: [], share: 1, form };
      if (model.rotation) {
        const byPos = model.rotation.byPos?.[player.pos];
        const share = byPos ? (byPos[index] ?? 0) : player.depth === 1 ? 1 : model.rotation.bench;
        return share > 0 ? { ...base, on: meta.startsAt, share: share * rng.float(0.85, 1.15) } : { ...base, share: 0 };
      }
      return player.depth === 1 ? { ...base, on: meta.startsAt } : base;
    });
  }) as [OnField[], OnField[]];

  // Unseen substitutions: a bench player comes on for a starter in the same position.
  const subs = model.subs;
  if (subs) {
    const regulation = bounds.filter((b) => b.clockBefore < totalClock);
    const breakStarts = regulation.filter((b, i) => i > 0 && b.clockBefore / totalClock >= subs.from && b.clockBefore / totalClock <= subs.to);
    for (const list of sides) {
      for (const sub of list) {
        if (sub.player.depth === 1 || !rng.chance(subs.chance)) continue;
        let at: number;
        if (subs.atBreak) {
          if (!breakStarts.length) continue;
          at = rng.pick(breakStarts).start;
        } else {
          let clock = rng.float(subs.from, subs.to) * totalClock;
          const b = regulation.find((x) => clock < x.clockBefore + x.def.clockMin) ?? regulation[regulation.length - 1];
          clock = Math.min(clock - b.clockBefore, b.def.clockMin - 0.01);
          at = realTime(b, clock);
        }
        const replaced = pickWeighted(rng, list.filter((p) => p.player.pos === sub.player.pos && p.off === Infinity && isOn(p, at)),
          (p) => 1.45 - p.player.skill);
        if (!replaced) continue;
        replaced.off = at;
        sub.on = at;
      }
    }
  }

  const kickerOf = (list: OnField[]) => (model.kicker
    ? pickWeighted(rng, list.filter((p) => p.on === meta.startsAt), (p) => (model.kicker?.[p.player.pos] ?? 0) * ability(p.player, 3))
    : null);
  return { model, sides, kickers: [kickerOf(sides[0]), kickerOf(sides[1])], credits: [] };
}

interface Cast {
  description: string;
  actor: Player | null;
  card: Partial<Pick<TimedPlay, 'playerIds' | 'playerRoles' | 'headline' | 'impact' | 'period'>>;
}

function addStats(into: StatLine, add: StatLine): StatLine {
  for (const key of Object.keys(add)) into[key] = (into[key] ?? 0) + add[key];
  return into;
}

/** How much a score swings the game: levelling, taking the lead, late in a close game. */
function swing(model: PlayerModel, side: 0 | 1, before: number[], after: number[], gameFraction: number): number {
  const was = before[side] - before[1 - side];
  const now = after[side] - after[1 - side];
  let lev = 0;
  if (was < 0 && now >= 0) lev += now === 0 ? 1.2 : 1.8;
  else if (was === 0 && now > 0) lev += 1.2;
  if (gameFraction > 0.75 && Math.abs(now) <= model.close) lev += (1.5 * (gameFraction - 0.75)) / 0.25;
  return lev * model.leverage;
}

const RESHUFFLE = '{team} reshuffle: {player} pushes further forward.';

/** Puts roster players into one play: who did it, what they are credited with, and the play card. */
function castPlay(
  sq: Squad, d: TimedDraft, values: Record<string, string>, before: number[], after: number[], gameFraction: number,
  bound: PeriodBound, rng: Rng,
): Cast {
  const { model } = sq;
  const side = d.side;
  const opp = (1 - side) as 0 | 1;
  const at = d.at;
  const pm: PlayModel | undefined = model.plays[d.tag];
  const credit = (p: OnField, stats: StatLine | undefined) => {
    if (stats && Object.keys(stats).length > 0) sq.credits.push({ at, period: d.period, playerId: p.player.id, stats: { ...stats } });
  };
  const rated = (base: number) => impactOf(base + (d.points > 0 ? swing(model, side, before, after, gameFraction) : 0) + rng.float(-0.3, 0.3));

  // A play that names nobody (a corner, a timeout) stays as it is.
  if (!d.template.includes('{player}') && d.points === 0) {
    return { description: fill(d.template, values), actor: null, card: { period: d.period } };
  }

  // A substitution brings a bench player on for a tired team-mate in the same position.
  if (model.subTag === d.tag) {
    const bench = sq.sides[side].filter((p) => p.on === Infinity && p.player.depth > 1);
    const sub = pickWeighted(rng, bench, (p) => p.form * ability(p.player, 1));
    const onPitch = sq.sides[side].filter((p) => isOn(p, at) && (!pm || (pm.pos[p.player.pos] ?? 0) > 0));
    const same = onPitch.filter((p) => p.player.pos === sub?.player.pos);
    const off = pickWeighted(rng, same.length ? same : onPitch, (p) => 1.45 - p.player.skill);
    if (sub && off) {
      off.off = at;
      sub.on = at;
      credit(sub, model.appearance);
      return {
        description: fill(d.template, { ...values, player: sub.player.short, off: off.player.short }),
        actor: sub.player,
        card: { playerIds: [sub.player.id, off.player.id], playerRoles: ['on', 'off'], headline: pm?.headline ?? 'Substitution',
          impact: rated(pm?.impact ?? 1), period: d.period },
      };
    }
    // Nobody left on the bench: a change of shape instead.
    const mover = choose(sq, side, at, pm?.pos ?? {}, 1, [], rng);
    return {
      description: fill(RESHUFFLE, { ...values, player: mover?.player.short ?? '' }),
      actor: mover?.player ?? null,
      card: mover ? { playerIds: [mover.player.id], playerRoles: ['move'], headline: 'Tactical change', impact: rated(1), period: d.period }
        : { period: d.period },
    };
  }

  // The main actor: the {player} in the template.
  let pos: PosWeights = pm?.pos ?? {};
  for (const c of pm?.posIf ?? []) {
    if (c.when.test(d.template)) {
      pos = c.pos;
      break;
    }
  }
  const kicker = pm?.kicker ? sq.kickers[side] : null;
  const actor = (kicker && isOn(kicker, at) ? kicker : null)
    ?? (pm?.kicker ? choose(sq, side, at, sq.model.kicker ?? pos, 3, [], rng) : null)
    ?? choose(sq, side, at, pos, pm?.star ?? 1, [], rng);
  if (!actor) return { description: fill(d.template, values), actor: null, card: { period: d.period } };

  let stats: StatLine = { ...(pm?.stats ?? {}) };
  for (const c of pm?.statsIf ?? []) {
    if (c.when.test(d.template)) stats = c.replace ? { ...c.stats } : addStats(stats, c.stats);
  }
  for (const [key, [lo, hi]] of Object.entries(pm?.amounts ?? {})) {
    const said = key === 'm' ? /(\d+) metres/.exec(d.template) : null;
    stats[key] = (stats[key] ?? 0) + (said ? Number(said[1]) : rng.int(lo, hi));
  }

  // Everyone else in the play.
  const filled = new Map<string, OnField>();
  const taken: OnField[] = [actor];
  const unnamed: string[] = [];
  const shown: { p: OnField; role: string; lead: boolean }[] = [{ p: actor, role: pm?.role ?? 'play', lead: false }];
  for (const r of pm?.roles ?? []) {
    if (r.actorPos && !r.actorPos.includes(actor.player.pos)) continue;
    if (r.needs && !filled.has(r.needs)) continue;
    const named = d.template.includes(`{${r.key}}`);
    if (!named && !r.silent) {
      if (r.chance === undefined || r.unless?.test(d.template) || !rng.chance(r.chance)) continue;
    }
    const p = choose(sq, r.side === 'own' ? side : opp, at, r.pos, 1, taken, rng);
    if (!p) continue;
    filled.set(r.key, p);
    taken.push(p);
    credit(p, r.stats);
    if (r.silent) continue;
    if (!named) unnamed.push(p.player.short);
    shown.push({ p, role: r.role, lead: !!r.lead });
  }
  credit(actor, stats);

  if (model.sendOff?.includes(d.tag)) actor.off = at;
  if (model.sinBin?.tags.includes(d.tag)) {
    actor.out.push([at, at + model.sinBin.minutes * ((bound.end - bound.start) / bound.def.clockMin)]);
  }
  if (d.points > 0 && model.plusMinus && !model.plusMinus.skip.test(d.template)) {
    plusMinus(sq, d, [actor, ...filled.values()].filter((p) => p.side === side), rng);
  }

  const named: Record<string, string> = { ...values, player: actor.player.short };
  for (const [key, p] of filled) named[key] = p.player.short;
  let description = fill(d.template, named);
  if (unnamed.length && model.assistText) description += model.assistText(unnamed);

  shown.sort((a, b) => Number(b.lead) - Number(a.lead));
  const headline = pm?.headlineIf?.find((h) => h.when.test(d.template))?.headline ?? pm?.headline ?? 'Play';
  const base = pm?.impactIf?.find((h) => h.when.test(d.template))?.impact ?? pm?.impact ?? 1;
  return {
    description,
    actor: actor.player,
    card: { playerIds: shown.map((s) => s.p.player.id), playerRoles: shown.map((s) => s.role), headline, impact: rated(base), period: d.period },
  };
}

/** +1 for the scoring team's skaters on the ice, -1 for the other team's. */
function plusMinus(sq: Squad, d: TimedDraft, involved: OnField[], rng: Rng): void {
  const spec = sq.model.plusMinus;
  if (!spec) return;
  for (const side of [d.side, 1 - d.side] as (0 | 1)[]) {
    const onIce: OnField[] = side === d.side ? [...involved] : [];
    for (const group of spec.groups) {
      let have = onIce.filter((p) => group.pos.includes(p.player.pos)).length;
      const pool = sq.sides[side].filter((p) => group.pos.includes(p.player.pos) && isOn(p, d.at) && !onIce.includes(p));
      while (have < group.count && pool.length) {
        const p = pickWeighted(rng, pool, (x) => x.share);
        if (!p) break;
        pool.splice(pool.indexOf(p), 1);
        onIce.push(p);
        have++;
      }
    }
    const value = side === d.side ? 1 : -1;
    for (const p of onIce) sq.credits.push({ at: d.at, period: d.period, playerId: p.player.id, stats: { [spec.key]: value } });
  }
}

/** A count with the given average: Poisson for small ones, a bell curve for big ones. */
function countOf(rng: Rng, mean: number): number {
  if (mean <= 0) return 0;
  if (mean < 40) return rng.poisson(mean);
  return Math.max(0, Math.round(rng.normal(mean, Math.sqrt(mean) * 3.46)));
}

/** Splits `total` minutes by weight, nobody above `cap`, in whole minutes that add up to `total`. */
function splitMinutes(weights: number[], total: number, cap: number): number[] {
  const out = weights.map(() => 0);
  let free = weights.map((_, i) => i).filter((i) => weights[i] > 0);
  let left = total;
  while (free.length && left > 0) {
    const sum = free.reduce((a, i) => a + weights[i], 0);
    const capped = free.filter((i) => (left * weights[i]) / sum >= cap);
    if (!capped.length) {
      for (const i of free) out[i] = (left * weights[i]) / sum;
      break;
    }
    for (const i of capped) out[i] = cap;
    left -= capped.length * cap;
    free = free.filter((i) => !capped.includes(i));
  }
  const whole = out.map(Math.floor);
  let rest = Math.round(total - whole.reduce((a, b) => a + b, 0));
  const order = out.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (rest <= 0) break;
    if (whole[i] >= cap || weights[i] <= 0) continue;
    whole[i]++;
    rest--;
  }
  return whole;
}

/**
 * Per-player stats for one event (the whole game; readers cut it at "now"):
 * what the plays credited, plus the everyday stats spread over the game,
 * minutes, and full-time awards (clean sheets, a goalie's win or shutout).
 */
export function h2hGameStats(meta: EventMeta): GameStats {
  const script = cachedScript(`h2h:${meta.id}`, () => buildScript(meta));
  const { bounds, squad: sq } = script;
  const periods = bounds.map((b) => b.def.short);
  if (!sq) return emptyGameStats(meta, periods);
  const { model } = sq;
  const rng = createRng(`players-fill:${meta.id}`);
  const lastAt = script.endsAt - 1;
  const lastPeriod = bounds.length - 1;
  const events: StatEvent[] = [...sq.credits];
  const push = (at: number, period: number, p: OnField, stats: StatLine) => {
    events.push({ at, period, playerId: p.player.id, stats });
  };

  // Real time actually played in each period (no breaks, nothing after the end).
  const spans = bounds.map((b, i) => ({ i, b, from: b.start, to: Math.min(b.end, lastAt) })).filter((s) => s.to > s.from);
  const played = spans.reduce((a, s) => a + (s.to - s.from), 0);
  const regulationClock = script.cfg.periods.reduce((a, p) => a + p.clockMin, 0);
  const regulation = spans.filter((s) => s.b.clockBefore < regulationClock).reduce((a, s) => a + (s.b.end - s.b.start), 0);
  const lengthScale = played / Math.max(1, regulation);
  const randomMoment = () => {
    let r = rng.next() * played;
    for (const s of spans) {
      const len = s.to - s.from;
      if (r < len) return { at: Math.floor(s.from + r), period: s.i };
      r -= len;
    }
    const s = spans[spans.length - 1];
    return { at: s.to - 1, period: s.i };
  };

  // Everyday stats, spread over the game. Who is on the field only changes at a
  // few moments (substitutions, sin bins), so each stretch between them gets one
  // weight table per stat instead of weighing the whole squad for every tackle.
  const changes = [0, 1].map((side) => [...new Set(sq.sides[side].flatMap((p) => [p.on, p.off, ...p.out.flat()]))]
    .filter((t) => Number.isFinite(t) && t > meta.startsAt).sort((a, b) => a - b));
  const stretchOf = (side: number, at: number) => {
    let i = 0;
    while (i < changes[side].length && changes[side][i] <= at) i++;
    return i;
  };
  const tables = new Map<string, { items: OnField[]; cum: number[] }>();
  const tableFor = (f: number, side: 0 | 1, stretch: number) => {
    const key = `${f}|${side}|${stretch}`;
    let table = tables.get(key);
    if (!table) {
      const from = stretch === 0 ? meta.startsAt : changes[side][stretch - 1];
      const pos = model.filler[f].pos;
      const items = sq.sides[side].filter((p) => isOn(p, from) && (pos[p.player.pos] ?? 0) > 0);
      let total = 0;
      const cum = items.map((p) => (total += pos[p.player.pos] * p.share * p.form * ability(p.player, 1)));
      table = { items, cum };
      tables.set(key, table);
    }
    return table;
  };
  const pickFiller = (f: number, side: 0 | 1, at: number): OnField | null => {
    const { items, cum } = tableFor(f, side, stretchOf(side, at));
    if (!items.length) return choose(sq, side, at, model.filler[f].pos, 1, [], rng);
    const r = rng.next() * cum[cum.length - 1];
    let i = 0;
    while (i < cum.length - 1 && cum[i] <= r) i++;
    return items[i];
  };
  model.filler.forEach((f, fi) => {
    for (const side of [0, 1] as const) {
      const strength = side === 0 ? script.rel : 1 - script.rel;
      const mean = f.perTeam * lengthScale * Math.max(0.2, 1 + (f.lean ?? 0) * (strength - 0.5) * 2);
      const n = countOf(rng, mean);
      for (let k = 0; k < n; k++) {
        const { at, period } = randomMoment();
        const p = pickFiller(fi, side, at);
        if (!p) continue;
        const stats: StatLine = { ...f.stats };
        if (f.amount) {
          const [lo, hi] = f.amount.byPos[p.player.pos] ?? [0, 0];
          stats[f.amount.key] = (stats[f.amount.key] ?? 0) + rng.int(lo, hi);
        }
        push(at, period, p, stats);
        for (const w of f.with ?? []) {
          if (!rng.chance(w.chance)) continue;
          const q = choose(sq, w.side === 'own' ? side : (1 - side) as 0 | 1, at, w.pos, 1, [p], rng);
          if (q) push(at, period, q, { ...w.stats });
          break;
        }
      }
    }
  });

  const tookPart = (p: OnField) => p.on < script.endsAt;
  const everyone = [...sq.sides[0], ...sq.sides[1]].filter(tookPart);

  // Clock minutes each player was on the field, per period.
  const minutesIn = (p: OnField, s: (typeof spans)[number]) => {
    const from = Math.max(p.on, s.from);
    const to = Math.min(p.off, s.to);
    return to > from ? ((to - from) / (s.b.end - s.b.start)) * s.b.def.clockMin : 0;
  };

  if (model.appearance) {
    for (const p of everyone) if (p.on === meta.startsAt) push(meta.startsAt, 0, p, { ...model.appearance });
  }
  if (model.minutes === 'played') {
    for (const p of everyone) {
      for (const s of spans) {
        const min = Math.round(minutesIn(p, s));
        if (min > 0) push(p.off > s.from && p.off <= s.to ? p.off : s.to, s.i, p, { min });
      }
    }
  } else if (model.minutes === 'shared') {
    for (const side of [0, 1] as const) {
      const list = sq.sides[side].filter(tookPart);
      for (const s of spans) {
        const clock = Math.round(((s.to - s.from) / (s.b.end - s.b.start)) * s.b.def.clockMin);
        const extra = s.b.clockBefore >= regulationClock;
        const weights = list.map((p) => (extra ? Math.pow(p.share, 3) : p.share) * rng.float(0.75, 1.25));
        const onCourt = Math.min(5, list.length);
        splitMinutes(weights, clock * onCourt, clock).forEach((min, i) => {
          if (min > 0) push(s.to, s.i, list[i], { min });
        });
      }
    }
  }

  // Full-time awards.
  if (model.cleanSheet) {
    const cs = model.cleanSheet;
    for (const p of everyone) {
      if (!cs.pos.includes(p.player.pos)) continue;
      const minutes = spans.reduce((a, s) => a + minutesIn(p, s), 0);
      const conceded = script.hits.some((h) => h.side !== p.side && h.at >= p.on && h.at < p.off);
      if (minutes >= cs.minMinutes && !conceded) push(lastAt, lastPeriod, p, { ...cs.stats });
    }
  }
  if (model.goalie) {
    const g = model.goalie;
    const totals = [0, 1].map((s) => script.hits.filter((h) => h.side === s).reduce((a, h) => a + h.points, 0));
    for (const p of everyone) {
      if (p.player.pos !== g.pos) continue;
      if (script.winner === p.side) push(lastAt, lastPeriod, p, { ...g.win });
      if (totals[1 - p.side] === 0) push(lastAt, lastPeriod, p, { ...g.shutout });
    }
  }

  events.sort((a, b) => a.at - b.at);
  return {
    periods,
    lineups: meta.competitorIds.map((competitorId, side) => ({
      competitorId,
      playerIds: (sq.sides[side] ?? []).filter(tookPart).map((p) => p.player.id),
    })),
    events,
  };
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

  const byPlayer = new Map<string, { side: number; name: string; pts: number }>();
  for (const h of hits) {
    if (h.at > now) continue;
    const key = `${h.side}|${h.playerId ?? h.player}`;
    const cur = byPlayer.get(key) ?? { side: h.side, name: h.player, pts: 0 };
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
      rows: top.map(([key, v]) => ({ key, cells: [v.name, shortOf(v.side === 0 ? homeId : awayId), String(v.pts)] })),
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
