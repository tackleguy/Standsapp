// Players and per-game stats, shared by every sport.
//
// Team sports (soccer, football, basketball, cricket...) have rosters of named
// players. Individual sports (F1, tennis, golf, MMA...) use the athletes
// themselves as players, with the athlete's competitor id as the player id.

/** A running stat line: stat key -> number. Keys are listed per sport in `sports/`. */
export type StatLine = Record<string, number>;

export interface Player {
  /** Roster players: `${teamId}.p${n}`. Athletes: their competitor id. */
  id: string;
  sportId: string;
  /** The team they play for (an F1 driver's constructor), or null for solo athletes. */
  teamId: string | null;
  /** The competitor that takes part in events for them: the team, or the athlete. */
  sideId: string;
  name: string; // "Arlo Okoro"
  short: string; // "A. Okoro"
  /** Position code: "QB", "GK", "PG", "Driver"... */
  pos: string;
  /** Position name: "Quarterback", "Goalkeeper"... */
  posLabel: string;
  number: number | null;
  /** Hidden skill 0..1 used by the simulators. */
  skill: number;
  /** 1 = starter / first choice, 2+ = bench or depth. */
  depth: number;
  /** True for athletes in individual sports (the player is the competitor). */
  athlete: boolean;
  rookie: boolean;
}

/** One thing a player did, at one moment. Stats are increments (added up over a game). */
export interface StatEvent {
  /** Real time it happened (ms). Same `at` as the play it belongs to, when there is one. */
  at: number;
  /** Index into GameStats.periods. */
  period: number;
  playerId: string;
  stats: StatLine;
}

export interface GameStats {
  /** Period names in order, for the rating breakdown: ['Q1','Q2','Q3','Q4'], ['1H','2H'], ['Set 1'...]. */
  periods: string[];
  /** Who took part, per side, in the order of meta.competitorIds. */
  lineups: { competitorId: string; playerIds: string[] }[];
  /** Every stat event in the game, oldest first (the whole game; cut at `now` when reading). */
  events: StatEvent[];
}

export interface GridCell {
  label: string;
  value: (l: StatLine) => string;
}

export interface PositionSlot {
  pos: string;
  label: string;
  /** How many of this position each team names. */
  count: number;
  /** How many of them start (the rest are depth/bench). Defaults to all. */
  starters?: number;
  /** Jersey number range. */
  numbers: [number, number];
}

/** Everything about how one sport counts stats and fantasy points. */
export interface SportStatsDef {
  sportId: string;
  /** Team sports: the squad every team names. Empty for individual sports. */
  positions: PositionSlot[];
  /** Individual sports: what an athlete is called ("Driver", "Golfer"). */
  athletePos?: { pos: string; label: string };
  /** Stat key -> short caps label ("YDS", "G", "PTS"). */
  labels: Record<string, string>;
  /** Keys that keep the biggest value instead of adding up (longest gain...). */
  maxKeys?: string[];
  /** Fantasy points per unit of each stat. */
  fantasy: Record<string, number>;
  /** "255 yds 3 td 3 rec", for the top of the player page. */
  headline: (l: StatLine, pos: string) => string;
  /** Short running line under a play in the feed: "13 yd, 1 rec". `role` is the player's part in the play. */
  feedLine: (l: StatLine, pos: string, role?: string) => string;
  /** Stat grid rows for the player page (fantasy points are added by the screen). */
  grid: (pos: string) => GridCell[][];
}
