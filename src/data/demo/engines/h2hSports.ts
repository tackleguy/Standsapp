// Rules and commentary for every two-sided team sport the generic simulator plays.
import type { Importance } from '../../types';
import type { StatLine } from '../players/types';

export interface PeriodDef {
  label: string;
  short: string;
  clockMin: number; // minutes on the game clock
  realMin: number; // minutes of real time it takes, stoppages included
}

export interface FollowUp {
  tag: string;
  points: number;
  chance: number;
  templates: string[];
  missTemplates: string[];
}

export interface ScoreType {
  tag: string;
  points: number;
  mean: number; // average count per side per game
  importance: Importance;
  feedChance: number; // chance the play appears in the feed (score still counts)
  templates: string[];
  follow?: FollowUp;
}

export interface FlavorType {
  tag: string;
  mean: number; // average count per game (both sides)
  importance: Importance;
  templates: string[];
  lateOnly?: boolean;
}

export type StatDef =
  | { label: string; kind: 'count'; tags: string[]; base?: number; suffix?: string }
  | { label: string; kind: 'mean'; mean: number; spread: number; suffix?: string }
  | { label: string; kind: 'possession' };

export interface H2HConfig {
  periods: PeriodDef[];
  breaks: { realMin: number; label: string }[];
  clock: 'up' | 'down';
  scoring: ScoreType[];
  flavor: FlavorType[];
  tie: 'draw' | 'overtime';
  overtime?: PeriodDef & { suddenDeath: boolean; shootout?: boolean };
  homeEdge: number;
  /**
   * How much team strength stretches scoring (1 = fully). High-scoring sports use
   * less, so a strong team wins 118-101, not 171-86.
   */
  strengthSpread?: number;
  /**
   * How much the number of each kind of score varies from game to game, relative
   * to a plain random count (1). Possession sports vary far less in real life.
   */
  countNoise?: number;
  scoreText?: (counts: Record<string, number>, points: number) => string;
  /**
   * Minor moments that make the play-by-play feel complete (shots, fouls,
   * rebounds...). Drawn from their own seed, so adding or tuning them never
   * changes a score, a result, or how a Call settles.
   */
  detail?: FlavorType[];
  stats: StatDef[];
  totalWord: string; // "goals", "points", "runs"
  startText: string;
  /** Who does what, for crediting roster players. Sports without it name made-up players. */
  players?: PlayerModel;
}

// ---------------------------------------------------------------------------
// Players: which roster players make each play, and the everyday stats
// (tackles, rebounds, carries...) that never make the feed.
// ---------------------------------------------------------------------------

/** Position code -> how likely a player there is to do something. Positions left out never do it. */
export type PosWeights = Record<string, number>;

/** Someone else in a play besides the main actor: the assist, the keeper who saves... */
export interface PlayRole {
  /** Placeholder for their name in a template: {assist}, {keeper}, {shooter}... */
  key: string;
  /** From the team making the play, or the other one. */
  side: 'own' | 'opp';
  pos: PosWeights;
  stats?: StatLine;
  /** Their part in the play ("assist", "save"), for the play card. */
  role: string;
  /**
   * When the template does not name them: the chance they are still in the play
   * (an assist). They are then named at the end of the description.
   */
  chance?: number;
  /** Credited but not named or put on the play card (the keeper who concedes). */
  silent?: boolean;
  /** Never when the template matches (no assist on a penalty). */
  unless?: RegExp;
  /** Only when another role was filled (a second assist needs a first). */
  needs?: string;
  /** Only when the actor plays one of these positions. */
  actorPos?: string[];
  /** This player leads the play card instead of the actor (the keeper on a save). */
  lead?: boolean;
}

/** How one kind of play is credited. The actor is the {player} in its templates. */
export interface PlayModel {
  pos: PosWeights;
  /** Other positions when the template matches (a maul try is a forward's). The first match wins. */
  posIf?: { when: RegExp; pos: PosWeights }[];
  /** Taken by the team's goal kicker (conversions, penalty goals). */
  kicker?: boolean;
  stats?: StatLine;
  /** Extra stats when the template matches. `replace` drops the stats added so far. */
  statsIf?: { when: RegExp; stats: StatLine; replace?: boolean }[];
  /** Random amounts per play, e.g. metres gained. A number in the template ("70 metres") wins. */
  amounts?: Record<string, [number, number]>;
  role: string;
  roles?: PlayRole[];
  headline: string;
  headlineIf?: { when: RegExp; headline: string }[];
  /** Rating 0-9.9 before the game situation (equalisers and late winners rate higher). */
  impact: number;
  impactIf?: { when: RegExp; impact: number }[];
  /** How much better players dominate this play: 1 = in line with skill, 2+ = stars take most of them. */
  star?: number;
}

/** Everyday stats the feed does not show, spread over the game. Each one is one event. */
export interface FillerModel {
  stats: StatLine;
  /** Average per team over a full game. */
  perTeam: number;
  pos: PosWeights;
  /** A random amount added with each one (metres per carry), by position. */
  amount?: { key: string; byPos: Record<string, [number, number]> };
  /** How much more of it the stronger team gets (negative: less, e.g. tackles). */
  lean?: number;
  /** Someone else credited at the same moment, tried in order: the keeper's save, the rebound. */
  with?: { chance: number; side: 'own' | 'opp'; pos: PosWeights; stats: StatLine }[];
}

export interface PlayerModel {
  /**
   * Squads that rotate all game (basketball, hockey, Aussie rules) give each
   * player a share of the time; bench players get `bench`, or a share by their
   * place in the depth chart from `byPos` (0 = never plays). Null: starters play
   * until replaced.
   */
  rotation: { bench: number; byPos?: Record<string, number[]> } | null;
  /** Unseen substitutions: each bench player comes on (by chance) between these game fractions, for a starter in the same position. */
  subs?: { chance: number; from: number; to: number; atBreak?: boolean };
  /** The play tag that brings a bench player on (soccer's SUB). */
  subTag?: string;
  /** Play tags that send the player off for good / for a while (game minutes). */
  sendOff?: string[];
  sinBin?: { tags: string[]; minutes: number };
  /** Who takes the team's goal kicks. */
  kicker?: PosWeights;
  plays: Record<string, PlayModel>;
  filler: FillerModel[];
  /** Text added to a description for credited assists the template does not name. */
  assistText?: (names: string[]) => string;
  /** A score margin that still counts as close late on (bigger plays then). */
  close: number;
  /** How much scoring plays gain from tying or taking the lead (1 = fully). */
  leverage: number;
  /** 'played': minutes on the pitch from the substitutions. 'shared': a rotation splits each period. */
  minutes?: 'played' | 'shared';
  /** Starters and subs get an appearance stat when they take the field. */
  appearance?: StatLine;
  /** Credited at full time to these positions with at least `minMinutes`, when nothing was conceded while they played. */
  cleanSheet?: { pos: string[]; minMinutes: number; stats: StatLine };
  /** The goalie's win and shutout at full time. */
  goalie?: { pos: string; win: StatLine; shutout: StatLine };
  /** +/- for the skaters on the ice at each goal (so many from each position group), except when the template matches (power plays). */
  plusMinus?: { key: string; skip: RegExp; groups: { pos: string[]; count: number }[] };
}

const SOCCER_OUTFIELD: PosWeights = { DF: 1, MF: 1, FW: 1 };
const SOCCER_ATTACK: PosWeights = { FW: 5, MF: 3.5, DF: 1 };
const SOCCER_KEEPER: PosWeights = { GK: 1 };

const soccerPlayers: PlayerModel = {
  rotation: null,
  subTag: 'SUB',
  sendOff: ['RED'],
  close: 1,
  leverage: 1,
  minutes: 'played',
  appearance: { app: 1 },
  cleanSheet: { pos: ['GK', 'DF'], minMinutes: 60, stats: { cs: 1 } },
  assistText: ([a]) => ` Assist: ${a}.`,
  plays: {
    GOAL: {
      pos: { FW: 6, MF: 3, DF: 0.9 }, star: 2.2, stats: { g: 1, sh: 1, sot: 1 }, role: 'goal', headline: 'Goal', impact: 6.5,
      posIf: [{ when: /head home/, pos: { FW: 5, DF: 3, MF: 2 } }],
      headlineIf: [{ when: /penalty spot/, headline: 'Penalty' }, { when: /head home/, headline: 'Header' }],
      roles: [
        { key: 'assist', side: 'own', pos: { MF: 5, FW: 3, DF: 2 }, stats: { a: 1, kp: 1 }, role: 'assist', chance: 0.85, unless: /penalty|loose ball/ },
        { key: 'keeper', side: 'opp', pos: SOCCER_KEEPER, stats: { ga: 1 }, role: 'conceded', silent: true },
      ],
    },
    CHANCE: {
      pos: SOCCER_ATTACK, star: 1.5, stats: { sh: 1 }, role: 'shot', headline: 'Big chance', impact: 3.5,
      statsIf: [{ when: /\{keeper\}|off the line/, stats: { sot: 1 } }, { when: /Penalty shout/, stats: {}, replace: true }],
      headlineIf: [{ when: /post/, headline: 'Off the post' }, { when: /off the line/, headline: 'Off the line' }, { when: /Penalty shout/, headline: 'Penalty shout' }],
      roles: [
        { key: 'keeper', side: 'opp', pos: SOCCER_KEEPER, stats: { sv: 1 }, role: 'save' },
        { key: 'defender', side: 'opp', pos: { DF: 5, MF: 1 }, stats: { clr: 1 }, role: 'clearance' },
      ],
    },
    YELLOW: { pos: { DF: 4, MF: 4, FW: 1.5 }, stats: { yc: 1 }, role: 'booked', headline: 'Yellow card', impact: 2 },
    RED: { pos: { DF: 5, MF: 3, FW: 1 }, stats: { rc: 1 }, role: 'sent off', headline: 'Red card', impact: 7 },
    SUB: { pos: SOCCER_OUTFIELD, role: 'on', headline: 'Substitution', impact: 1 },
    SHOT: {
      pos: SOCCER_ATTACK, star: 1.3, stats: { sh: 1 }, role: 'shot', headline: 'Shot', impact: 1.2,
      posIf: [{ when: /Header/, pos: { FW: 5, DF: 2.5, MF: 2 } }],
    },
    SAVE: {
      pos: SOCCER_ATTACK, star: 1.3, stats: { sh: 1, sot: 1 }, role: 'shot', headline: 'Save', impact: 2.5,
      roles: [{ key: 'keeper', side: 'opp', pos: SOCCER_KEEPER, stats: { sv: 1 }, role: 'save', lead: true }],
    },
    OFFSIDE: { pos: { FW: 5, MF: 2 }, role: 'offside', headline: 'Offside', impact: 0.5 },
    FREEKICK: { pos: { MF: 4, FW: 3, DF: 1 }, role: 'free kick', headline: 'Free kick', impact: 1 },
    FOUL: { pos: { DF: 3, MF: 4, FW: 2 }, role: 'foul', headline: 'Foul', impact: 0.5 },
  },
  filler: [
    { stats: { sh: 1 }, perTeam: 2.2, pos: SOCCER_ATTACK, lean: 0.4 },
    { stats: { sh: 1, sot: 1 }, perTeam: 0.7, pos: SOCCER_ATTACK, lean: 0.4,
      with: [{ chance: 1, side: 'opp', pos: SOCCER_KEEPER, stats: { sv: 1 } }] },
    { stats: { kp: 1 }, perTeam: 8, pos: { MF: 5, FW: 3, DF: 1.5 }, lean: 0.3 },
    { stats: { tkl: 1 }, perTeam: 16, pos: { DF: 4, MF: 4, FW: 1.2 }, lean: -0.2 },
    { stats: { int: 1 }, perTeam: 9, pos: { DF: 5, MF: 3, FW: 0.5 }, lean: -0.2 },
    { stats: { clr: 1 }, perTeam: 16, pos: { DF: 7, MF: 1.2, FW: 0.5, GK: 1 }, lean: -0.4 },
  ],
};

const soccer: H2HConfig = {
  players: soccerPlayers,
  periods: [
    { label: '1st half', short: '1H', clockMin: 45, realMin: 48 },
    { label: '2nd half', short: '2H', clockMin: 45, realMin: 49 },
  ],
  breaks: [{ realMin: 15, label: 'Half-time' }],
  clock: 'up',
  tie: 'draw',
  homeEdge: 0.06,
  totalWord: 'goals',
  startText: 'Kick-off! {team} get us under way at {venue}.',
  scoring: [{
    tag: 'GOAL', points: 1, mean: 1.35, importance: 3, feedChance: 1,
    // The count and order of templates in every list must stay the same: the
    // seeded script picks them by position.
    templates: [
      'GOAL! {player} finishes low into the bottom corner for {team}.',
      'GOAL! {player} rises highest to head home {assist}\'s corner.',
      'GOAL! A curling beauty from {player} — {team} score!',
      'GOAL! {player} taps in at the back post after a lovely move.',
      'GOAL! {player} converts from the penalty spot for {team}.',
      'GOAL! A deflected strike from {player} wrong-foots the keeper.',
      'GOAL! {player} smashes it in off the crossbar!',
      'GOAL! {player} chips the onrushing keeper. Sublime from {team}.',
      'GOAL! {player} pounces on a loose ball in the six-yard box.',
    ],
  }],
  flavor: [
    { tag: 'CHANCE', mean: 5, importance: 2, templates: [
      'Big chance! {player} is denied by a flying save from {keeper}.', '{player} rattles the post for {team}!',
      '{player} fires just wide from the edge of the box.', 'Goal-line clearance! {player}\'s shot is hacked off the line by {defender}.',
      '{player} volleys over the bar from close range. How did that stay out?', 'Penalty shout as {player} goes down for {team}… waved away.',
    ] },
    { tag: 'YELLOW', mean: 3.2, importance: 1, templates: [
      'Yellow card: {player} ({team}) for a late challenge.', 'Yellow card for {player} after a cynical foul.',
      '{player} ({team}) is booked for dissent.',
    ] },
    { tag: 'RED', mean: 0.09, importance: 3, templates: ['RED CARD! {player} is sent off — {team} down to ten men.'] },
    { tag: 'CORNER', mean: 3, importance: 1, templates: [
      'Corner to {team}. Cleared at the near post.', '{team} win a corner after sustained pressure.',
    ] },
    { tag: 'SUB', mean: 3.5, importance: 1, lateOnly: true, templates: [
      'Substitution for {team}: {player} comes on for {off}.', '{team} make a change — fresh legs with {player} replacing {off}.',
    ] },
    { tag: 'VAR', mean: 0.3, importance: 2, templates: ['VAR check for a possible penalty… no penalty, play on.'] },
  ],
  detail: [
    { tag: 'SHOT', mean: 9, importance: 1, templates: [
      '{player} tries a shot from distance — over the bar.', '{player} shoots from the edge of the box. Blocked.',
      '{player} curls one wide of the far post.', 'Header from {player} drifts just over.', '{player} snatches at it and drags it wide.',
    ] },
    { tag: 'SAVE', mean: 5, importance: 1, templates: [
      'Comfortable save. {player}\'s effort is straight at {keeper}.', 'Good save! {player}\'s shot is tipped around the post by {keeper}.',
      '{player} forces a diving stop from {keeper}.', 'Low drive from {player}, gathered by {keeper} at the second attempt.',
    ] },
    { tag: 'OFFSIDE', mean: 3.5, importance: 1, templates: [
      'Offside. {player} ({team}) strayed beyond the last defender.', 'Flag goes up — {player} is offside.',
    ] },
    { tag: 'FREEKICK', mean: 4, importance: 1, templates: [
      'Free kick to {team} in a promising position.', '{player} is brought down 25 yards out. Free kick {team}.',
      '{player} whips the free kick in… headed clear.',
    ] },
    { tag: 'FOUL', mean: 5, importance: 1, templates: ['Foul by {player} ({team}) in midfield.', '{player} goes through the back of an opponent. Free kick.'] },
  ],
  stats: [
    { label: 'Possession', kind: 'possession' },
    { label: 'Shots', kind: 'count', tags: ['GOAL', 'CHANCE', 'SHOT', 'SAVE'], base: 2 },
    { label: 'Shots on target', kind: 'count', tags: ['GOAL', 'CHANCE', 'SAVE'], base: 0 },
    { label: 'Corners', kind: 'count', tags: ['CORNER'], base: 2 },
    { label: 'Fouls', kind: 'count', tags: ['FOUL', 'FREEKICK', 'YELLOW', 'RED'], base: 10 },
    { label: 'Offsides', kind: 'count', tags: ['OFFSIDE'] },
    { label: 'Yellow cards', kind: 'count', tags: ['YELLOW'] },
  ],
};

const UNION_ALL: PosWeights = { PR: 1, HK: 1, LK: 1, FL: 1, N8: 1, SH: 1, FH: 1, CE: 1, WG: 1, FB: 1 };
const UNION_FORWARD_METRES: [number, number] = [0, 6];
const UNION_BACK_METRES: [number, number] = [1, 13];

const rugbyUnionPlayers: PlayerModel = {
  rotation: null,
  subs: { chance: 0.9, from: 0.55, to: 0.8 },
  sinBin: { tags: ['YELLOW'], minutes: 10 },
  kicker: { FH: 9, FB: 0.6, CE: 0.4 },
  close: 7,
  leverage: 0.8,
  plays: {
    TRY: {
      pos: { WG: 5, FB: 3, CE: 3, FL: 1.5, N8: 1.5, HK: 1.2, SH: 1, FH: 0.8, LK: 0.6, PR: 0.5 }, star: 1.6,
      stats: { t: 1, car: 1 }, amounts: { m: [2, 25] }, role: 'try', headline: 'Try', impact: 6,
      posIf: [
        { when: /crashes over/, pos: { PR: 2, HK: 2, LK: 2, FL: 3, N8: 3, SH: 1, CE: 1 } },
        { when: /in the corner/, pos: { WG: 6, FB: 2, CE: 1 } },
        { when: /maul/, pos: { HK: 6, FL: 2, N8: 2, LK: 1 } },
        { when: /intercepts/, pos: { WG: 3, CE: 3, FB: 2, FH: 1, SH: 1, FL: 0.5 } },
      ],
      statsIf: [{ when: /intercepts/, stats: { tw: 1, lb: 1 } }, { when: /chips and chases|sweeping/, stats: { lb: 1 } }],
      headlineIf: [{ when: /intercepts/, headline: 'Intercept try' }],
    },
    CONV: { pos: UNION_ALL, kicker: true, stats: { c: 1 }, role: 'kick', headline: 'Conversion', impact: 2 },
    CONV_MISS: { pos: UNION_ALL, kicker: true, role: 'kick', headline: 'Missed conversion', impact: 1 },
    PEN: { pos: UNION_ALL, kicker: true, stats: { p: 1 }, role: 'kick', headline: 'Penalty goal', impact: 3.5,
      headlineIf: [{ when: /halfway/, headline: 'Long-range penalty' }] },
    DROP: { pos: { FH: 8, CE: 1, FB: 1 }, star: 2, stats: { dg: 1 }, role: 'kick', headline: 'Drop goal', impact: 7 },
    BREAK: {
      pos: { WG: 3, CE: 3, FB: 3, FH: 1.5, SH: 1, N8: 1.5, FL: 1, HK: 0.5, LK: 0.5, PR: 0.3 }, star: 1.5,
      stats: { lb: 1, car: 1 }, amounts: { m: [12, 45] }, role: 'carry', headline: 'Line break', impact: 4,
    },
    TURNOVER: { pos: { FL: 5, N8: 2, HK: 2, LK: 1, PR: 0.7, CE: 1 }, star: 1.3, stats: { tw: 1 }, role: 'turnover', headline: 'Turnover won', impact: 3 },
    YELLOW: { pos: { PR: 1.5, HK: 1, LK: 1.5, FL: 2, N8: 1, SH: 0.7, FH: 0.5, CE: 1, WG: 0.7, FB: 0.5 }, stats: { yc: 1 },
      role: 'sin bin', headline: 'Yellow card', impact: 4.5 },
    LINEOUT: { pos: { LK: 5, FL: 2, N8: 1 }, stats: { tw: 1 }, role: 'lineout', headline: 'Lineout steal', impact: 2.5 },
    FOUL: { pos: { PR: 1.5, HK: 1, LK: 1.5, FL: 2, N8: 1, SH: 0.5, FH: 0.5, CE: 1.2, WG: 0.7, FB: 0.5 }, role: 'penalty', headline: 'High tackle', impact: 1 },
    KICK: { pos: { FH: 4, SH: 3, FB: 3, WG: 0.5, CE: 0.5 }, role: 'kick', headline: 'Kick', impact: 1,
      posIf: [{ when: /Box kick/, pos: { SH: 1 } }] },
    CARRY: {
      pos: { PR: 2, HK: 1.5, LK: 2, FL: 2.5, N8: 3, CE: 2, WG: 1, FB: 1, SH: 0.5, FH: 0.5 },
      stats: { car: 1 }, amounts: { m: [1, 5] }, role: 'carry', headline: 'Carry', impact: 1,
      statsIf: [{ when: /gain line/, stats: { m: 4 } }],
    },
    KNOCKON: { pos: UNION_ALL, role: 'error', headline: 'Knock-on', impact: 1 },
  },
  filler: [
    { stats: { car: 1 }, perTeam: 100, pos: { PR: 6, HK: 5, LK: 6, FL: 8, N8: 9, SH: 4, FH: 3, CE: 7, WG: 5, FB: 6 }, lean: 0.2,
      amount: { key: 'm', byPos: { PR: UNION_FORWARD_METRES, HK: UNION_FORWARD_METRES, LK: UNION_FORWARD_METRES, FL: UNION_FORWARD_METRES,
        N8: UNION_FORWARD_METRES, SH: UNION_BACK_METRES, FH: UNION_BACK_METRES, CE: UNION_BACK_METRES, WG: UNION_BACK_METRES, FB: UNION_BACK_METRES } } },
    { stats: { tkl: 1 }, perTeam: 125, pos: { PR: 8, HK: 8, LK: 9, FL: 11, N8: 9, SH: 6, FH: 6, CE: 7, WG: 3, FB: 3 }, lean: -0.3 },
    { stats: { mt: 1 }, perTeam: 16, pos: { PR: 1, HK: 1, LK: 1, FL: 1, N8: 1, SH: 1, FH: 1.3, CE: 1.2, WG: 1.2, FB: 1 }, lean: -0.3 },
    { stats: { off: 1 }, perTeam: 9, pos: { N8: 2, FL: 1.5, CE: 2, LK: 1, WG: 1, FB: 1.2, PR: 0.8, HK: 0.8, SH: 0.5, FH: 1 } },
    { stats: { lb: 1, car: 1 }, perTeam: 1.5, pos: { WG: 3, CE: 3, FB: 3, FH: 1.5, SH: 1, N8: 1.5, FL: 1 }, lean: 0.3,
      amount: { key: 'm', byPos: { WG: [12, 40], CE: [12, 40], FB: [12, 40], FH: [10, 30], SH: [10, 30], N8: [8, 25], FL: [8, 25] } } },
    { stats: { tw: 1 }, perTeam: 3.5, pos: { FL: 5, N8: 2, HK: 2, LK: 1, PR: 1, CE: 1 } },
  ],
};

const rugbyUnion: H2HConfig = {
  players: rugbyUnionPlayers,
  periods: [
    { label: '1st half', short: '1H', clockMin: 40, realMin: 46 },
    { label: '2nd half', short: '2H', clockMin: 40, realMin: 47 },
  ],
  breaks: [{ realMin: 13, label: 'Half-time' }],
  clock: 'up',
  tie: 'draw',
  homeEdge: 0.07,
  totalWord: 'points',
  startText: '{team} kick off at {venue}. Here we go!',
  scoring: [
    { tag: 'TRY', points: 5, mean: 2.7, importance: 3, feedChance: 1,
      templates: [
        'TRY! {player} crashes over from close range for {team}.', 'TRY! {player} finishes in the corner after a sweeping backline move.',
        'TRY! {player} chips and chases and dots down!', 'TRY! The {team} maul rumbles over, {player} with the ball at the back.',
        'TRY! {player} intercepts and runs 70 metres to score!',
      ],
      follow: { tag: 'CONV', points: 2, chance: 0.72, templates: ['{player} adds the conversion.', 'Conversion good from {player}.'],
        missTemplates: ['{player} pushes the conversion wide.', 'Conversion off the post from {player}.'] } },
    { tag: 'PEN', points: 3, mean: 2.3, importance: 2, feedChance: 1, templates: [
      'Penalty goal: {player} slots it from 35 metres.', 'Three points for {team} — {player} makes no mistake.',
      '{player} lands a long-range penalty from halfway!',
    ] },
    { tag: 'DROP', points: 3, mean: 0.12, importance: 3, feedChance: 1, templates: ['DROP GOAL! {player} snaps it over for {team}!'] },
  ],
  flavor: [
    { tag: 'BREAK', mean: 4, importance: 2, templates: ['Line break! {player} carves through but the cover defence scrambles back.', '{player} beats three defenders before being hauled down.'] },
    { tag: 'TURNOVER', mean: 5, importance: 1, templates: ['Turnover! {player} gets over the ball at the breakdown.', '{team} win a jackal penalty through {player}.'] },
    { tag: 'YELLOW', mean: 0.5, importance: 2, templates: ['Yellow card: {player} ({team}) goes to the sin bin for ten minutes.'] },
    { tag: 'TMO', mean: 0.4, importance: 2, templates: ['TMO review for a possible try… ruled held up.'] },
    { tag: 'SCRUM', mean: 3, importance: 1, templates: ['{team} win a scrum penalty.', 'Scrum reset on the {team} 22.'] },
    { tag: 'LINEOUT', mean: 2, importance: 1, templates: ['{team} steal the lineout, {player} up highest!'] },
  ],
  detail: [
    { tag: 'FOUL', mean: 10, importance: 1, templates: [
      'Penalty to {team} for offside at the ruck.', 'Penalty against {opp}: not rolling away.', '{team} win a penalty and kick for the corner.',
      'High tackle by {player}. Penalty {opp}.',
    ] },
    { tag: 'KICK', mean: 8, importance: 1, templates: [
      '{player} finds touch with a long kick.', 'Box kick from {player}, well contested.', 'Up-and-under from {player}.',
      '{player} kicks into the 22. Lineout {opp}.',
    ] },
    { tag: 'CARRY', mean: 6, importance: 1, templates: ['{player} carries hard into contact.', 'Strong carry from {player} over the gain line.'] },
    { tag: 'KNOCKON', mean: 4, importance: 1, templates: ['Knock-on by {player}. Scrum {opp}.', '{player} spills it forward under pressure.'] },
  ],
  stats: [
    { label: 'Possession', kind: 'possession' },
    { label: 'Tackles', kind: 'mean', mean: 140, spread: 40 },
    { label: 'Carries', kind: 'mean', mean: 110, spread: 30 },
    { label: 'Line breaks', kind: 'count', tags: ['BREAK', 'TRY'] },
    { label: 'Turnovers won', kind: 'count', tags: ['TURNOVER'], base: 3 },
    { label: 'Penalties conceded', kind: 'mean', mean: 10, spread: 5 },
  ],
};

const LEAGUE_ALL: PosWeights = { FB: 1, WG: 1, CE: 1, FE: 1, HB: 1, PR: 1, HK: 1, SR: 1, LK: 1 };
const LEAGUE_FORWARD_METRES: [number, number] = [5, 11];
const LEAGUE_BACK_METRES: [number, number] = [5, 14];

const rugbyLeaguePlayers: PlayerModel = {
  rotation: null,
  subs: { chance: 0.92, from: 0.3, to: 0.7 },
  sinBin: { tags: ['SINBIN'], minutes: 10 },
  kicker: { HB: 4, FE: 2.5, CE: 2, WG: 1, FB: 0.5 },
  close: 6,
  leverage: 0.8,
  assistText: ([a]) => ` Try assist: ${a}.`,
  plays: {
    TRY: {
      pos: { WG: 5, CE: 3, FB: 3, HB: 1, FE: 1.2, SR: 1.5, LK: 0.7, HK: 0.8, PR: 0.6 }, star: 1.6,
      stats: { t: 1, run: 1 }, amounts: { m: [3, 25] }, role: 'try', headline: 'Try', impact: 6,
      posIf: [
        { when: /in the corner/, pos: { WG: 6, CE: 2, FB: 1 } },
        { when: /under the posts/, pos: { FB: 3, HB: 2, FE: 2, CE: 2, SR: 2, WG: 1, LK: 1, HK: 1 } },
        { when: /intercept/, pos: { WG: 3, CE: 3, FB: 2, FE: 1, HB: 1 } },
      ],
      statsIf: [{ when: /intercept/, stats: { lb: 1 } }],
      headlineIf: [{ when: /intercept/, headline: 'Intercept try' }],
      roles: [{ key: 'assist', side: 'own', pos: { HB: 4, FE: 4, FB: 2.5, HK: 1.5, CE: 1.5, WG: 0.5, SR: 0.7, LK: 0.7, PR: 0.3 },
        stats: { ta: 1 }, role: 'assist', chance: 0.8, unless: /intercept/ }],
    },
    CONV: { pos: LEAGUE_ALL, kicker: true, stats: { g: 1 }, role: 'kick', headline: 'Conversion', impact: 2 },
    CONV_MISS: { pos: LEAGUE_ALL, kicker: true, role: 'kick', headline: 'Missed conversion', impact: 1 },
    PEN: { pos: LEAGUE_ALL, kicker: true, stats: { g: 1 }, role: 'kick', headline: 'Penalty goal', impact: 3 },
    FG: { pos: { HB: 5, FE: 4, FB: 0.5 }, star: 2, stats: { fg: 1 }, role: 'kick', headline: 'Field goal', impact: 7 },
    ERROR: { pos: { WG: 2, FB: 2, CE: 1.5, FE: 1, HB: 1, PR: 1, HK: 1, SR: 1, LK: 1 }, stats: { err: 1 }, role: 'error', headline: 'Error', impact: 1.5,
      posIf: [{ when: /high ball/, pos: { WG: 3, FB: 3, CE: 1 } }] },
    BREAK: { pos: { FB: 3, CE: 3, WG: 2, FE: 2, HB: 1.5, SR: 2, LK: 1, HK: 1, PR: 0.5 }, star: 1.5,
      stats: { lb: 1, run: 1 }, amounts: { m: [15, 50] }, role: 'carry', headline: 'Line break', impact: 4 },
    SINBIN: { pos: { PR: 1.5, HK: 1, SR: 1.5, LK: 1.5, CE: 1, WG: 0.7, FB: 0.7, FE: 0.7, HB: 0.7 }, role: 'sin bin', headline: 'Sin bin', impact: 4.5 },
    SET: { pos: { PR: 3, LK: 3, SR: 2, HK: 1, CE: 1, WG: 1, FB: 1 }, stats: { run: 1 }, amounts: { m: [3, 10] }, role: 'carry', headline: 'Carry', impact: 1 },
    KICK: { pos: { HB: 5, FE: 4, FB: 1 }, role: 'kick', headline: 'Kick', impact: 1 },
    CARRY: { pos: { PR: 5, LK: 4, SR: 3, HK: 1, CE: 1 }, stats: { run: 1 }, amounts: { m: [6, 11] }, role: 'carry', headline: 'Hit-up', impact: 1 },
  },
  filler: [
    { stats: { run: 1 }, perTeam: 150, pos: { FB: 12, WG: 11, CE: 10, FE: 5, HB: 4, PR: 13, HK: 5, SR: 11, LK: 12 }, lean: 0.2,
      amount: { key: 'm', byPos: { FB: LEAGUE_BACK_METRES, WG: LEAGUE_BACK_METRES, CE: LEAGUE_BACK_METRES, FE: LEAGUE_BACK_METRES,
        HB: LEAGUE_BACK_METRES, PR: LEAGUE_FORWARD_METRES, HK: LEAGUE_FORWARD_METRES, SR: LEAGUE_FORWARD_METRES, LK: LEAGUE_FORWARD_METRES } } },
    { stats: { tkl: 1 }, perTeam: 300, pos: { PR: 30, HK: 40, SR: 30, LK: 35, CE: 15, FE: 15, HB: 15, WG: 6, FB: 4 }, lean: -0.3 },
    { stats: { mt: 1 }, perTeam: 24, pos: { PR: 2, HK: 2, SR: 2, LK: 2, CE: 2.5, FE: 3, HB: 3, WG: 2.5, FB: 2 }, lean: -0.3 },
    { stats: { off: 1 }, perTeam: 8, pos: { PR: 1.5, SR: 1.5, LK: 1.5, CE: 1.2, FB: 1, WG: 0.6, FE: 0.8, HB: 0.6, HK: 0.8 } },
    { stats: { lb: 1, run: 1 }, perTeam: 2, pos: { FB: 3, CE: 3, WG: 2, FE: 2, HB: 1.5, SR: 2, LK: 1, HK: 1 }, lean: 0.3,
      amount: { key: 'm', byPos: { FB: [15, 45], CE: [15, 45], WG: [15, 45], FE: [12, 35], HB: [12, 35], SR: [10, 30], LK: [10, 30], HK: [10, 30] } } },
    { stats: { err: 1 }, perTeam: 7, pos: { WG: 1.5, FB: 1.5, CE: 1.5, FE: 1, HB: 1, PR: 1, HK: 1, SR: 1, LK: 1 } },
  ],
};

const rugbyLeague: H2HConfig = {
  ...rugbyUnion,
  players: rugbyLeaguePlayers,
  homeEdge: 0.06,
  startText: '{team} kick off. Game on at {venue}!',
  scoring: [
    { tag: 'TRY', points: 4, mean: 3.2, importance: 3, feedChance: 1,
      templates: [
        'TRY! {player} dives over in the corner for {team}.', 'TRY! {player} steps two and goes in under the posts.',
        'TRY! A last-tackle grubber and {player} dots down!', 'TRY! {player} goes 90 metres after an intercept!',
      ],
      follow: { tag: 'CONV', points: 2, chance: 0.7, templates: ['{player} converts.'], missTemplates: ['{player} misses the conversion.'] } },
    { tag: 'PEN', points: 2, mean: 0.8, importance: 2, feedChance: 1, templates: ['Penalty goal to {team}, {player} from in front.'] },
    { tag: 'FG', points: 1, mean: 0.15, importance: 3, feedChance: 1, templates: ['FIELD GOAL! {player} pots a one-pointer for {team}!'] },
  ],
  flavor: [
    { tag: 'ERROR', mean: 6, importance: 1, templates: ['Handling error from {player} ({team}) near halfway.', '{player} knocks on under the high ball.'] },
    { tag: 'BREAK', mean: 4, importance: 2, templates: ['Line break! {player} bursts through the middle.'] },
    { tag: 'SINBIN', mean: 0.3, importance: 2, templates: ['Sin bin: {player} ({team}) for a professional foul.'] },
    { tag: 'SETRESTART', mean: 3, importance: 1, templates: ['Six again to {team}.'] },
  ],
  detail: [
    { tag: 'SET', mean: 10, importance: 1, templates: [
      'Strong set from {team}, {player} takes the last carry.', '{team} complete their set deep in {opp} territory.',
      'Quick play-the-ball from {player} and {team} roll forward.',
    ] },
    { tag: 'KICK', mean: 6, importance: 1, templates: ['Last-tackle kick from {player} pins them deep.', 'Bomb from {player}, defused at the back.'] },
    { tag: 'CARRY', mean: 6, importance: 1, templates: ['{player} charges up the middle for 12 metres.', 'Big hit-up from {player}.'] },
    { tag: 'FOUL', mean: 4, importance: 1, templates: ['Penalty against {team} for a slow play-the-ball.', 'Penalty to {team}: hands in the ruck.'] },
  ],
  stats: [
    { label: 'Possession', kind: 'possession' },
    { label: 'Run metres', kind: 'mean', mean: 1500, spread: 400 },
    { label: 'Tackles', kind: 'mean', mean: 320, spread: 60 },
    { label: 'Errors', kind: 'count', tags: ['ERROR'], base: 3 },
    { label: 'Line breaks', kind: 'count', tags: ['BREAK', 'TRY'] },
  ],
};

const HOOPS_ALL: PosWeights = { PG: 1, SG: 1, SF: 1, PF: 1, C: 1 };
const HOOPS_TWO: PosWeights = { PG: 1, SG: 1.1, SF: 1.15, PF: 1.15, C: 1.25 };
const HOOPS_THREE: PosWeights = { PG: 1.3, SG: 1.6, SF: 1.2, PF: 0.6, C: 0.15 };
const HOOPS_FT: PosWeights = { PG: 0.9, SG: 1, SF: 1.1, PF: 1.2, C: 1.3 };
const HOOPS_PASS: PosWeights = { PG: 4.5, SG: 2, SF: 1.5, PF: 1, C: 0.8 };
const HOOPS_BOARDS: PosWeights = { C: 4, PF: 3, SF: 1.8, SG: 1.1, PG: 1 };
const HOOPS_HANDS: PosWeights = { PG: 3, SG: 2.5, SF: 2, PF: 1, C: 0.6 };
const HOOPS_BLOCKS: PosWeights = { C: 4, PF: 3, SF: 1.5, SG: 0.7, PG: 0.5 };
const HOOPS_HANDLERS: PosWeights = { PG: 3, SG: 2, SF: 1.5, PF: 1.3, C: 1.3 };
const HOOPS_REBOUND = (offensive: number) => [
  { chance: 0.62, side: 'opp' as const, pos: HOOPS_BOARDS, stats: { reb: 1 } },
  { chance: offensive, side: 'own' as const, pos: HOOPS_BOARDS, stats: { reb: 1 } },
];

const basketballPlayers: PlayerModel = {
  rotation: { bench: 0.42 },
  minutes: 'shared',
  close: 6,
  leverage: 0.6,
  assistText: ([a]) => ` Assist: ${a}.`,
  plays: {
    '2PT': {
      pos: HOOPS_TWO, star: 2.6, stats: { pts: 2, fgm: 1, fga: 1 }, role: 'score', headline: '2-pointer', impact: 2,
      posIf: [
        { when: /slam|Alley-oop/, pos: { C: 4, PF: 3, SF: 2, SG: 1, PG: 0.4 } },
        { when: /post/, pos: { C: 4, PF: 3, SF: 1 } },
        { when: /drives|floater/, pos: { PG: 3, SG: 2.5, SF: 2, PF: 0.8, C: 0.3 } },
      ],
      headlineIf: [
        { when: /Alley-oop/, headline: 'Alley-oop' }, { when: /slam/, headline: 'Dunk' }, { when: /lays it in/, headline: 'Layup' },
        { when: /floater/, headline: 'Floater' }, { when: /jumper/, headline: 'Jumper' },
      ],
      roles: [{ key: 'assist', side: 'own', pos: HOOPS_PASS, stats: { ast: 1 }, role: 'assist', chance: 0.5, unless: /spins in the post/ }],
    },
    '3PT': {
      pos: HOOPS_THREE, star: 2.6, stats: { pts: 3, fgm: 1, fga: 1, tpm: 1, tpa: 1 }, role: 'score', headline: '3-pointer', impact: 3.5,
      roles: [{ key: 'assist', side: 'own', pos: HOOPS_PASS, stats: { ast: 1 }, role: 'assist', chance: 0.8, unless: /step-back/ }],
    },
    FT: {
      pos: HOOPS_FT, star: 2.4, stats: { pts: 1, ftm: 1, fta: 1 }, role: 'score', headline: 'Free throw', impact: 1,
      headlineIf: [{ when: /Clutch/, headline: 'Game winner' }], impactIf: [{ when: /Clutch/, impact: 8.5 }],
    },
    BLOCK: {
      pos: HOOPS_BLOCKS, star: 1.5, stats: { blk: 1 }, role: 'block', headline: 'Block', impact: 4,
      roles: [{ key: 'shooter', side: 'opp', pos: HOOPS_TWO, stats: { fga: 1 }, role: 'shot' }],
    },
    STEAL: {
      pos: HOOPS_HANDS, star: 1.3, stats: { stl: 1 }, role: 'steal', headline: 'Steal', impact: 3,
      roles: [{ key: 'victim', side: 'opp', pos: HOOPS_HANDLERS, stats: { to: 1 }, role: 'turnover' }],
    },
    MISS: {
      pos: HOOPS_TWO, stats: { fga: 1 }, role: 'miss', headline: 'Miss', impact: 0.5,
      posIf: [{ when: /three/, pos: HOOPS_THREE }],
      statsIf: [{ when: /three/, stats: { tpa: 1 } }],
      headlineIf: [{ when: /Airball/, headline: 'Airball' }],
    },
    REB: {
      pos: HOOPS_BOARDS, star: 1.3, stats: { reb: 1 }, role: 'rebound', headline: 'Rebound', impact: 1,
      posIf: [{ when: /Offensive/, pos: { C: 4, PF: 3.5, SF: 1.5, SG: 0.6, PG: 0.4 } }],
      headlineIf: [{ when: /Offensive/, headline: 'Offensive rebound' }],
    },
    FOUL: { pos: { PG: 1, SG: 1, SF: 1.1, PF: 1.3, C: 1.4 }, role: 'foul', headline: 'Foul', impact: 0.5 },
    TO: { pos: HOOPS_HANDLERS, stats: { to: 1 }, role: 'turnover', headline: 'Turnover', impact: 1 },
  },
  filler: [
    // The feed shows about 20 misses a team; these make up the rest (about 88 shots a game).
    { stats: { fga: 1 }, perTeam: 3, pos: HOOPS_TWO, with: HOOPS_REBOUND(0.6) },
    { stats: { fga: 1, tpa: 1 }, perTeam: 18, pos: HOOPS_THREE, with: HOOPS_REBOUND(0.55) },
    // Boards off the misses the feed shows.
    { stats: { reb: 1 }, perTeam: 11, pos: HOOPS_BOARDS },
    { stats: { fta: 1 }, perTeam: 4.5, pos: HOOPS_FT },
    { stats: { stl: 1 }, perTeam: 4.5, pos: HOOPS_HANDS, lean: -0.2,
      with: [{ chance: 1, side: 'opp', pos: HOOPS_HANDLERS, stats: { to: 1 } }] },
    { stats: { blk: 1 }, perTeam: 2.5, pos: HOOPS_BLOCKS, lean: -0.2,
      with: [{ chance: 1, side: 'opp', pos: HOOPS_ALL, stats: { fga: 1 } }] },
    { stats: { to: 1 }, perTeam: 3, pos: HOOPS_HANDLERS, lean: -0.3 },
  ],
};

const basketball: H2HConfig = {
  players: basketballPlayers,
  periods: [1, 2, 3, 4].map((q) => ({ label: `Quarter ${q}`, short: `Q${q}`, clockMin: 12, realMin: 26 })),
  breaks: [{ realMin: 3, label: 'End of Q1' }, { realMin: 14, label: 'Half-time' }, { realMin: 3, label: 'End of Q3' }],
  clock: 'down',
  tie: 'overtime',
  overtime: { label: 'Overtime', short: 'OT', clockMin: 5, realMin: 11, suddenDeath: false },
  homeEdge: 0.05,
  strengthSpread: 0.35,
  countNoise: 0.5,
  totalWord: 'points',
  startText: 'Tip-off at {venue}! {team} win the jump ball.',
  scoring: [
    { tag: '2PT', points: 2, mean: 29, importance: 1, feedChance: 0.55, templates: [
      '{player} pulls up for a mid-range jumper. Good!', '{player} drives baseline and lays it in.',
      'Alley-oop! {player} throws down the lob from {assist}!', '{player} with a smooth floater in the lane.',
      'Two-handed slam from {player}!', '{player} spins in the post and banks it home.',
    ] },
    { tag: '3PT', points: 3, mean: 12.5, importance: 2, feedChance: 0.9, templates: [
      '{player} buries a three from the corner!', 'Three! {player} from way downtown.',
      '{player} step-back three… bang!', 'Catch-and-shoot triple from {player}.',
    ] },
    { tag: 'FT', points: 1, mean: 17, importance: 1, feedChance: 0.18, templates: ['{player} hits from the line.', '{player} makes the free throw.'] },
  ],
  flavor: [
    { tag: 'BLOCK', mean: 5, importance: 2, templates: ['Huge block by {player} on {shooter}!', '{player} swats {shooter}\'s shot into the stands!'] },
    { tag: 'STEAL', mean: 6, importance: 1, templates: ['Steal by {player}, picking {victim}\'s pocket — {team} on the break.'] },
    { tag: 'TIMEOUT', mean: 5, importance: 1, templates: ['Timeout called by {team}.'] },
    { tag: 'REVIEW', mean: 0.4, importance: 2, templates: ['Officials go to the monitor to review a foul call.'] },
  ],
  detail: [
    { tag: 'MISS', mean: 40, importance: 1, templates: [
      '{player} misses a jumper from the elbow.', '{player} misses the three.', '{player} can\'t finish at the rim.',
      '{player}\'s floater rims out.', '{player} misses a contested layup.', 'Airball from {player}!',
    ] },
    { tag: 'REB', mean: 30, importance: 1, templates: [
      'Defensive rebound, {player}.', 'Offensive board for {player} — second chance {team}!', '{player} grabs the rebound.',
    ] },
    { tag: 'FOUL', mean: 14, importance: 1, templates: [
      'Shooting foul on {player}. Two shots coming.', 'Personal foul on {player} ({team}).', 'Loose-ball foul, {player}.',
    ] },
    { tag: 'TO', mean: 9, importance: 1, templates: [
      'Turnover — {player} throws it away.', 'Travelling called on {player}.', 'Shot-clock violation on {team}.', 'Offensive foul on {player}.',
    ] },
  ],
  stats: [
    { label: 'Field goal %', kind: 'mean', mean: 46, spread: 10, suffix: '%' },
    { label: '3-pointers made', kind: 'count', tags: ['3PT'] },
    { label: 'Rebounds', kind: 'mean', mean: 44, spread: 10 },
    { label: 'Assists', kind: 'mean', mean: 24, spread: 8 },
    { label: 'Turnovers', kind: 'mean', mean: 13, spread: 6 },
    { label: 'Blocks', kind: 'count', tags: ['BLOCK'], base: 1 },
  ],
};

const americanFootball: H2HConfig = {
  periods: [1, 2, 3, 4].map((q) => ({ label: `Quarter ${q}`, short: `Q${q}`, clockMin: 15, realMin: 44 })),
  breaks: [{ realMin: 3, label: 'End of Q1' }, { realMin: 18, label: 'Half-time' }, { realMin: 3, label: 'End of Q3' }],
  clock: 'down',
  tie: 'overtime',
  overtime: { label: 'Overtime', short: 'OT', clockMin: 10, realMin: 22, suddenDeath: true },
  homeEdge: 0.05,
  strengthSpread: 0.8,
  totalWord: 'points',
  startText: 'Kickoff at {venue}. {team} receive.',
  scoring: [
    { tag: 'TD', points: 6, mean: 2.4, importance: 3, feedChance: 1,
      templates: [
        'TOUCHDOWN! {player} hauls in a 34-yard strike for {team}!', 'TOUCHDOWN! {player} punches it in from the 1.',
        'TOUCHDOWN! {player} breaks two tackles and goes 58 yards!', 'TOUCHDOWN! {player} toe-taps in the back of the end zone!',
      ],
      follow: { tag: 'PAT', points: 1, chance: 0.94, templates: ['Extra point is good.'], missTemplates: ['Extra point is NO good — off the upright!'] } },
    { tag: 'FG', points: 3, mean: 1.7, importance: 2, feedChance: 1, templates: [
      'Field goal is good from 42 yards. {team} add three.', '{player} drills a 51-yarder!', 'Chip-shot field goal for {team}.',
    ] },
    { tag: 'SAF', points: 2, mean: 0.04, importance: 3, feedChance: 1, templates: ['SAFETY! {team} trap the ball carrier in the end zone!'] },
  ],
  flavor: [
    { tag: 'INT', mean: 1.6, importance: 3, templates: ['INTERCEPTED! {player} picks it off for {team}!'] },
    { tag: 'FUMBLE', mean: 1, importance: 3, templates: ['FUMBLE! {team} recover — {player} on the ball.'] },
    { tag: 'SACK', mean: 4.5, importance: 2, templates: ['Sacked! {player} gets home for {team}.'] },
    { tag: 'BIGPLAY', mean: 4, importance: 2, templates: ['{player} breaks free for a 38-yard gain.', 'Deep shot to {player} — 45 yards!'] },
    { tag: '4TH', mean: 1.5, importance: 2, templates: ['{team} go for it on fourth down… and convert!', 'Fourth-down stop by {team}!'] },
    { tag: 'PUNT', mean: 7, importance: 1, templates: ['{team} punt it away.'] },
    { tag: 'CHALLENGE', mean: 0.4, importance: 2, templates: ['Challenge flag thrown. After review, the call stands.'] },
  ],
  detail: [
    { tag: '1ST', mean: 22, importance: 1, templates: [
      '{player} picks up the first down.', 'Short pass to {player}, first down {team}.', '{player} runs for 12. First down.',
      'Third-and-4… {player} moves the chains!',
    ] },
    { tag: 'PASS', mean: 16, importance: 1, templates: [
      'Incomplete pass intended for {player}.', '{player} catches it for 7 yards.', 'Screen to {player}, gain of 4.', 'Pass broken up by {player}.',
    ] },
    { tag: 'RUN', mean: 14, importance: 1, templates: [
      '{player} up the middle for 3 yards.', '{player} bounces it outside for 9.', '{player} stuffed at the line for no gain.',
    ] },
    { tag: 'FLAG', mean: 7, importance: 1, templates: [
      'Flag on the play: holding, {team}. 10-yard penalty.', 'False start on {team}. 5 yards.', 'Pass interference on {team}!',
    ] },
  ],
  stats: [
    { label: 'Total yards', kind: 'mean', mean: 360, spread: 120 },
    { label: 'Passing yards', kind: 'mean', mean: 240, spread: 90 },
    { label: 'Rushing yards', kind: 'mean', mean: 120, spread: 60 },
    { label: 'Turnovers', kind: 'count', tags: ['INT', 'FUMBLE'] },
    { label: 'Sacks', kind: 'count', tags: ['SACK'] },
    { label: 'Possession', kind: 'possession' },
  ],
};

const HOCKEY_SKATERS: PosWeights = { C: 1, LW: 1.1, RW: 1.1, D: 0.8 };
const HOCKEY_SCORERS: PosWeights = { C: 3, LW: 3, RW: 3, D: 0.9 };
const HOCKEY_HITTERS: PosWeights = { D: 1.3, LW: 1.2, RW: 1.2, C: 0.9 };
const HOCKEY_GOALIE: PosWeights = { G: 1 };

const iceHockeyPlayers: PlayerModel = {
  // Three forward lines and three defence pairs, top line first; the backup goalie sits.
  rotation: { bench: 0, byPos: { C: [1.15, 1, 0.85], LW: [1.15, 1, 0.85], RW: [1.15, 1, 0.85], D: [1.1, 1.1, 1, 1, 0.9, 0.9], G: [1, 0] } },
  close: 1,
  leverage: 1,
  goalie: { pos: 'G', win: { w: 1 }, shutout: { so: 1 } },
  plusMinus: { key: 'pm', skip: /Power-play/, groups: [{ pos: ['C', 'LW', 'RW'], count: 3 }, { pos: ['D'], count: 2 }] },
  assistText: (names) => (names.length > 1 ? ` Assists: ${names.join(', ')}.` : ` Assist: ${names[0]}.`),
  plays: {
    GOAL: {
      pos: HOCKEY_SCORERS, star: 2, stats: { g: 1, sog: 1 }, role: 'goal', headline: 'Goal', impact: 6.5,
      posIf: [{ when: /point shot|one-times/, pos: { C: 3, LW: 3, RW: 3, D: 1.5 } }],
      headlineIf: [{ when: /Power-play/, headline: 'Power-play goal' }, { when: /Short-handed/, headline: 'Short-handed goal' }],
      roles: [
        { key: 'assist', side: 'own', pos: { C: 3, LW: 2.5, RW: 2.5, D: 2.2 }, stats: { a: 1 }, role: 'assist', chance: 0.95, unless: /breaks away/ },
        { key: 'assist2', side: 'own', pos: { C: 2, LW: 2, RW: 2, D: 3 }, stats: { a: 1 }, role: 'assist', chance: 0.8, needs: 'assist' },
        { key: 'keeper', side: 'opp', pos: HOCKEY_GOALIE, stats: { ga: 1 }, role: 'conceded', silent: true },
      ],
    },
    PENALTY: { pos: { C: 1, LW: 1, RW: 1, D: 1.3 }, stats: { pim: 2 }, role: 'penalty', headline: 'Penalty', impact: 2 },
    SAVE: {
      pos: HOCKEY_SKATERS, star: 1.3, stats: { sog: 1 }, role: 'shot', headline: 'Save', impact: 4,
      roles: [{ key: 'keeper', side: 'opp', pos: HOCKEY_GOALIE, stats: { sv: 1 }, role: 'save', lead: true }],
    },
    POST: { pos: HOCKEY_SKATERS, star: 1.3, role: 'shot', headline: 'Off the post', impact: 3 },
    SHOT: {
      pos: HOCKEY_SKATERS, stats: { sog: 1 }, role: 'shot', headline: 'Shot', impact: 1,
      posIf: [{ when: /from the point/, pos: { D: 1 } }],
      statsIf: [{ when: /blocked/, stats: {}, replace: true }],
      headlineIf: [{ when: /blocked/, headline: 'Blocked shot' }],
      roles: [
        { key: 'keeper', side: 'opp', pos: HOCKEY_GOALIE, stats: { sv: 1 }, role: 'save' },
        { key: 'blocker', side: 'opp', pos: { D: 3, C: 0.7, LW: 0.6, RW: 0.6 }, stats: { blk: 1 }, role: 'block' },
      ],
    },
    HIT: { pos: HOCKEY_HITTERS, stats: { hit: 1 }, role: 'hit', headline: 'Big hit', impact: 2 },
    FACEOFF: { pos: { C: 1 }, stats: { fow: 1 }, role: 'faceoff', headline: 'Faceoff win', impact: 1 },
  },
  filler: [
    { stats: { sog: 1 }, perTeam: 15, pos: HOCKEY_SKATERS, lean: 0.3,
      with: [{ chance: 1, side: 'opp', pos: HOCKEY_GOALIE, stats: { sv: 1 } }] },
    { stats: { hit: 1 }, perTeam: 18, pos: HOCKEY_HITTERS },
    { stats: { blk: 1 }, perTeam: 12, pos: { D: 3, C: 0.7, LW: 0.6, RW: 0.6 }, lean: -0.3 },
    { stats: { fow: 1 }, perTeam: 27, pos: { C: 1 } },
  ],
};

const iceHockey: H2HConfig = {
  players: iceHockeyPlayers,
  periods: [1, 2, 3].map((p) => ({ label: `Period ${p}`, short: `P${p}`, clockMin: 20, realMin: 34 })),
  breaks: [{ realMin: 17, label: '1st intermission' }, { realMin: 17, label: '2nd intermission' }],
  clock: 'down',
  tie: 'overtime',
  overtime: { label: 'Overtime', short: 'OT', clockMin: 5, realMin: 9, suddenDeath: true, shootout: true },
  homeEdge: 0.05,
  totalWord: 'goals',
  startText: 'Puck drop at {venue}!',
  scoring: [{ tag: 'GOAL', points: 1, mean: 3, importance: 3, feedChance: 1, templates: [
    'GOAL! {player} snipes it top shelf for {team}!', 'GOAL! {player} tips in a point shot.',
    'GOAL! {player} buries the rebound.', 'Power-play GOAL! {player} one-times it home.',
    'Short-handed GOAL! {player} breaks away and scores!', 'GOAL! {player} wraps it around the net and in!',
  ] }],
  flavor: [
    { tag: 'PENALTY', mean: 6, importance: 1, templates: [
      '{player} ({team}) — two minutes for tripping.', '{player} ({team}) heads to the box for hooking.',
      '{player} ({team}) — high-sticking, two minutes.',
    ] },
    { tag: 'SAVE', mean: 6, importance: 2, templates: ['{player} is robbed on the doorstep by a huge save from {keeper}!', '{player} can’t believe it — glove save from {keeper}!'] },
    { tag: 'POST', mean: 1, importance: 2, templates: ['{player} rings it off the post!'] },
    { tag: 'REVIEW', mean: 0.3, importance: 2, templates: ['Video review for goaltender interference… no goal.'] },
  ],
  detail: [
    { tag: 'SHOT', mean: 20, importance: 1, templates: [
      '{player} fires a wrist shot. Saved by {keeper}.', 'Slapshot from the point by {player} — blocked by {blocker}.', '{player} shoots, covered by {keeper}.',
      '{player} with a backhand attempt, kicked aside by {keeper}.',
    ] },
    { tag: 'HIT', mean: 8, importance: 1, templates: ['Big hit along the boards by {player}!', '{player} finishes the check.'] },
    { tag: 'ICING', mean: 4, importance: 1, templates: ['Icing on {team}.'] },
    { tag: 'FACEOFF', mean: 4, importance: 1, templates: ['{player} wins the offensive-zone faceoff cleanly.', 'Faceoff win for {player}.'] },
  ],
  stats: [
    { label: 'Shots on goal', kind: 'count', tags: ['GOAL', 'SAVE', 'POST', 'SHOT'], base: 8 },
    { label: 'Faceoffs won', kind: 'possession' },
    { label: 'Hits', kind: 'mean', mean: 22, spread: 10 },
    { label: 'Blocked shots', kind: 'mean', mean: 14, spread: 6 },
    { label: 'Penalties', kind: 'count', tags: ['PENALTY'] },
  ],
};

const AFL_KICKERS: PosWeights = { FWD: 6, MID: 2.5, RUC: 0.8, DEF: 0.2 };

const aussieRulesPlayers: PlayerModel = {
  // The whole squad rotates through the interchange; the second ruck plays less.
  rotation: { bench: 0.65, byPos: { RUC: [1, 0.3] } },
  close: 12,
  leverage: 0.7,
  plays: {
    GOAL: {
      pos: AFL_KICKERS, star: 1.8, stats: { g: 1, k: 1 }, role: 'goal', headline: 'Goal', impact: 4.5,
      statsIf: [{ when: /marks/, stats: { mk: 1 } }],
      headlineIf: [{ when: /snaps/, headline: 'Snap goal' }, { when: /from 40 out/, headline: 'Set-shot goal' }],
    },
    BEHIND: {
      pos: AFL_KICKERS, star: 1.3, stats: { b: 1, k: 1 }, role: 'behind', headline: 'Behind', impact: 1,
      headlineIf: [{ when: /Rushed/, headline: 'Rushed behind' }, { when: /post/, headline: 'Hit the post' }],
    },
    MARK: {
      pos: { FWD: 3, DEF: 3, MID: 1.5, RUC: 2.5 }, star: 1.5, stats: { mk: 1 }, role: 'mark', headline: 'Contested mark', impact: 2.5,
      headlineIf: [{ when: /Speccy/, headline: 'Speccy' }], impactIf: [{ when: /Speccy/, impact: 5 }],
    },
    TACKLE: { pos: { MID: 4, FWD: 2.5, DEF: 1.5, RUC: 1 }, stats: { tkl: 1 }, role: 'tackle', headline: 'Tackle', impact: 2 },
    CLEARANCE: { pos: { MID: 6, RUC: 1.5, FWD: 0.5, DEF: 0.3 }, star: 1.5, stats: { cl: 1, hb: 1 }, role: 'clearance', headline: 'Clearance', impact: 2 },
    IN50: { pos: { MID: 4, DEF: 2, FWD: 1, RUC: 0.5 }, stats: { k: 1, i50: 1 }, role: 'kick', headline: 'Inside 50', impact: 1 },
    FREE: { pos: { MID: 3, FWD: 2, DEF: 1.5, RUC: 1 }, role: 'free kick', headline: 'Free kick', impact: 1 },
  },
  filler: [
    { stats: { k: 1 }, perTeam: 190, pos: { DEF: 1.05, MID: 1.2, FWD: 0.75, RUC: 0.5 } },
    { stats: { hb: 1 }, perTeam: 150, pos: { DEF: 0.7, MID: 1.5, FWD: 0.6, RUC: 0.8 } },
    { stats: { mk: 1 }, perTeam: 85, pos: { DEF: 1.3, MID: 0.9, FWD: 1, RUC: 1 } },
    { stats: { tkl: 1 }, perTeam: 58, pos: { DEF: 0.6, MID: 1.3, FWD: 1, RUC: 0.7 }, lean: -0.2 },
    { stats: { ho: 1 }, perTeam: 38, pos: { RUC: 20, FWD: 0.3, MID: 0.1 } },
    { stats: { cl: 1 }, perTeam: 35, pos: { MID: 1.5, RUC: 0.7, FWD: 0.15, DEF: 0.1 } },
    { stats: { i50: 1 }, perTeam: 45, pos: { MID: 1.5, DEF: 0.5, FWD: 0.8, RUC: 0.4 }, lean: 0.3 },
  ],
};

const aussieRules: H2HConfig = {
  players: aussieRulesPlayers,
  periods: [1, 2, 3, 4].map((q) => ({ label: `Quarter ${q}`, short: `Q${q}`, clockMin: 20, realMin: 29 })),
  breaks: [{ realMin: 6, label: 'Quarter-time' }, { realMin: 18, label: 'Half-time' }, { realMin: 6, label: 'Three-quarter time' }],
  clock: 'down',
  tie: 'draw',
  homeEdge: 0.06,
  strengthSpread: 0.7,
  totalWord: 'points',
  startText: 'The ball is bounced at {venue}! We are under way.',
  scoring: [
    { tag: 'GOAL', points: 6, mean: 12.5, importance: 2, feedChance: 1, templates: [
      'GOAL! {player} slots it from 40 out.', 'GOAL! {player} snaps around the body!',
      'GOAL! {player} marks in the pocket and kicks truly.', 'GOAL! {player} runs into an open goal for {team}.',
    ] },
    { tag: 'BEHIND', points: 1, mean: 11, importance: 1, feedChance: 0.6, templates: [
      'Behind. {player} pushes the set shot wide.', 'Rushed behind! {player}\'s shot is forced through by {opp}.', '{player} hits the post. One point.',
    ] },
  ],
  flavor: [
    { tag: 'MARK', mean: 4, importance: 2, templates: ['Speccy! {player} takes a huge pack mark.', 'Strong contested mark by {player}.'] },
    { tag: 'TACKLE', mean: 4, importance: 1, templates: ['Holding the ball! {player} lays a crunching tackle.'] },
    { tag: 'FIFTY', mean: 0.8, importance: 2, templates: ['50-metre penalty to {team}!'] },
    { tag: 'CLEARANCE', mean: 4, importance: 1, templates: ['Clean clearance from the centre bounce by {player}.'] },
  ],
  detail: [
    { tag: 'IN50', mean: 10, importance: 1, templates: ['{team} go inside 50.', '{player} launches it long into the forward line.'] },
    { tag: 'FREE', mean: 6, importance: 1, templates: ['Free kick to {player}, high contact.', 'Free kick {team}: in the back.'] },
  ],
  scoreText: (counts, points) => `${counts.GOAL ?? 0}.${counts.BEHIND ?? 0} (${points})`,
  stats: [
    { label: 'Disposals', kind: 'mean', mean: 360, spread: 60 },
    { label: 'Marks', kind: 'count', tags: ['MARK'], base: 80 },
    { label: 'Tackles', kind: 'count', tags: ['TACKLE'], base: 55 },
    { label: 'Clearances', kind: 'count', tags: ['CLEARANCE'], base: 30 },
    { label: 'Inside 50s', kind: 'mean', mean: 52, spread: 12 },
  ],
};

const NETBALL_SHOOTERS: PosWeights = { GS: 6, GA: 3 };
const NETBALL_FEEDERS: PosWeights = { WA: 5, C: 4, GA: 2, GS: 0.5 };
const NETBALL_DEFENDERS: PosWeights = { GD: 4, GK: 3, WD: 3, C: 1.5, WA: 0.5, GA: 0.5 };
const NETBALL_PASSERS: PosWeights = { WA: 3, C: 3, GA: 2, GS: 1, WD: 1, GD: 1 };

const netballPlayers: PlayerModel = {
  rotation: null,
  // Coaches make the odd change at a break.
  subs: { chance: 0.3, from: 0.25, to: 0.75, atBreak: true },
  close: 3,
  leverage: 0.6,
  assistText: ([a]) => ` Feed: ${a}.`,
  plays: {
    GOAL: {
      pos: NETBALL_SHOOTERS, stats: { g: 1 }, role: 'goal', headline: 'Goal', impact: 1.2,
      roles: [{ key: 'assist', side: 'own', pos: NETBALL_FEEDERS, stats: { fd: 1, gass: 1 }, role: 'feed', chance: 0.8 }],
    },
    SUPER: {
      pos: { GA: 5, GS: 4 }, star: 1.5, stats: { g: 1, ss: 1 }, role: 'goal', headline: 'Super Shot', impact: 4,
      roles: [{ key: 'assist', side: 'own', pos: NETBALL_FEEDERS, stats: { fd: 1, gass: 1 }, role: 'feed', chance: 0.8 }],
    },
    INTERCEPT: {
      pos: NETBALL_DEFENDERS, star: 1.5, stats: { int: 1 }, role: 'intercept', headline: 'Intercept', impact: 4,
      roles: [{ key: 'victim', side: 'opp', pos: NETBALL_PASSERS, stats: { to: 1 }, role: 'turnover', silent: true }],
    },
    REBOUND: {
      pos: { GK: 3, GD: 2, GS: 3, GA: 1.5 }, stats: { reb: 1 }, role: 'rebound', headline: 'Rebound', impact: 2,
      roles: [
        { key: 'missed', side: 'opp', pos: NETBALL_SHOOTERS, stats: { miss: 1 }, role: 'miss', silent: true, actorPos: ['GK', 'GD'] },
        { key: 'missedOwn', side: 'own', pos: NETBALL_SHOOTERS, stats: { miss: 1 }, role: 'miss', silent: true, actorPos: ['GS', 'GA'] },
      ],
    },
    FOUL: { pos: { GK: 3, GD: 3, WD: 2.5, C: 2, WA: 1, GA: 1, GS: 0.5 }, stats: { pen: 1 }, role: 'penalty', headline: 'Penalty', impact: 0.5 },
    HELD: { pos: NETBALL_PASSERS, stats: { to: 1 }, role: 'turnover', headline: 'Stepping', impact: 1 },
  },
  filler: [
    { stats: { miss: 1 }, perTeam: 7, pos: NETBALL_SHOOTERS, lean: -0.3,
      with: [
        { chance: 0.6, side: 'opp', pos: { GK: 3, GD: 2 }, stats: { reb: 1 } },
        { chance: 0.6, side: 'own', pos: { GS: 3, GA: 1.5 }, stats: { reb: 1 } },
      ] },
    { stats: { fd: 1 }, perTeam: 22, pos: { WA: 5, C: 5, GA: 2 }, lean: 0.2 },
    { stats: { cpr: 1 }, perTeam: 45, pos: { WA: 6, GA: 3, WD: 1, GD: 0.5 } },
    { stats: { dfl: 1 }, perTeam: 9, pos: { GK: 4, GD: 4, WD: 2, C: 1 }, lean: -0.2 },
    { stats: { int: 1 }, perTeam: 3.5, pos: NETBALL_DEFENDERS, lean: -0.2,
      with: [{ chance: 1, side: 'opp', pos: NETBALL_PASSERS, stats: { to: 1 } }] },
    { stats: { pen: 1 }, perTeam: 45, pos: { GK: 5, GD: 5, WD: 3, C: 3, WA: 1.5, GA: 1.5, GS: 1 } },
    { stats: { to: 1 }, perTeam: 6, pos: NETBALL_PASSERS, lean: -0.3 },
  ],
};

const netball: H2HConfig = {
  players: netballPlayers,
  periods: [1, 2, 3, 4].map((q) => ({ label: `Quarter ${q}`, short: `Q${q}`, clockMin: 15, realMin: 17 })),
  breaks: [{ realMin: 4, label: 'Quarter-time' }, { realMin: 10, label: 'Half-time' }, { realMin: 4, label: 'Three-quarter time' }],
  clock: 'down',
  tie: 'draw',
  homeEdge: 0.05,
  strengthSpread: 0.45,
  countNoise: 0.6,
  totalWord: 'goals',
  startText: 'First centre pass to {team} at {venue}!',
  scoring: [
    { tag: 'GOAL', points: 1, mean: 56, importance: 1, feedChance: 0.22, templates: [
      '{player} scores from close range.', 'Goal from {player} after a slick centre pass, {assist} with the feed.', '{player} makes no mistake under the post.',
    ] },
    { tag: 'SUPER', points: 2, mean: 3, importance: 2, feedChance: 1, templates: ['Super Shot! {player} lands a two-pointer from long range.'] },
  ],
  flavor: [
    { tag: 'INTERCEPT', mean: 8, importance: 2, templates: ['Intercept! {player} reads it perfectly.', 'Flying intercept from {player}!'] },
    { tag: 'REBOUND', mean: 5, importance: 1, templates: ['Rebound to {player}.'] },
    { tag: 'TIMEOUT', mean: 1.5, importance: 1, templates: ['Timeout called by {team}.'] },
  ],
  detail: [
    { tag: 'FOUL', mean: 10, importance: 1, templates: ['Contact penalty against {player}.', 'Obstruction called on {player}.'] },
    { tag: 'HELD', mean: 4, importance: 1, templates: ['Held ball. Free pass to {opp}.', '{player} steps — free pass {opp}.'] },
  ],
  stats: [
    { label: 'Goal accuracy', kind: 'mean', mean: 88, spread: 7, suffix: '%' },
    { label: 'Intercepts', kind: 'count', tags: ['INTERCEPT'], base: 3 },
    { label: 'Rebounds', kind: 'count', tags: ['REBOUND'], base: 3 },
    { label: 'Turnovers', kind: 'mean', mean: 20, spread: 6 },
    { label: 'Penalties', kind: 'mean', mean: 55, spread: 12 },
  ],
};

export const H2H_CONFIGS: Record<string, H2HConfig> = {
  soccer,
  rugby_union: rugbyUnion,
  rugby_league: rugbyLeague,
  basketball,
  american_football: americanFootball,
  ice_hockey: iceHockey,
  aussie_rules: aussieRules,
  netball,
};
