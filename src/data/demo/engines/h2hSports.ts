// Rules and commentary for every two-sided team sport the generic simulator plays.
import type { Importance } from '../../types';

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
}

const soccer: H2HConfig = {
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
    templates: [
      'GOAL! {player} finishes low into the bottom corner for {team}.',
      'GOAL! {player} rises highest to head home from the corner.',
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
      'Big chance! {player} is denied by a flying save.', '{player} rattles the post for {team}!',
      '{player} fires just wide from the edge of the box.', 'Goal-line clearance! {opp} survive a scramble.',
      '{player} volleys over the bar from close range. How did that stay out?', 'Penalty shout for {team}… waved away.',
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
      'Substitution for {team}: {player} comes on.', '{team} make a change — fresh legs with {player}.',
    ] },
    { tag: 'VAR', mean: 0.3, importance: 2, templates: ['VAR check for a possible penalty… no penalty, play on.'] },
  ],
  detail: [
    { tag: 'SHOT', mean: 9, importance: 1, templates: [
      '{player} tries a shot from distance — over the bar.', '{player} shoots from the edge of the box. Blocked.',
      '{player} curls one wide of the far post.', 'Header from {player} drifts just over.', '{player} snatches at it and drags it wide.',
    ] },
    { tag: 'SAVE', mean: 5, importance: 1, templates: [
      'Comfortable save. {player}\'s effort is straight at the keeper.', 'Good save! The keeper tips {player}\'s shot around the post.',
      '{player} forces a diving stop from the keeper.', 'Low drive from {player}, gathered at the second attempt.',
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

const rugbyUnion: H2HConfig = {
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
    { tag: 'TURNOVER', mean: 5, importance: 1, templates: ['Turnover! {player} gets over the ball at the breakdown.', '{team} win a jackal penalty.'] },
    { tag: 'YELLOW', mean: 0.5, importance: 2, templates: ['Yellow card: {player} ({team}) goes to the sin bin for ten minutes.'] },
    { tag: 'TMO', mean: 0.4, importance: 2, templates: ['TMO review for a possible try… ruled held up.'] },
    { tag: 'SCRUM', mean: 3, importance: 1, templates: ['{team} win a scrum penalty.', 'Scrum reset on the {team} 22.'] },
    { tag: 'LINEOUT', mean: 2, importance: 1, templates: ['{team} steal the lineout!'] },
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

const rugbyLeague: H2HConfig = {
  ...rugbyUnion,
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
    { tag: 'ERROR', mean: 6, importance: 1, templates: ['Handling error from {team} near halfway.', '{player} knocks on under the high ball.'] },
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

const basketball: H2HConfig = {
  periods: [1, 2, 3, 4].map((q) => ({ label: `Quarter ${q}`, short: `Q${q}`, clockMin: 12, realMin: 26 })),
  breaks: [{ realMin: 3, label: 'End of Q1' }, { realMin: 14, label: 'Half-time' }, { realMin: 3, label: 'End of Q3' }],
  clock: 'down',
  tie: 'overtime',
  overtime: { label: 'Overtime', short: 'OT', clockMin: 5, realMin: 11, suddenDeath: false },
  homeEdge: 0.05,
  totalWord: 'points',
  startText: 'Tip-off at {venue}! {team} win the jump ball.',
  scoring: [
    { tag: '2PT', points: 2, mean: 29, importance: 1, feedChance: 0.55, templates: [
      '{player} pulls up for a mid-range jumper. Good!', '{player} drives baseline and lays it in.',
      'Alley-oop! {player} throws it down for {team}!', '{player} with a smooth floater in the lane.',
      'Two-handed slam from {player}!', '{player} spins in the post and banks it home.',
    ] },
    { tag: '3PT', points: 3, mean: 12.5, importance: 2, feedChance: 0.9, templates: [
      '{player} buries a three from the corner!', 'Three! {player} from way downtown.',
      '{player} step-back three… bang!', 'Catch-and-shoot triple from {player}.',
    ] },
    { tag: 'FT', points: 1, mean: 17, importance: 1, feedChance: 0.18, templates: ['{player} hits from the line.', '{player} makes the free throw.'] },
  ],
  flavor: [
    { tag: 'BLOCK', mean: 5, importance: 2, templates: ['Huge block by {player}!', '{player} swats it into the stands!'] },
    { tag: 'STEAL', mean: 6, importance: 1, templates: ['Steal by {player} — {team} on the break.'] },
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

const iceHockey: H2HConfig = {
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
    { tag: 'SAVE', mean: 6, importance: 2, templates: ['Huge save robs {player} on the doorstep!', 'Glove save! {player} can’t believe it.'] },
    { tag: 'POST', mean: 1, importance: 2, templates: ['{player} rings it off the post!'] },
    { tag: 'REVIEW', mean: 0.3, importance: 2, templates: ['Video review for goaltender interference… no goal.'] },
  ],
  detail: [
    { tag: 'SHOT', mean: 20, importance: 1, templates: [
      '{player} fires a wrist shot. Saved.', 'Slapshot from the point by {player} — blocked.', '{player} shoots, covered by the goalie.',
      '{player} with a backhand attempt, kicked aside.',
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

const aussieRules: H2HConfig = {
  periods: [1, 2, 3, 4].map((q) => ({ label: `Quarter ${q}`, short: `Q${q}`, clockMin: 20, realMin: 29 })),
  breaks: [{ realMin: 6, label: 'Quarter-time' }, { realMin: 18, label: 'Half-time' }, { realMin: 6, label: 'Three-quarter time' }],
  clock: 'down',
  tie: 'draw',
  homeEdge: 0.06,
  totalWord: 'points',
  startText: 'The ball is bounced at {venue}! We are under way.',
  scoring: [
    { tag: 'GOAL', points: 6, mean: 12.5, importance: 2, feedChance: 1, templates: [
      'GOAL! {player} slots it from 40 out.', 'GOAL! {player} snaps around the body!',
      'GOAL! {player} marks in the pocket and kicks truly.', 'GOAL! {player} runs into an open goal for {team}.',
    ] },
    { tag: 'BEHIND', points: 1, mean: 11, importance: 1, feedChance: 0.6, templates: [
      'Behind. {player} pushes the set shot wide.', 'Rushed behind conceded by {opp}.', '{player} hits the post. One point.',
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

const netball: H2HConfig = {
  periods: [1, 2, 3, 4].map((q) => ({ label: `Quarter ${q}`, short: `Q${q}`, clockMin: 15, realMin: 17 })),
  breaks: [{ realMin: 4, label: 'Quarter-time' }, { realMin: 10, label: 'Half-time' }, { realMin: 4, label: 'Three-quarter time' }],
  clock: 'down',
  tie: 'draw',
  homeEdge: 0.05,
  totalWord: 'goals',
  startText: 'First centre pass to {team} at {venue}!',
  scoring: [
    { tag: 'GOAL', points: 1, mean: 56, importance: 1, feedChance: 0.22, templates: [
      '{player} scores from close range.', 'Goal from {player} after a slick centre pass.', '{player} makes no mistake under the post.',
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
