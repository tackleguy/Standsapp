// Win probability: who is likely to win, before and during a game.
// Pure maths (no data imports) so it can move to the server unchanged.
//
// Low-scoring sports (soccer, hockey, baseball) model the goals still to come
// as Poisson counts; high-scoring sports model the final margin as a normal
// curve that tightens as the clock runs down. Tennis, cricket and fights have
// their own small models.
import type { EventState } from '@/data/types';

export interface WinProb {
  home: number;
  draw: number;
  away: number;
}

type Model =
  | { kind: 'poisson'; rate: number; draws: boolean }
  | { kind: 'normal'; sigma: number; draws: boolean };

/** Scoring models for two-sided team sports. */
export const SPORT_MODELS: Record<string, Model> = {
  soccer: { kind: 'poisson', rate: 1.35, draws: true },
  ice_hockey: { kind: 'poisson', rate: 3.0, draws: false },
  baseball: { kind: 'poisson', rate: 4.4, draws: false },
  basketball: { kind: 'normal', sigma: 12, draws: false },
  american_football: { kind: 'normal', sigma: 13.5, draws: false },
  rugby_union: { kind: 'normal', sigma: 13, draws: true },
  rugby_league: { kind: 'normal', sigma: 12, draws: true },
  aussie_rules: { kind: 'normal', sigma: 30, draws: true },
  netball: { kind: 'normal', sigma: 9, draws: true },
};

export const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

/** Standard normal cumulative distribution (Abramowitz–Stegun 7.1.26). */
export function normalCdf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-(x * x) / 2);
  return x >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

function poissonPmf(mean: number, max: number): number[] {
  const out: number[] = [];
  let p = Math.exp(-mean);
  for (let k = 0; k <= max; k++) {
    out.push(p);
    p = (p * mean) / (k + 1);
  }
  return out;
}

function normalise(p: WinProb): WinProb {
  const total = p.home + p.draw + p.away || 1;
  return { home: p.home / total, draw: p.draw / total, away: p.away / total };
}

export interface InPlayInput {
  sportId: string;
  /** Hidden skill ratings 0..1. */
  homeStrength: number;
  awayStrength: number;
  homeEdge?: number;
  /** Home score minus away score right now. */
  lead: number;
  /** Share of the game still to play, 1 at the start and 0 at the end. */
  remaining: number;
}

/** Two-sided team sports, before or during the game. */
export function inPlayProbability({ sportId, homeStrength, awayStrength, homeEdge = 0.05, lead, remaining }: InPlayInput): WinProb {
  const model = SPORT_MODELS[sportId] ?? SPORT_MODELS.soccer;
  const r = Math.min(1, Math.max(0, remaining));
  const diff = homeStrength + homeEdge - awayStrength;
  // When regulation ends level and the sport needs a winner, the better side is a bit more likely to take it.
  const tieBreak = sigmoid(diff * 3);
  let p: WinProb;
  if (model.kind === 'poisson') {
    const lh = model.rate * Math.exp(diff * 1.2) * r;
    const la = model.rate * Math.exp(-diff * 1.2) * r;
    const max = Math.max(10, Math.ceil(Math.max(lh, la) * 3 + 8));
    const ph = poissonPmf(lh, max);
    const pa = poissonPmf(la, max);
    p = { home: 0, draw: 0, away: 0 };
    for (let h = 0; h <= max; h++) {
      for (let a = 0; a <= max; a++) {
        const m = lead + h - a;
        const w = ph[h] * pa[a];
        if (m > 0) p.home += w;
        else if (m < 0) p.away += w;
        else p.draw += w;
      }
    }
  } else {
    const mean = lead + diff * model.sigma * 2.6 * r;
    const sd = model.sigma * Math.sqrt(r);
    if (sd < 1e-6) {
      p = { home: mean > 0 ? 1 : 0, draw: mean === 0 ? 1 : 0, away: mean < 0 ? 1 : 0 };
    } else {
      const away = normalCdf((-0.5 - mean) / sd);
      const home = 1 - normalCdf((0.5 - mean) / sd);
      p = { home, draw: Math.max(0, 1 - home - away), away };
    }
  }
  if (!model.draws) {
    p = { home: p.home + p.draw * tieBreak, draw: 0, away: p.away + p.draw * (1 - tieBreak) };
  }
  return normalise(p);
}

/** Before the start: the same model with the whole game still to play. */
export function pregameProbability(sportId: string, homeStrength: number, awayStrength: number, homeEdge = 0.05): WinProb {
  return inPlayProbability({ sportId, homeStrength, awayStrength, homeEdge, lead: 0, remaining: 1 });
}

/** Tennis, best of three sets: sets and games in hand plus the players' level. */
export function tennisProbability(setsHome: number, setsAway: number, gamesHome: number, gamesAway: number,
  homeStrength: number, awayStrength: number): WinProb {
  if (setsHome >= 2) return { home: 1, draw: 0, away: 0 };
  if (setsAway >= 2) return { home: 0, draw: 0, away: 1 };
  const z = (setsHome - setsAway) * 1.5 + (gamesHome - gamesAway) * 0.22 + (homeStrength - awayStrength) * 3.5;
  const home = sigmoid(z);
  return { home, draw: 0, away: 1 - home };
}

export interface InningsScore { runs: number; wickets: number; balls: number }

/**
 * T20 cricket. Before the chase: project the first innings against a par
 * score. During the chase: runs needed against what the remaining balls and
 * wickets should produce. Returns the chance the side batting FIRST wins.
 */
export function cricketBattingFirstWins(first: InningsScore, second: InningsScore | null, firstDone: boolean,
  batFirstStrength: number, chaseStrength: number): number {
  const PAR = 168 * (1 + (chaseStrength - batFirstStrength) * 0.25);
  const rateFor = (wicketsLeft: number, strength: number) => 8.4 * Math.pow(Math.max(0, wicketsLeft) / 10, 0.6) * 1.1 * (1 + (strength - 0.5) * 0.25);
  if (!second || (second.balls === 0 && second.runs === 0)) {
    const ballsLeft = firstDone ? 0 : Math.max(0, 120 - first.balls);
    const projected = first.runs + (ballsLeft / 6) * rateFor(10 - first.wickets, batFirstStrength);
    const sd = Math.sqrt(Math.pow(22 * Math.sqrt(ballsLeft / 120), 2) + 22 * 22);
    return normalCdf((projected - PAR) / sd);
  }
  const need = first.runs + 1 - second.runs;
  if (need <= 0) return 0;
  const ballsLeft = Math.max(0, 120 - second.balls);
  const wicketsLeft = 10 - second.wickets;
  if (ballsLeft === 0 || wicketsLeft <= 0) return 1;
  const expected = (ballsLeft / 6) * rateFor(wicketsLeft, chaseStrength);
  const sd = 4 + 20 * Math.sqrt(ballsLeft / 120);
  return 1 - normalCdf((expected - need) / sd);
}

/** "165/5 (20.0 ov)" -> runs 165, wickets 5, balls 120. "Yet to bat" -> null. */
export function parseInnings(text: string | null | undefined): InningsScore | null {
  if (!text) return null;
  const m = /^(\d+)(?:\/(\d+))?\s*\((\d+)(?:\.(\d))?\s*ov/.exec(text.trim());
  if (!m) return null;
  return { runs: Number(m[1]), wickets: m[2] === undefined ? 10 : Number(m[2]), balls: Number(m[3]) * 6 + Number(m[4] ?? 0) };
}

/** Fights: level gap plus knockdowns scored so far. */
export function fightProbability(homeStrength: number, awayStrength: number, knockdownLead: number): WinProb {
  const home = sigmoid((homeStrength - awayStrength) * 3 + knockdownLead * 0.9);
  return { home, draw: 0, away: 1 - home };
}

export interface ProbabilityContext {
  strength: (competitorId: string) => number;
  homeEdge: number;
}

const COMBAT = new Set(['mma', 'boxing']);

/** Win probability for any two-sided event in any state; null for races and fields. */
export function winProbabilityFor(state: EventState, ctx: ProbabilityContext): WinProb | null {
  const p = rawWinProbability(state, ctx);
  // Nothing is certain until the end: like real apps, cap a live game at 99%.
  return p && state.status !== 'finished' ? stillInDoubt(p) : p;
}

/** Keeps each side between 1% and 99%, so a live game never reads 100% or 0%. */
export function stillInDoubt(p: WinProb): WinProb {
  const home = Math.min(0.99, Math.max(0.01, p.home));
  const away = Math.min(0.99, Math.max(0.01, p.away));
  const draw = Math.max(0, p.draw);
  const total = home + away + draw;
  return { home: home / total, draw: draw / total, away: away / total };
}

function rawWinProbability(state: EventState, ctx: ProbabilityContext): WinProb | null {
  const { meta } = state;
  if (meta.format === 'race' || state.status === 'postponed' || state.status === 'cancelled') return null;
  const home = state.entries.find((e) => e.role === 'home');
  const away = state.entries.find((e) => e.role === 'away');
  if (!home || !away) return null;
  if (state.status === 'finished') {
    if (home.isWinner) return { home: 1, draw: 0, away: 0 };
    if (away.isWinner) return { home: 0, draw: 0, away: 1 };
    return { home: 0, draw: 1, away: 0 };
  }
  const sH = ctx.strength(home.competitorId);
  const sA = ctx.strength(away.competitorId);
  const remaining = state.status === 'scheduled' ? 1 : Math.max(0.003, 1 - state.progress);

  if (meta.sportId === 'tennis') {
    const games = (t: string | null) => Number((t ?? '').split(' ').pop() ?? 0) || 0;
    return tennisProbability(home.score ?? 0, away.score ?? 0, games(home.scoreText), games(away.scoreText), sH, sA);
  }
  if (meta.sportId === 'cricket') {
    const batFirstIsHome = state.facts.battingFirst !== 'away';
    const [first, chase] = batFirstIsHome ? [home, away] : [away, home];
    const firstInn = parseInnings(first.scoreText);
    if (!firstInn || state.status === 'scheduled') {
      // Before a ball is bowled the toss is still to come: just the two sides' level.
      const homeP = sigmoid((sH + ctx.homeEdge - sA) * 4);
      return { home: homeP, draw: 0, away: 1 - homeP };
    }
    const chaseInn = parseInnings(chase.scoreText);
    const firstDone = !!chaseInn || firstInn.balls >= 120 || firstInn.wickets >= 10 || first.note !== 'Batting';
    const pFirst = cricketBattingFirstWins(firstInn, chaseInn, firstDone, ctx.strength(first.competitorId), ctx.strength(chase.competitorId));
    return batFirstIsHome ? { home: pFirst, draw: 0, away: 1 - pFirst } : { home: 1 - pFirst, draw: 0, away: pFirst };
  }
  if (COMBAT.has(meta.sportId)) {
    const kd = (id: string) => state.plays.filter((p) => p.tag === 'KNOCKDOWN' && p.competitorId === id).length;
    return fightProbability(sH, sA, kd(home.competitorId) - kd(away.competitorId));
  }
  return inPlayProbability({
    sportId: meta.sportId, homeStrength: sH, awayStrength: sA, homeEdge: ctx.homeEdge,
    lead: (home.score ?? 0) - (away.score ?? 0), remaining,
  });
}

/** Rounded percentages that always add up to 100. */
export function asPercents(p: WinProb, withDraw: boolean): { home: number; draw: number; away: number } {
  if (!withDraw) {
    const home = Math.round((p.home / Math.max(1e-9, p.home + p.away)) * 100);
    return { home, draw: 0, away: 100 - home };
  }
  const home = Math.round(p.home * 100);
  const draw = Math.round(p.draw * 100);
  return { home, draw, away: Math.max(0, 100 - home - draw) };
}

/** Whether a sport can end level. */
export function sportHasDraws(sportId: string): boolean {
  return SPORT_MODELS[sportId]?.draws ?? false;
}
