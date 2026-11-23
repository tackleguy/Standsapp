// Live chat for the simulated world. Every event gets a whole match thread written
// up front from a seed (so every phone sees the same chat), then revealed as time
// passes. The thread is as busy as the crowd: big games post every couple of
// seconds, quiet ones slower, and the stands erupt right after big moments.
// Fans keep one allegiance and one personality, and react to what actually
// happened: the scorer, the clock, the score, lead changes, red cards, the result.
import { sportById } from '@/config/sports';
import { HOUR, MINUTE } from '@/lib/format';
import { createRng, hashText, type Rng } from '@/lib/random';

import type { ChatMessage, EventMeta, EventState, Fan, Play } from '../types';
import { chattersFor, watchersFor } from './crowd';
import { finalState, simulate } from './engines';
import { cachedScript } from './engines/common';
import { FANS } from './fans';
import { planFor } from './plans';
import { eventsBetween } from './schedule';
import { competitorById, squadFor } from './world';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Personality = 'hype' | 'nerd' | 'doom' | 'neutral' | 'joker';

/** A big moment shown as a card inside the chat stream. */
export interface ChatMoment {
  tag: string;
  label: string;
  icon: string;
  /** "BRA 2-1 RIV", "HIG 39/2", or a short status. */
  line: string | null;
  clock: string;
  competitorId: string | null;
  importance: number;
  description: string;
}

export interface ChatEntry extends ChatMessage {
  kind: 'fan' | 'moment';
  /** The side this fan is backing today (drives the supporter chip). */
  supports: string | null;
  replyTo: { username: string; body: string } | null;
  moment: ChatMoment | null;
}

// ---------------------------------------------------------------------------
// Line pools. {placeholders} are filled per message; a line is skipped when a
// placeholder it needs is not known in that moment (e.g. {them} in a race).
// ---------------------------------------------------------------------------

const PRE: Record<Personality, string[]> = {
  hype: [
    'Big one today. Come on {us}!', '{us} by two, calling it now', '{startWord} can’t come soon enough', 'Let’s goooo {us} 🔥',
    'Feeling good about this one', '{usPlayer} is going to have a day, trust me', 'Who’s ready?? 🙌', 'Matchday energy 😤',
    'Been waiting all week for this', '{venue} is going to be rocking', '{us} fans make some noise in here', 'Three in a row incoming',
    'Got the jersey on, ready to go', 'Nothing but a win today', 'This is our year', 'Bring it on {them}',
  ],
  nerd: [
    '{us} have won {n} of their last 5', 'Form says {us}, but {them} travel well', 'Key battle today: {usPlayer} vs {themPlayer}',
    'Odds have drifted on {them} all morning', 'Last meeting was a cracker', 'Expecting a cagey first {period} tbh',
    'Numbers say this is closer than people think', '{usPlayer} has been in great form',
  ],
  doom: [
    'Got a bad feeling about this one', '{them} always cause us problems', 'Not getting my hopes up', 'We never win at {venue}',
    'Watch us find a way to lose this', 'Nervous for {us} today',
  ],
  neutral: [
    'Predictions?', 'Who are we backing?', 'First time in here, hi all 👋', 'Should be a good one', 'Upset alert 🚨',
    'Watching from {city} tonight', 'Who’s everyone got?', 'This fixture always delivers', 'Snacks ready, settling in',
    '{startWord} in {mins} mins', 'Anyone else here for the chaos?', 'Weather looks perfect for it', 'Evening all 👋',
    'Just got home, made it in time', 'Who’s making Calls on this?', 'Big crowd in here already', 'Kids are in bed, game time',
    'What’s the line on this one?', 'Rate the build-up so far 😂', 'Neutral today, just want goals', 'Haven’t missed one of these all season',
  ],
  joker: [
    'Told my partner it’s a “quick game” 😂', 'Fake injury watch begins now', 'My lucky socks are on. You’re welcome.',
    'Ref has already decided the result', 'Pre-match nap was elite', 'If {us} lose I’m blaming this chat',
  ],
};

/** Build-up lines that only make sense for team games. */
const PRE_TEAM = ['Interesting team news, {usPlayer} starts', 'If {usPlayer} doesn’t start we’re cooked', '{them} concede a lot late in games',
  'If {us} press high early this could get ugly', 'Lineups are out 👀', 'Draw at best. Prove me wrong.', 'Warm-ups look sharp from {us}'];

const START = ['HERE WE GO', '{startWord}! Come on {us}', 'And we’re off 🙌', 'Settle in everyone', 'Let’s have it {usShort}',
  'Big {period} incoming', 'Strap in', 'COME ON {usShort}', 'Good luck all', 'Game face on 😤'];

const LIVE: Record<'level' | 'ahead' | 'behind' | 'cruising' | 'chasing' | 'late' | 'any', string[]> = {
  level: ['Tight one so far', 'Still all square, nervy stuff', 'Someone needs to take a chance here', '{us} look the better side',
    '{them} are hanging on', 'Feels like the next score wins it', 'Cagey. Very cagey.', 'Need more from {usPlayer}'],
  ahead: ['{us} in control 👌', 'Keep it tight, see it out', 'Don’t get complacent {usShort}', 'I could get used to this',
    'One more and it’s done', 'Loving this from {us}', '{usPlayer} running the show', 'Proper performance this'],
  behind: ['Come on {us}, wake up', 'We need a change', 'Still time…', 'This is painful', '{them} deserve it so far tbh',
    'Coach has to do something', 'Why are we so slow today', 'Get {usPlayer} on the ball!!', 'Long way back from here'],
  cruising: ['This is a demolition', 'Turn it off, it’s over 😂', '{them} fans have gone very quiet', 'Statement win incoming',
    'Rest the starters', 'Masterclass from {us}'],
  chasing: ['It’s gone. It’s gone.', 'Embarrassing from {us}', 'I’m switching over', 'Worst I’ve seen us all season',
    'Nothing is working', 'Just want the final whistle now'],
  late: ['Nails gone 😬', 'Squeaky bum time', 'Can’t watch', 'Every possession matters now', 'Heart rate through the roof',
    'Hold on {us} 🙏', 'Clock please move faster', 'This finish!!', 'Somebody be a hero'],
  any: ['This atmosphere 🔥', 'Second screen gang 📱', 'What a game this is', 'Best game of the day', 'Chat is flying tonight',
    'Watching from work, don’t tell my boss', 'Anyone else got this on two screens?', '{venue} sounds loud',
    'Refs letting a lot go today', 'Rate that last play a 9', '{usPlayer} everywhere tonight', 'This pace is ridiculous',
    'Who’s your player of the game so far?', 'Grabbing a drink, don’t let anything happen'],
};

const LIVE_PERSONA: Record<Personality, string[]> = {
  hype: ['WE’RE SO BACK', 'Energy in here is unreal 🔥', '{usShort} {usShort} {usShort} 👏', 'I believe!!', 'Huge from {usPlayer}'],
  nerd: ['{us} have had {pct}% of the play', 'Shot map is all one way', 'Interesting shape from {them} now',
    '{usPlayer} quietly having a great game', 'Pressing numbers are wild today', 'Tempo dropped since the last break'],
  doom: ['Here we go again…', 'I can feel it slipping', 'Classic {us}', 'Not celebrating till the end', 'We always do this'],
  neutral: ['Good contest this', 'Both teams going for it', 'Enjoying this one', 'Fair result so far', 'Neutral here, great watch'],
  joker: ['My dog could defend better 😂', 'I’ve aged five years tonight', 'Commentators can’t pronounce {usPlayer} 😂',
    'Ref needs glasses', 'Who let {them} cook', 'Ok who jinxed it 😂', 'Pls stop doing this to me {us}'],
};

type Kind = 'team' | 'motor' | 'golf' | 'cycling' | 'tennis' | 'combat' | 'cricket';

/** What fans of each team sport actually shout about. */
const SPORT_TALK: Record<string, string[]> = {
  soccer: ['Keeper is having a blinder', 'Offside trap is working', 'Set pieces will decide this', 'Get it in the box!', 'SHOOT!!',
    'Too many backward passes', 'Press them!!', 'Width, we need width', 'That was a dive 🙄', 'Ref, that’s a yellow all day',
    'Midfield is getting overrun', 'Lovely one-two there', 'Hit the target at least 😩', 'Corners are useless today', 'Counter attack!!'],
  basketball: ['DEFENSE 👏👏', 'Free throws please go in', 'Need a stop here', 'That crossover 😳', 'Turnovers are killing us',
    'Run the offense through {usPlayer}', 'Box out!!', 'Timeout needed', 'Ball movement is beautiful', 'Bench needs minutes',
    'Shot clock violation lol', 'And-one!!', 'Stop fouling!!', 'Full-court press time', 'Rebounding is the difference'],
  rugby_union: ['Penalty count is ridiculous', 'Kick to the corner!', 'Scrum is getting destroyed', 'Brilliant breakdown work',
    'Go for the posts', 'Phase after phase', 'Lineout is a lottery', 'Big hit!!', 'Offside at every ruck', 'Width! Use the width!'],
  rugby_league: ['Six again!', 'Completion rate needs work', 'Big hit!!', 'Last tackle kick please', 'Ruck speed is everything',
    'Defence holding strong', 'Get it wide', 'Penalty, kick for touch'],
  american_football: ['Run the ball!', 'Defense is gassed', 'Fourth down, go for it', 'That pass rush 😳', 'Clock management please',
    'QB looks rattled', 'Holding, every play', 'Throw it deep!', 'Red zone efficiency please', 'Special teams are a disaster',
    'O-line needs to wake up', 'Huge third down coming'],
  ice_hockey: ['Power play time', 'Goalie standing on his head', 'Shoot the puck!', 'Big hit!', 'Line changes are slow', 'Penalty kill was elite',
    'Get pucks deep', 'Pull the goalie?', 'That save 😳', 'Too many men again??'],
  baseball: ['Bullpen time?', 'Need a big inning', 'That curveball is nasty', 'Bases loaded 😬', 'Swing at strikes please', 'Great glove work',
    'Pitch count is getting high', 'Two outs, come on', 'Small ball, love it', 'Leave the starter in'],
  aussie_rules: ['Kick it long!', 'Huge mark', 'Tackle count is insane', 'Run and carry', 'Holding the ball!!', 'Goal square scramble',
    'Rucks are dominant', 'Switch it!'],
  netball: ['Great intercept', 'Centre pass wins it', 'Shooting % is elite', 'Defence is suffocating', 'Contact called again 🙄',
    'Feed the shooter!', 'Tidy hands', 'Super shot time?'],
};

/** Talk about a player on either side (names vary, so lines rarely repeat). */
const PLAYER_TALK = ['Lovely touch from {usPlayer}', 'Great work rate from {usPlayer}', 'Huge play by {usPlayer}', '{usPlayer} is on fire',
  'Why is {usPlayer} so quiet today', '{usPlayer} needs to be more selfish', 'Give {usPlayer} the ball!', '{usPlayer} looks tired',
  '{usPlayer} should be captain', '{usPlayer} MVP so far', '{themPlayer} is a problem', 'Someone stop {themPlayer}!', '{themPlayer} has been quiet, good',
  'Can we sign {themPlayer}?', '{usPlayer} > {themPlayer}, not close', '{themPlayer} is getting away with murder', '{usPlayer} injury? Looked sore'];

/** In-game talk for sports that are not two teams trading scores. */
const KIND_ANY: Record<Exclude<Kind, 'team'>, string[]> = {
  motor: ['This race is mega', 'Tyre deg is going to decide this', 'Strategy call coming soon', 'Gap is coming down 👀', '{usPlayer} on a charge',
    'Who wins from here?', 'Midfield battle is the best bit', 'Onboards are insane today', 'Track temp is climbing', 'Undercut window is open',
    'Pit wall needs to wake up', 'Radio messages are spicy today', '{usPlayer} looks quick in the middle sector', 'Rain on the radar??'],
  golf: ['Pins are brutal today', 'Leaderboard is so bunched', 'Back nine is where it happens', '{usPlayer} rolling it nicely', 'Wind picking up',
    'Who wins from here?', 'That greenside bunker is eating people', 'Putter is hot for {usPlayer}', 'Sunday-style pressure already'],
  cycling: ['Break has a big gap', 'Peloton not panicking yet', 'Crosswinds could split this', '{usPlayer} sitting pretty', 'Who goes on the final climb?',
    'Helicopter shots are stunning', 'Teams lining it out at the front', 'Bidons everywhere 😂'],
  tennis: ['Serve is everything today', 'Rallies are long', '{usPlayer} needs a better first-serve %', 'Crowd is into it', 'Momentum swinging',
    'Who takes this set?', 'Unforced errors creeping in', 'Body language says a lot', 'That forehand is a weapon'],
  combat: ['Feeling-out process', 'Jab is landing', 'Who’s winning this round?', 'Body work will pay off', 'Cardio check incoming', '{usPlayer} looks sharp',
    'Clinch city', 'Corner needs to adjust', 'Scorecards could be close'],
  cricket: ['Run rate creeping up', 'Spinners on now', 'Field is spread', 'Need a partnership', 'Required rate getting steep', '{usPlayer} timing it beautifully',
    'Death overs will decide this', 'Pitch is slowing down', 'Great over that', 'Who’s bowling the 18th?'],
};

/** Personality lines that work for any sport (no defending, no refs). */
const FIELD_PERSONA: Record<Personality, string[]> = {
  hype: ['Energy in here is unreal 🔥', 'I believe!!', 'Huge from {usPlayer}', 'LET’S GOOO {usShort}', 'This is why I watch'],
  nerd: ['Pace numbers are interesting', 'Data says {usPlayer} is quickest right now', 'Look at the consistency from {usPlayer}', 'Gaps tell the story'],
  doom: ['Here we go again…', 'I can feel it slipping', 'Not celebrating till the end', 'Always something with {usPlayer}'],
  neutral: ['Good contest this', 'Enjoying this one', 'Neutral here, great watch', 'Lovely to watch'],
  joker: ['I’ve aged five years tonight', 'Commentators can’t pronounce {usPlayer} 😂', 'Ok who jinxed it 😂', 'My heart rate is a sport now'],
};

const CALLS = ['In-play Call on {us} at {mult}x, let’s ride', 'Got {stake} Clout on {us} to win 🤞', 'Over Call looking good so far',
  'Who has the first-score Call? Cashing?', 'Clout on the line here 😬', '{mult}x on {us} was free money', 'Live odds on {them} just shortened 👀',
  'My Calls this week: 💀', 'Gate Check streak alive, Calls not so much 😂'];

const BREAK = ['{breakLabel} thoughts?', 'Need a better {period} after that', 'Good {period} for {us}', 'Snack run, back in 10',
  'Changes needed at the break', 'Ref has had a shocker so far', '{usPlayer} has been our best player', 'Deserved, honestly',
  'Rate the {period} out of 10?', 'Tactics talk please, what are we changing?', 'Breathe, everyone. Breathe.'];

const SCORE_FOR = ['{WORD}!!! {player} 🔥', 'YESSS {player}', '{player} you beauty', 'GET IN {usShortUp}', 'What a {word} from {player}',
  '{usScore}-{themScore} LETS GOOO', 'I knew {player} would deliver', '{player} = ice in the veins', 'SCENES 😭', 'Get in there!!',
  'That’s why {player} plays', 'Beautiful build-up 👏', 'Take a bow {player}', 'Oh I love this team'];
const SCORE_AGAINST = ['Nooo', 'How was {player} left free??', 'Defending is shocking', 'Of course it’s {player}', 'That’s on us',
  '{them} again… ugh', 'Wake up {us}', 'Unreal how bad that was', 'Here we go again', 'Nobody tracked {player}?', 'Sloppy. So sloppy.'];
const SCORE_NEUTRAL = ['What a {word}', 'Wow', 'Game on now', '{player} with a {word}!', 'Rate that a 9', 'Did not see that coming',
  'Clinical from {team}', '{team} mean business'];
const LEVEL_FOR = ['LEVEL!! Game on', 'WE’RE BACK IN IT', 'Comeback starts now', '{usScore}-{themScore}! Told you', 'Never in doubt 😅'];
const LEVEL_AGAINST = ['Threw it away', 'Can’t believe we let that in', 'Level. Unreal.', 'We had this!!'];
const LEAD_FOR = ['COMEBACK IS ON', 'From behind!! Love this team', 'Who doubted us??', 'WE’RE AHEAD 😱', 'Turned it around!!'];
const LEAD_AGAINST = ['Bottled it', 'We were cruising…', 'How have we lost the lead', 'This hurts'];
const LATE_FOR = ['AT THE DEATH!!', 'LATE {WORD} 😭😭', 'Scenes. Absolute scenes.', 'I’m shaking'];
const LATE_AGAINST = ['Gut punch', 'At the death… brutal', 'I need a lie down'];

const MISS_FOR = ['So close!!', 'How did that not go in', 'Unlucky {player}', 'Inches away 😩', 'Keep going, it’s coming'];
const MISS_AGAINST = ['Phew', 'Let off there', 'Heart stopped', 'That was nearly it', 'Wake up at the back!'];

const CARD_FOR = ['That’s never a {card}!', 'Ref has lost the plot', 'Soft. So soft.', 'Down to ten… great', 'We’re getting nothing today'];
const CARD_AGAINST = ['Deserved', 'Off you go 👋', 'Big advantage now', 'Rash from {player}', 'Make it count {us}'];

const OT = ['OVERTIME!!', 'We’re going to OT 😱', 'Extra time let’s go', 'Can my heart take more?', 'Free {sport}! 🙌'];

const FINAL_WIN = ['GET IN!!', 'WHAT A WIN', '{us} {usScore}-{themScore}, never in doubt', 'Massive win', 'Cash those Calls 💰',
  'Proud of this team', 'Big result that', 'Statement win 🔥', 'Sleep well tonight'];
const FINAL_LOSS = ['Gutted', 'Deserved nothing tbh', 'Long week ahead', 'Ref cost us', 'Back to the drawing board', 'Unacceptable',
  'Hurts.', 'Not good enough'];
const FINAL_DRAW = ['Fair result', 'Point is a point', 'Feels like a loss', 'We’ll take that', 'Two points dropped'];
const FINAL_FIELD = ['P{pos} for {usPlayer}, I’ll take it', 'Tough day for {usPlayer}', 'Strategy let {usPlayer} down', 'Points are points',
  'Next time {usPlayer}!', 'P{pos}… could have been worse', 'Solid from {usPlayer} today'];
const FINAL_NEUTRAL = ['GG all', 'What a game', 'Entertaining one', 'That was worth staying up for', 'Great watch 👏'];
const POST = ['Player of the game: {player}', 'Rate the game out of 10?', 'See you next time 👋', 'Need a lie down after that',
  'Highlights will be good', 'My Calls went well for once 😅', 'Next one can’t come soon enough', 'Good chat tonight all',
  'Same time next week?', 'That {word} from {player} though…'];

// Individual-sport reactions, keyed by play tag.
const TAG_FOR: Record<string, string[]> = {
  LEAD: ['{player} LEADS!!', 'P1 baby 🏆', 'What a move from {player}', 'Into the lead!!'],
  OVERTAKE: ['Send it!!', 'Clean move from {player}', 'Up we go 👏', '{player} on a charge'],
  DNF: ['NOOO {player} is out', 'Heartbroken', 'Reliability again…', 'Not like this 😭'],
  WICKET: ['GOT HIM!', 'Huge wicket', 'What a ball!!', 'Breakthrough 🙌', 'Gone! Get in'],
  SIX: ['SIX!! Into the stands', 'Out of the ground!', 'Massive hit from {player}', 'Into orbit 🚀'],
  FOUR: ['Cracking shot', 'Four more 👏', 'Timing!'],
  FIFTY: ['Take a bow {player}', 'Class fifty', 'Carrying us {player}'],
  HUNDRED: ['HUNDRED!! {player} 👑', 'What a knock', 'Standing ovation for {player}'],
  BREAK: ['Break!!', 'Huge break', 'Serving for it soon', 'Momentum!!'],
  SET: ['Set {player}!', 'One set away', 'That’s the set 🔥'],
  ACE: ['ACE!!', 'Unreturnable', 'Hole in one 😱', 'Untouchable'],
  KNOCKDOWN: ['DOWN HE GOES', 'WHAT A SHOT', 'Finish it!!', 'He’s hurt!'],
  EAGLE: ['Eagle!! Moving up', 'Holed it!', 'Big move from {player}'],
  BIRDIE: ['Birdie 👏', 'Rolling now', 'Another one'],
  ATTACK: ['{player} has gone!', 'ATTACK!!', 'Go go go'],
  SPRINT: ['Sprint time!', 'Wheels!!'],
  FINAL: ['WHAT A WIN {player}', 'Champion stuff', 'Never in doubt', 'Let’s goooo'],
};
const TAG_AGAINST: Record<string, string[]> = {
  LEAD: ['Defend!!', 'Cover the undercut', 'Not like that…'],
  WICKET: ['Terrible shot', 'Throwing it away', 'Need a partnership now', 'Why would you play that'],
  SIX: ['Bowl better', 'Line and length please', 'Ouch'],
  BREAK: ['Need to break back', 'Serving badly today', 'Come on…'],
  SET: ['Still time', 'Need a big response', 'Reset and go again'],
  KNOCKDOWN: ['Get up!!', 'Survive the round', 'Hold on'],
  FINAL: ['Gutted', 'Unlucky today', 'Next time'],
};
const TAG_NEUTRAL: Record<string, string[]> = {
  LEAD: ['New leader!', 'Strategy paying off for {team}', 'What a move for the lead', 'Race is on now'],
  OVERTAKE: ['Lovely move', 'DRS train broken', 'Racing!'],
  DNF: ['Ouch for {player}', 'Huge for the championship', 'Brutal luck'],
  SC: ['Safety car! Strategy chaos incoming', 'Box box box', 'Pit now or never', 'Free stop for someone'],
  PIT: ['Good stop', 'Undercut attempt?', 'Tyres were gone'],
  FASTEST: ['Purple sectors everywhere', 'Fastest lap point 👀'],
  FINAL_LAP: ['Last lap!!', 'Bring it home', 'Hold your nerve'],
  WICKET: ['Big moment', 'Game changer', 'Pressure tells'],
  SIX: ['Huge hit', 'Out of here!'],
  INNINGS: ['Par score?', 'Gettable target?', 'Chase on'],
  BREAK: ['Break of serve', 'Momentum swing'],
  SET: ['Set point converted', 'Decider incoming?'],
  MATCHPOINT: ['MATCH POINT', 'Here we go…'],
  TIEBREAK: ['Tiebreak!!', 'Nerves'],
  KNOCKDOWN: ['WHAT A SHOT', 'Ref watching closely', 'Wow'],
  ROUND: ['Round to the red corner?', 'Close round', 'Scorecards are going to be messy'],
  ACE: ['Hole in one!!', 'Unreal'],
  EAGLE: ['Eagle!', 'Leaderboard shake-up'],
  CATCH: ['Break caught, sprint finish incoming', 'All together again'],
  FLAMME: ['One km!!', 'Here come the sprinters'],
  FINAL: ['What a finish', 'GG', 'Deserved winner'],
};

const REPLIES = ['@{user} facts', '@{user} not a chance', '@{user} you said that last week 😂', '@{user} say it louder',
  '@{user} relax, long way to go', '@{user} cope 😂', '@{user} 100%', '@{user} exactly what I was thinking', '@{user} bold call',
  '@{user} screenshotting this', '@{user} we’ll see', '@{user} hard disagree', '@{user} 😂😂', '@{user} this guy gets it',
  '@{user} respectfully, no', '@{user} ok that’s funny'];

const REPLIES_TO_ME = ['@{user} 💯', '@{user} bold call', '@{user} you’re not wrong', '@{user} welcome to the stands 👋',
  '@{user} agree', '@{user} hmm not sure about that', '@{user} said it before me', '@{user} 😂 fair', '@{user} spoken like a true fan',
  '@{user} we’ll see about that'];

const SECTION_LINES: Record<string, string[]> = {
  default: [
    'Anyone watching tonight?', 'My Calls this week have been a disaster 😂', 'Gate Check streak at {n} days 💪',
    'Who is top of the board right now?', 'Just pulled an epic card!!', 'That last game was a classic',
    'We need more people in here, share the code', 'Big weekend coming up', 'Hot take: the underdogs are due',
    'Hey Section 👋', 'Rate the last match out of 10?', 'I owe this Section an apology for that Call',
    'Who’s making Calls on the late games?', 'Legendary pull incoming, I can feel it', 'Leaderboard is tight this week 👀',
    'Back from work, what did I miss?', 'That ref yesterday 🙄', '{n}-day Gate Check streak and counting',
    'Anyone want to start a side bet? Loser changes their avatar 😂', 'Who’s around?', 'Back for the late games',
    'Who’s got the best Call record in here?', 'New card pull: rare! 👀', 'Weekly leaderboard reset soon, last push',
  ],
  f1: ['Pole lap was insane', 'Tyre strategy is everything this weekend', 'Safety car Call paid out for me 💰', 'Who is winning the sprint?',
    'Championship is getting spicy', 'Undercut or overcut, discuss', 'That pit stop was 2.1s, ridiculous'],
  cricket: ['That run chase was unreal', 'Need a big total batting first', 'Spinners will decide this one', 'Sixes Call is free Clout',
    'Powerplay was carnage', 'Death bowling needs work'],
  rugby_union: ['Scrum was dominant today', 'That try in the corner 😍', 'Bench made the difference', 'Kicking game needs work',
    'TMO took forever', 'Lineout was a mess'],
  soccer: ['What a strike that was', 'Clean sheet incoming', 'Midfield battle is everything', 'VAR strikes again',
    'Table is so tight this season', 'Who’s your golden boot pick?'],
  basketball: ['Fourth quarter was madness', 'Defense wins championships', 'Over Call hit easily', 'That dunk though 😳',
    'Bench mob carried', 'Free throws cost us again'],
};

const SECTION_RESULT = ['{winner} beating {loser} {score} 😮', 'Did anyone see {winner} vs {loser}?? {score}!', '{winner} {score}. Called it.',
  '{loser} were awful against {winner}', 'Big win for {winner} today', 'That {winner} result changes the table'];
const SECTION_LIVE = ['Anyone watching {title}? {line} right now', '{line} in {title}, tense', 'Switch on {title}, it’s a good one',
  '{title}: {line}. Come on!!'];

const REACTION_EMOJI = ['🔥', '😂', '😮', '👏', '😤'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PERSONALITIES: Personality[] = ['hype', 'hype', 'hype', 'neutral', 'neutral', 'nerd', 'nerd', 'doom', 'doom', 'joker'];

export function personalityOf(fanId: string): Personality {
  return PERSONALITIES[hashText(`persona:${fanId}`) % PERSONALITIES.length];
}

const REACTIONS_BY_TONE: Record<'up' | 'down' | 'flat', string[]> = {
  up: ['🔥', '🔥', '👏', '😤', '🙌'], down: ['😤', '😮', '💀', '😂'], flat: ['😂', '👏', '🔥', '😮', '👀'],
};

function reactionsFor(seed: string, boost: number, tone: 'up' | 'down' | 'flat' = 'flat'): Record<string, number> {
  const rng = createRng(seed);
  const out: Record<string, number> = {};
  if (!rng.chance(0.38 + boost)) return out;
  const n = rng.int(1, boost > 0.2 ? 3 : 2);
  for (let i = 0; i < n; i++) out[rng.pick(REACTIONS_BY_TONE[tone])] = rng.int(1, 4 + Math.round(boost * 40));
  return out;
}

function fillLine(template: string, vals: Record<string, string | undefined>): string | null {
  let missing = false;
  const out = template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = vals[key];
    if (v === undefined || v === '') { missing = true; return ''; }
    return v;
  });
  return missing ? null : out;
}

/** Which lines were said, and how many messages ago. */
interface Memory { used: Map<string, number>; n: number }

/** Lines said within this many messages count as "just said". */
const FRESH_AFTER = 180;

function isStale(mem: Memory, line: string): boolean {
  const last = mem.used.get(line);
  return last !== undefined && mem.n - last <= FRESH_AFTER;
}

/**
 * Picks a line from the pool that can be filled and has not been said lately;
 * when the pool is worn out, the line said longest ago.
 */
function pickLine(rng: Rng, pool: readonly string[], vals: Record<string, string | undefined>, mem: Memory): string | null {
  let best: string | null = null;
  let bestAge = -1;
  for (let tries = 0; tries < 8; tries++) {
    const line = fillLine(rng.pick(pool), vals);
    if (!line) continue;
    const last = mem.used.get(line);
    const age = last === undefined ? Number.MAX_SAFE_INTEGER : mem.n - last;
    if (age > FRESH_AFTER) return line;
    if (age > bestAge) { best = line; bestAge = age; }
  }
  return best;
}

type Tone = 'up' | 'down' | 'flat';
const OPENERS = ['ngl ', 'honestly ', 'lads ', 'ok ', 'bro ', 'yo '];
const TAILS: Record<Tone, string[]> = {
  up: ['', '', '!!', ' 🔥', ' 🙌', ' 😤', '!'], down: ['', '', '…', ' 😩', ' 💀', ' 🙄'], flat: ['', '', '', ' 👀', '.'],
};
/** Words that are safe to lower-case after an opener (never a name). */
const COMMON_START = /^(This|That|What|Who|Still|Need|Keep|Come|Best|Big|Good|Not|Here|Feels|Tight|Someone|Refs|Rate|Chat|Watching|Anyone|Grabbing|Interesting|Pressing|Shot|Tempo|Energy|Enjoying|Both|Fair|Classic|We|It|Every|Hold|Clock|Somebody|Nails|Long|Why|Get|One|Loving|Proper|Turn|Rest|Statement|Embarrassing|Worst|Nothing|Just|Coach|Predictions|Should|Snacks|Feeling|Been|Got|Numbers|Expecting|Last|Odds|Form|Weather|Lineups|Warm|Track|Strategy|Gap|Midfield|Onboards|Pins|Leaderboard|Back|Wind|Serve|Rallies|Crowd|Momentum|Jab|Body|Cardio|Run|Spinners|Field|Pitch|Great|Break|Peloton|Crosswinds|Teams|Helicopter|Unforced|Tyre|Radio|Rain|Undercut|Pit|Death|Required)\b/;

const TONE = new Map<readonly string[], Tone>();
for (const pool of [SCORE_FOR, LEVEL_FOR, LEAD_FOR, LATE_FOR, FINAL_WIN, OT, START, LIVE.ahead, LIVE.cruising, MISS_FOR, LIVE_PERSONA.hype,
  PRE.hype, ...Object.values(TAG_FOR)]) TONE.set(pool, 'up');
for (const pool of [SCORE_AGAINST, LEVEL_AGAINST, LEAD_AGAINST, LATE_AGAINST, FINAL_LOSS, LIVE.behind, LIVE.chasing, CARD_FOR, LIVE_PERSONA.doom,
  PRE.doom, ...Object.values(TAG_AGAINST)]) TONE.set(pool, 'down');

function endsWithMark(text: string): boolean {
  const last = [...text].pop() ?? '';
  return '!?.…'.includes(last) || (last.codePointAt(0) ?? 0) > 0x2100;
}

/** Personal touches so the same line reads differently from different people. */
function voice(rng: Rng, line: string, persona: Personality, tone: Tone = 'flat'): string {
  let out = line;
  if (rng.chance(0.12) && COMMON_START.test(out)) out = rng.pick(OPENERS) + out.charAt(0).toLowerCase() + out.slice(1);
  if (!endsWithMark(out) && rng.chance(0.5)) {
    out += persona === 'joker' && tone !== 'up' && rng.chance(0.5) ? rng.pick([' 😂', ' lol', ' 💀']) : rng.pick(TAILS[tone]);
  }
  if (persona === 'hype' && tone === 'up' && rng.chance(0.25)) out = out.toUpperCase();
  return out;
}

/** "A. Zorrilla" or "Leila Castell" from a play's description. */
function playerFrom(play: Play): string | null {
  const initial = /\b([A-Z]\. [A-Z][A-Za-z'’-]+)/.exec(play.description);
  if (initial) return initial[1];
  const c = competitorById(play.competitorId);
  if (c?.kind === 'athlete' && play.description.includes(c.name)) return c.name;
  const named = /^([A-Z][a-z]+ [A-Z][A-Za-z'’-]+)\b/.exec(play.description);
  return named ? named[1] : null;
}

function surname(name: string): string {
  const parts = name.split(' ');
  return parts[parts.length - 1];
}

const START_WORD: Record<string, string> = {
  soccer: 'Kick-off', rugby_union: 'Kick-off', rugby_league: 'Kick-off', american_football: 'Kick-off', aussie_rules: 'First bounce',
  basketball: 'Tip-off', netball: 'First centre pass', ice_hockey: 'Puck drop', baseball: 'First pitch', cricket: 'First ball',
  tennis: 'First serve', golf: 'Tee off', f1: 'Lights out', motogp: 'Lights out', indycar: 'Green flag', mma: 'Walkouts',
  boxing: 'Ring walks', cycling: 'Flag drop',
};

const PERIOD_WORD: Record<string, string> = {
  soccer: 'half', rugby_union: 'half', rugby_league: 'half', american_football: 'quarter', aussie_rules: 'quarter', basketball: 'quarter',
  netball: 'quarter', ice_hockey: 'period', baseball: 'inning', cricket: 'innings', tennis: 'set', golf: 'round', f1: 'stint',
  motogp: 'race', indycar: 'stint', mma: 'round', boxing: 'round', cycling: 'stage',
};

const SCORE_WORDS: Record<string, [string, string]> = {
  GOAL: ['goal', 'GOAL'], TRY: ['try', 'TRY'], TD: ['touchdown', 'TOUCHDOWN'], HR: ['home run', 'HOME RUN'], '3PT': ['three', 'THREE'],
  '2PT': ['bucket', 'BUCKET'], FT: ['free throw', 'FREE THROW'], FG: ['kick', 'FIELD GOAL'], PEN: ['penalty', 'PENALTY'],
  DROP: ['drop goal', 'DROP GOAL'], RUN: ['run', 'RUN'], SUPER: ['super shot', 'SUPER SHOT'], BEHIND: ['point', 'POINT'],
  CONV: ['conversion', 'CONVERSION'], PAT: ['extra point', 'EXTRA POINT'], SAF: ['safety', 'SAFETY'], WALKOFF: ['walk-off', 'WALK-OFF'],
};

const MOMENT_ICON: Record<string, string> = {
  GOAL: '⚽', TRY: '🏉', TD: '🏈', HR: '⚾', WALKOFF: '⚾', RED: '🟥', SINBIN: '🟨', YELLOW: '🟨', FINAL: '🏁', START: '🟢',
  PERIOD: '⏸', SHOOTOUT: '🎯', WICKET: '🏏', SIX: '🏏', HUNDRED: '💯', FIFTY: '🏏', INNINGS: '🏏', LEAD: '🏎', DNF: '💥',
  SC: '🚨', CRASH: '💥', SET: '🎾', MATCHPOINT: '🎾', BREAK: '🎾', KNOCKDOWN: '🥊', ACE: '⛳', EAGLE: '🦅', CATCH: '🚴',
  FINAL_LAP: '🏁', '3PT': '🏀', OVERTAKE: '🏎', FG: '🏈', DROP: '🏉',
};

function sportIconEmoji(sportId: string): string {
  const map: Record<string, string> = {
    soccer: '⚽', basketball: '🏀', rugby_union: '🏉', rugby_league: '🏉', american_football: '🏈', baseball: '⚾', ice_hockey: '🏒',
    aussie_rules: '🏉', netball: '🏐', cricket: '🏏', tennis: '🎾', golf: '⛳', f1: '🏎', motogp: '🏍', indycar: '🏎', mma: '🥊',
    boxing: '🥊', cycling: '🚴',
  };
  return map[sportId] ?? '📣';
}

function momentLabel(play: Play): string {
  if (play.tag === 'PERIOD') return play.clock.toUpperCase();
  if (play.tag === 'FINAL') return play.clock === 'FT' ? 'FULL TIME' : 'FINAL';
  if (play.tag === 'START') return 'UNDER WAY';
  if (play.tag && SCORE_WORDS[play.tag]) return SCORE_WORDS[play.tag][1];
  return (play.tag ?? 'BIG MOMENT').replace('_', ' ');
}

/** Weighted fan pool: fans of this sport turn up three times as often. */
function fanPool(sportId: string): Fan[] {
  const keen = FANS.filter((f) => f.favoriteSportId === sportId);
  return [...keen, ...keen, ...keen, ...FANS];
}

// ---------------------------------------------------------------------------
// Event threads
// ---------------------------------------------------------------------------

interface ScoreAt { at: number; h: number; a: number }

interface Ctx {
  meta: EventMeta;
  final: EventState;
  sportName: string;
  sportId: string;
  kind: Kind;
  isTeamGame: boolean; // two sides with a running score we can read
  teams: string[];
  scores: ScoreAt[];
  breaks: { from: number; to: number; label: string }[];
  pool: Fan[];
}

function readScore(s: string | null): [number, number] | null {
  if (!s) return null;
  const m = /^(\d+)-(\d+)$/.exec(s.trim());
  return m ? [Number(m[1]), Number(m[2])] : null;
}

function scoreAt(ctx: Ctx, t: number): [number, number] {
  let lo = 0;
  let hi = ctx.scores.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (ctx.scores[mid].at <= t) { best = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return best < 0 ? [0, 0] : [ctx.scores[best].h, ctx.scores[best].a];
}

function supportOf(fan: Fan, ctx: Ctx): string | null {
  const rng = createRng(`support:${fan.id}:${ctx.meta.id}`);
  const persona = personalityOf(fan.id);
  if (rng.chance(persona === 'neutral' ? 0.6 : 0.12)) return null;
  if (ctx.isTeamGame || ctx.meta.competitorIds.length === 2) return rng.chance(0.58) ? ctx.meta.competitorIds[0] : ctx.meta.competitorIds[1];
  // Fields: back someone, usually a contender.
  const field = ctx.meta.competitorIds.map((id) => ({ id, s: competitorById(id)?.strength ?? 0.5 }))
    .sort((a, b) => b.s - a.s).slice(0, Math.max(4, Math.ceil(ctx.meta.competitorIds.length * 0.5)));
  return rng.pick(field).id;
}

const squadCache = new Map<string, string[]>();
function squadOf(id: string | null | undefined): string[] | null {
  if (!id || competitorById(id)?.kind !== 'team') return null;
  let squad = squadCache.get(id);
  if (!squad) {
    squad = squadFor(id, 14).slice(0, 8);
    squadCache.set(id, squad);
  }
  return squad;
}

/** Everyone's perspective on the game at a moment, ready for slot-filling. */
function valuesFor(ctx: Ctx, fan: Fan, supports: string | null, t: number, rng: Rng): Record<string, string | undefined> {
  const { meta } = ctx;
  const usIdx = supports ? meta.competitorIds.indexOf(supports) : -1;
  // Neutrals have no "us": lines that need one are skipped for them.
  const lens = supports ?? (ctx.teams.length === 2 ? meta.competitorIds[rng.int(0, 1)] : null);
  const us = supports ? competitorById(supports) : undefined;
  const themId = ctx.teams.length === 2 ? meta.competitorIds[meta.competitorIds.indexOf(lens ?? '') === 1 ? 0 : 1] : null;
  const them = supports ? competitorById(themId) : undefined;
  const lensC = competitorById(lens);
  const usSquad = squadOf(lens);
  const themSquad = squadOf(themId);
  const usPlayer = usSquad ? rng.pick(usSquad) : lensC?.kind === 'athlete' ? surname(lensC.name) : undefined;
  const themPlayer = themSquad ? rng.pick(themSquad) : them?.kind === 'athlete' ? surname(them.name) : undefined;
  const [h, a] = scoreAt(ctx, t);
  const usScore = usIdx === 1 ? a : h;
  const themScore = usIdx === 1 ? h : a;
  return {
    us: us?.name, usShort: us?.shortName, usShortUp: us?.shortName?.toUpperCase(), them: them?.name, themShort: them?.shortName,
    usPlayer, themPlayer, venue: meta.venue, sport: ctx.sportName.toLowerCase(), city: competitorById(meta.competitorIds[0])?.home ?? meta.venue,
    startWord: START_WORD[ctx.sportId] ?? 'Start', period: PERIOD_WORD[ctx.sportId] ?? 'half',
    mins: String(Math.max(1, Math.round((meta.startsAt - t) / MINUTE))),
    usScore: ctx.isTeamGame && usIdx >= 0 ? String(usScore) : undefined,
    themScore: ctx.isTeamGame && usIdx >= 0 ? String(themScore) : undefined,
    n: String(rng.int(1, 5)), pct: String(rng.int(54, 71)), stake: String(rng.pick([50, 100, 150, 200, 250, 500])),
    mult: (rng.int(14, 38) / 10).toFixed(1),
  };
}

function buildCtx(final: EventState): Ctx {
  const meta = final.meta;
  const engine = planFor(meta.sportId)?.engine;
  const isTeamGame = (engine === 'h2h' || engine === 'football' || engine === 'baseball') && meta.competitorIds.length === 2;
  const scores: ScoreAt[] = [];
  const breaks: Ctx['breaks'] = [];
  for (const p of final.plays) {
    if (isTeamGame) {
      const sc = readScore(p.scoreAfter);
      if (sc) scores.push({ at: p.at, h: sc[0], a: sc[1] });
    }
    if (p.tag === 'PERIOD' || p.tag === 'HALF' || p.tag === 'INNINGS' || p.tag === 'ROUND_END') {
      breaks.push({ from: p.at, to: p.at + (/half|innings/i.test(p.clock + p.description) ? 12 : 3) * MINUTE, label: p.clock });
    }
  }
  const kind: Kind = engine === 'race' ? 'motor' : engine === 'golf' ? 'golf' : engine === 'cycling' ? 'cycling' : engine === 'tennis' ? 'tennis'
    : engine === 'combat' ? 'combat' : engine === 'cricket' ? 'cricket' : 'team';
  return {
    meta, final, sportId: meta.sportId, sportName: sportById(meta.sportId)?.name ?? 'sport', isTeamGame, kind,
    teams: meta.competitorIds.length === 2 ? meta.competitorIds : [], scores, breaks, pool: fanPool(meta.sportId),
  };
}

/** A light, state-like view of the event at time t, enough for the crowd curve. */
function crowdAt(ctx: Ctx, t: number, playIdx: number): number {
  const { final, meta } = ctx;
  const status = t < meta.startsAt ? 'scheduled' : t < final.endsAt ? 'live' : 'finished';
  const progress = t <= meta.startsAt ? 0 : t >= final.endsAt ? 1 : (t - meta.startsAt) / (final.endsAt - meta.startsAt);
  const plays = final.plays.slice(Math.max(0, playIdx - 6), playIdx);
  return watchersFor({ meta, status, progress, endsAt: final.endsAt, plays }, t);
}

/** Ambient messages per minute for a crowd of this size. */
export function messagesPerMinute(chatters: number): number {
  return Math.min(18, Math.max(0.8, 0.75 * Math.sqrt(chatters)));
}

interface Builder {
  out: ChatEntry[];
  mem: Memory;
  threadId: string;
}

function push(b: Builder, fan: Fan, body: string, at: number, opts: {
  supports: string | null; playId?: string | null; boost?: number; replyTo?: ChatEntry['replyTo']; base?: string | null; tone?: Tone;
}) {
  const id = `${b.threadId}~${b.out.length}`;
  b.out.push({
    id, threadId: b.threadId, userId: fan.id, username: fan.username, displayName: fan.displayName, avatarSeed: fan.avatarSeed,
    body, at: Math.round(at), playId: opts.playId ?? null, isMine: false, reactions: reactionsFor(id, opts.boost ?? 0, opts.tone),
    kind: 'fan', supports: opts.supports, replyTo: opts.replyTo ?? null, moment: null,
  });
  b.mem.n += 1;
  b.mem.used.set(body, b.mem.n);
  // Also remember the line before personal touches, so nobody repeats it with a different emoji.
  if (opts.base) b.mem.used.set(opts.base, b.mem.n);
}

function momentFor(ctx: Ctx, play: Play): ChatMoment {
  const { meta } = ctx;
  let line: string | null = null;
  const sc = readScore(play.scoreAfter);
  if (ctx.isTeamGame && sc) line = `${competitorById(meta.competitorIds[0])?.shortName} ${sc[0]}-${sc[1]} ${competitorById(meta.competitorIds[1])?.shortName}`;
  else if (play.scoreAfter) line = play.scoreAfter;
  else if (play.competitorId && meta.competitorIds.length > 2) line = competitorById(play.competitorId)?.name ?? null;
  return {
    tag: play.tag ?? '', label: momentLabel(play), icon: (play.tag && MOMENT_ICON[play.tag]) ?? sportIconEmoji(meta.sportId),
    line, clock: play.clock, competitorId: play.competitorId, importance: play.importance, description: play.description,
  };
}

/** Which pool fits a fan's reaction to a play. */
function reactionPool(ctx: Ctx, play: Play, supports: string | null, prev: [number, number], next: [number, number] | null, late: boolean): string[] {
  const tag = play.tag ?? '';
  const isFor = supports !== null && play.competitorId === supports;
  const isAgainst = supports !== null && play.competitorId !== null && play.competitorId !== supports;
  if (ctx.isTeamGame && next && (next[0] !== prev[0] || next[1] !== prev[1])) {
    const sideScored = next[0] > prev[0] ? 0 : 1;
    const wasBehind = sideScored === 0 ? prev[0] < prev[1] : prev[1] < prev[0];
    const nowLevel = next[0] === next[1];
    const nowAhead = sideScored === 0 ? next[0] > next[1] : next[1] > next[0];
    if (isFor) {
      if (late && nowAhead) return LATE_FOR;
      if (wasBehind && nowLevel) return LEVEL_FOR;
      if (wasBehind && nowAhead) return LEAD_FOR;
      return SCORE_FOR;
    }
    if (isAgainst) {
      if (late && nowAhead) return LATE_AGAINST;
      if (nowLevel) return LEVEL_AGAINST;
      if (wasBehind && nowAhead) return LEAD_AGAINST;
      return SCORE_AGAINST;
    }
    return SCORE_NEUTRAL;
  }
  if (tag === 'RED' || tag === 'SINBIN' || tag === 'YELLOW') return isFor ? CARD_FOR : isAgainst ? CARD_AGAINST : SCORE_NEUTRAL;
  if (tag === 'CHANCE' || tag === 'POST' || tag === 'SAVE') return isFor ? MISS_FOR : isAgainst ? MISS_AGAINST : ['Close!', 'Nearly!', 'Ooof'];
  if (isFor && TAG_FOR[tag]) return TAG_FOR[tag];
  if (isAgainst && TAG_AGAINST[tag]) return TAG_AGAINST[tag];
  if (TAG_NEUTRAL[tag]) return TAG_NEUTRAL[tag];
  return isFor ? ['Yes!!', 'Huge', 'Get in!'] : isAgainst ? ['Ugh', 'Come on…', 'Not ideal'] : ['Wow', 'Big moment', 'Did not see that coming'];
}

function eventScript(final: EventState): ChatEntry[] {
  const ctx = buildCtx(final);
  const { meta } = ctx;
  const threadId = `event:${meta.id}`;
  const b: Builder = { out: [], mem: { used: new Map(), n: 0 }, threadId };
  if (meta.disruption) return [];
  const rng = createRng(`chat2:${meta.id}`);
  const supportCache = new Map<string, string | null>();
  const support = (fan: Fan) => {
    if (!supportCache.has(fan.id)) supportCache.set(fan.id, supportOf(fan, ctx));
    return supportCache.get(fan.id) ?? null;
  };
  const plays = final.plays;

  // 1. Moments and the bursts of reaction after each one.
  let prevScore: [number, number] = [0, 0];
  plays.forEach((p) => {
    const sc = ctx.isTeamGame ? readScore(p.scoreAfter) : null;
    const isCard = p.importance === 3 || p.tag === 'START' || p.tag === 'FINAL' || p.tag === 'PERIOD';
    if (isCard) {
      b.out.push({
        id: `${threadId}~m${p.seq}`, threadId, userId: 'stands', username: 'stands', displayName: 'Stands', avatarSeed: 'stands',
        body: p.description, at: p.at + 1500, playId: p.id, isMine: false, reactions: {}, kind: 'moment', supports: null, replyTo: null,
        moment: momentFor(ctx, p),
      });
    }
    const idx = p.seq; // plays up to and including this one
    const chatters = chattersFor(crowdAt(ctx, p.at, idx));
    const scale = Math.min(2.2, Math.max(0.5, Math.sqrt(chatters / 250)));
    const isScore = !!sc && (sc[0] !== prevScore[0] || sc[1] !== prevScore[1]);
    let count = 0;
    if (p.tag === 'START' || p.tag === 'FINAL' || p.tag === 'PERIOD') count = 0; // phase chatter covers these
    else if (p.importance === 3) count = Math.round(rng.int(5, 10) * scale);
    else if (p.importance === 2) count = Math.round(rng.int(isScore ? 1 : 0, isScore ? 4 : 2) * scale);
    const late = p.at > meta.startsAt + (final.endsAt - meta.startsAt) * 0.85;
    const player = playerFrom(p);
    const team = competitorById(p.competitorId)?.kind === 'athlete' ? competitorById(competitorById(p.competitorId)?.parentId)?.name
      ?? competitorById(p.competitorId)?.name : competitorById(p.competitorId)?.name;
    const words = (p.tag && SCORE_WORDS[p.tag]) ?? ['moment', 'WOW'];
    const spoke = new Set<string>();
    for (let k = 0; k < count; k++) {
      let fan = rng.pick(ctx.pool);
      if (spoke.has(fan.id)) fan = rng.pick(ctx.pool);
      spoke.add(fan.id);
      const sup = support(fan);
      // Most fans react within seconds; a few chime in a minute later.
      const delay = 2500 + Math.min(80_000, -Math.log(1 - rng.next() * 0.999) * (p.importance === 3 ? 11_000 : 16_000));
      const at = p.at + delay;
      const vals = {
        ...valuesFor(ctx, fan, sup, at, rng), player: player ? (rng.chance(0.6) ? surname(player) : player) : undefined,
        team, word: words[0], WORD: words[1], card: p.tag === 'RED' ? 'red' : p.tag === 'SINBIN' ? 'sin bin' : 'card',
        opp: undefined,
      };
      const pool = reactionPool(ctx, p, sup, prevScore, sc, late);
      const line = pickLine(rng, pool, vals, b.mem);
      if (line) push(b, fan, voice(rng, line, personalityOf(fan.id), TONE.get(pool)), at, { supports: sup, playId: p.id, boost: p.importance === 3 ? 0.35 : 0.12, base: line, tone: TONE.get(pool) });
    }
    if (sc) prevScore = sc;
    if (p.tag === 'PERIOD' && /regulation/i.test(p.clock)) {
      for (let k = 0; k < Math.round(4 * scale); k++) {
        const fan = rng.pick(ctx.pool);
        const line = pickLine(rng, OT, valuesFor(ctx, fan, support(fan), p.at, rng), b.mem);
        if (line) push(b, fan, voice(rng, line, personalityOf(fan.id), 'up'), p.at + rng.int(3, 40) * 1000, { supports: support(fan), boost: 0.3, tone: 'up' });
      }
    }
  });

  // 2. Ambient chatter, as busy as the crowd, from 90 minutes before to 45 after.
  const from = meta.startsAt - 90 * MINUTE;
  const to = final.endsAt + 45 * MINUTE;
  let playIdx = 0;
  let t = from + rng.int(0, 60) * 1000;
  const winner = final.entries.find((e) => e.isWinner)?.competitorId ?? null;
  const lately: ChatEntry[] = [];
  const crowdCache = new Map<string, number>();
  while (t < to) {
    while (playIdx < plays.length && plays[playIdx].at <= t) playIdx++;
    // The crowd moves slowly: one reading per 20 seconds is plenty.
    const bucket = `${Math.floor(t / 20_000)}:${playIdx}`;
    let crowd = crowdCache.get(bucket);
    if (crowd === undefined) {
      crowd = crowdAt(ctx, t, playIdx);
      crowdCache.set(bucket, crowd);
    }
    const chatters = chattersFor(crowd);
    const rpm = messagesPerMinute(chatters);
    // Nobody hogs the chat: skip anyone among the last few people to post.
    let fan = rng.pick(ctx.pool);
    for (let tries = 0; tries < 4 && lately.slice(-4).some((m) => m.userId === fan.id); tries++) fan = rng.pick(ctx.pool);
    const sup = support(fan);
    const persona = personalityOf(fan.id);
    const vals = valuesFor(ctx, fan, sup, t, rng);
    let pool: string[];
    const inBreak = ctx.breaks.find((x) => t >= x.from && t < x.to);
    if (t < meta.startsAt) {
      pool = rng.chance(0.08) ? CALLS : ctx.kind === 'team' && rng.chance(0.18) ? PRE_TEAM : rng.chance(0.35) ? PRE.neutral : PRE[persona];
    } else if (t < meta.startsAt + 70_000) {
      pool = START;
    } else if (t < final.endsAt) {
      const progress = (t - meta.startsAt) / (final.endsAt - meta.startsAt);
      if (inBreak && rng.chance(0.7)) {
        pool = BREAK;
        vals.breakLabel = inBreak.label;
      } else if (rng.chance(0.06)) {
        pool = CALLS;
      } else if (ctx.kind !== 'team') {
        pool = rng.chance(0.75) ? KIND_ANY[ctx.kind] : FIELD_PERSONA[persona];
      } else if (rng.chance(0.22) && SPORT_TALK[ctx.sportId]) {
        pool = SPORT_TALK[ctx.sportId];
      } else if (rng.chance(0.24)) {
        pool = PLAYER_TALK;
      } else if (rng.chance(0.25)) {
        pool = LIVE_PERSONA[persona];
      } else if (ctx.isTeamGame && sup) {
        const [h, a] = scoreAt(ctx, t);
        const diff = sup === meta.competitorIds[0] ? h - a : a - h;
        const big = Math.abs(diff) >= (ctx.sportId === 'soccer' || ctx.sportId === 'ice_hockey' ? 3 : ctx.sportId === 'baseball' ? 5 : 18);
        if (progress > 0.82 && Math.abs(diff) <= (ctx.sportId === 'soccer' || ctx.sportId === 'ice_hockey' ? 1 : 7)) pool = LIVE.late;
        else if (diff === 0) pool = LIVE.level;
        else if (diff > 0) pool = big ? LIVE.cruising : LIVE.ahead;
        else pool = big ? LIVE.chasing : LIVE.behind;
        if (rng.chance(0.2)) pool = LIVE.any;
      } else {
        pool = LIVE.any;
      }
    } else {
      const minsAfter = (t - final.endsAt) / MINUTE;
      if (minsAfter < 6 && rng.chance(0.75)) {
        const isField = ctx.meta.competitorIds.length > 2;
        pool = !sup ? FINAL_NEUTRAL : winner === sup ? FINAL_WIN : isField ? FINAL_FIELD : winner === null ? FINAL_DRAW : FINAL_LOSS;
        const pos = final.entries.find((e) => e.competitorId === sup)?.position;
        vals.pos = pos ? String(pos) : undefined;
      } else {
        pool = POST;
        const scorer = plays.filter((p) => p.importance >= 2 && p.competitorId === (winner ?? sup)).map(playerFrom).find(Boolean);
        vals.player = scorer ? surname(scorer) : vals.usPlayer;
        vals.word = 'performance';
      }
    }

    // Some messages are replies to someone a few lines up.
    const prior = lately.filter((m) => m.userId !== fan.id);
    const before = b.out.length;
    if (prior.length > 0 && rng.chance(0.13)) {
      const target = rng.pick(prior);
      const line = pickLine(rng, REPLIES, { user: target.username }, b.mem);
      if (line) push(b, fan, line, t, { supports: sup, replyTo: { username: target.username, body: target.body.slice(0, 70) } });
    } else {
      let line = pickLine(rng, pool, vals, b.mem);
      // Worn-out pool: talk about a player instead (names keep it fresh) before repeating anyone.
      if (line && isStale(b.mem, line) && t >= meta.startsAt && t < final.endsAt) {
        pool = ctx.kind === 'team' ? PLAYER_TALK : KIND_ANY[ctx.kind];
        line = pickLine(rng, pool, vals, b.mem) ?? line;
      }
      if (line) push(b, fan, voice(rng, line, persona, TONE.get(pool)), t, { supports: sup, boost: 0.04, base: line, tone: TONE.get(pool) });
    }
    if (b.out.length > before) {
      lately.push(b.out[b.out.length - 1]);
      if (lately.length > 8) lately.shift();
    }
    // Exponential gaps: a natural, bursty rhythm around the average rate. Build-up is calmer.
    const meanGap = 60_000 / (t < meta.startsAt ? rpm * 0.5 : rpm);
    t += Math.max(700, -Math.log(1 - rng.next() * 0.999) * meanGap);
  }

  return b.out.sort((x, y) => x.at - y.at);
}

/** Index of the last message at or before `now` (binary search), or -1. */
function lastVisible(all: { at: number }[], now: number): number {
  let lo = 0;
  let hi = all.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (all[mid].at <= now) { best = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return best;
}

function scriptFor(final: EventState): ChatEntry[] {
  return cachedScript(`chat2:${final.meta.id}`, () => eventScript(final));
}

/**
 * Simulated messages in an event chat up to `now`, newest first.
 * `finalState` must be the event's finished state so the script is stable.
 */
export function eventBotMessages(finalState: EventState, now: number, limit = 150): ChatEntry[] {
  const all = scriptFor(finalState);
  const out: ChatEntry[] = [];
  for (let k = lastVisible(all, now); k >= 0 && out.length < limit; k--) out.push(all[k]);
  return out;
}

export interface Typist { userId: string; username: string }

/** Fans who are about to post: their messages land in the next few seconds. */
export function eventTyping(finalState: EventState, now: number, horizonMs = 5000): Typist[] {
  const all = scriptFor(finalState);
  const out: Typist[] = [];
  for (let k = lastVisible(all, now) + 1; k < all.length && all[k].at <= now + horizonMs; k++) {
    const m = all[k];
    if (m.kind === 'fan' && !out.some((x) => x.userId === m.userId)) out.push({ userId: m.userId, username: m.username });
  }
  return out;
}

export interface ChatSnapshot {
  messages: ChatEntry[];
  typing: Typist[];
  live: boolean;
  phase: 'pre' | 'live' | 'post' | 'section';
  watchers: number | null;
  chatters: number;
  members: number | null;
  /** The latest big moment if it happened in the last few seconds (drives the crowd's floating emoji). */
  hype: { at: number; competitorId: string | null; icon: string } | null;
  sportId: string | null;
}

export function eventChatSnapshot(meta: EventMeta, now: number): ChatSnapshot {
  const final = finalState(meta);
  const state = simulate(meta, now);
  const watchers = watchersFor(state, now);
  let hype: ChatSnapshot['hype'] = null;
  for (let i = state.plays.length - 1; i >= 0 && i >= state.plays.length - 4; i--) {
    const p = state.plays[i];
    if (p.importance === 3 && now - p.at < 25_000 && p.tag !== 'START') {
      hype = { at: p.at, competitorId: p.competitorId, icon: (p.tag && MOMENT_ICON[p.tag]) ?? sportIconEmoji(meta.sportId) };
      break;
    }
  }
  return {
    messages: eventBotMessages(final, now),
    typing: state.status === 'cancelled' || state.status === 'postponed' ? [] : eventTyping(final, now),
    live: state.status === 'live',
    phase: state.status === 'live' ? 'live' : state.status === 'scheduled' ? 'pre' : 'post',
    watchers,
    chatters: chattersFor(watchers),
    members: null,
    hype,
    sportId: meta.sportId,
  };
}

// ---------------------------------------------------------------------------
// Replies and reactions to your own messages
// ---------------------------------------------------------------------------

/**
 * The stands answer back: a few reactions build on your message and now and
 * then someone replies. Deterministic from the message id.
 */
export function echoesFor(message: { id: string; body: string; at: number; threadId: string }, username: string, now: number, sportId: string | null): {
  replies: ChatEntry[]; reactions: Record<string, number>;
} {
  // Every random choice is made up front, so the answer never changes as time passes.
  const rng = createRng(`echo:${message.id}`);
  const reactions: Record<string, number> = {};
  const emoji = rng.pick(REACTION_EMOJI);
  const peak = rng.int(1, 9);
  let at = message.at + 3000;
  for (let i = 0; i < peak; i++) {
    const key = i % 4 === 3 ? rng.pick(REACTION_EMOJI) : emoji;
    at += rng.int(1500, 6000);
    if (at <= now) reactions[key] = (reactions[key] ?? 0) + 1;
  }
  const replies: ChatEntry[] = [];
  const count = rng.chance(0.55) ? rng.int(1, 2) : 0;
  const pool = sportId ? fanPool(sportId) : FANS;
  for (let k = 0; k < count; k++) {
    const fan = rng.pick(pool);
    const replyAt = message.at + rng.int(5, 30) * 1000 + k * 9000;
    const body = fillLine(rng.pick(REPLIES_TO_ME), { user: username }) ?? `@${username} 👍`;
    if (replyAt > now) continue;
    const id = `${message.id}~echo${k}`;
    replies.push({
      id, threadId: message.threadId, userId: fan.id, username: fan.username, displayName: fan.displayName, avatarSeed: fan.avatarSeed,
      body, at: replyAt, playId: null, isMine: false, reactions: reactionsFor(id, 0.05), kind: 'fan', supports: null,
      replyTo: { username, body: message.body.slice(0, 70) }, moment: null,
    });
  }
  return { replies, reactions };
}

// ---------------------------------------------------------------------------
// Section threads
// ---------------------------------------------------------------------------

const SLOT_MS = 10 * MINUTE;
const slotCache = new Map<string, ChatEntry[]>();

/** How lively a Section is at this hour of the day (UTC). */
function activityAt(ms: number): number {
  const hour = new Date(ms).getUTCHours() + new Date(ms).getUTCMinutes() / 60;
  // Members are spread across time zones: it dips around 07-11 UTC and peaks
  // through the European and American evenings (17-05 UTC).
  const evening = hour >= 17 || hour < 5 ? 0.45 : 0;
  return 0.55 + 0.35 * Math.pow(Math.sin(((hour - 9) / 24) * Math.PI), 2) + evening;
}

function sectionSlot(threadId: string, sportId: string, memberFans: Fan[], slot: number): ChatEntry[] {
  const key = `${threadId}:${slot}`;
  const hit = slotCache.get(key);
  if (hit) return hit;
  const rng = createRng(key);
  const start = slot * SLOT_MS;
  const lines = [...SECTION_LINES.default, ...(SECTION_LINES[sportId] ?? [])];
  const expected = 1.1 * activityAt(start) * Math.max(0.6, memberFans.length / 28);
  const count = memberFans.length === 0 ? 0 : rng.poisson(expected);
  const out: ChatEntry[] = [];
  const sportEvents = count > 0 ? eventsBetween(start - 6 * HOUR, start + SLOT_MS).filter((m) => m.sportId === sportId && !m.disruption) : [];
  // Times first, in order, so a reply always answers something said before it.
  const times = Array.from({ length: count }, () => start + rng.int(0, SLOT_MS / 1000 - 1) * 1000).sort((x, y) => x - y);
  for (let k = 0; k < count; k++) {
    const at = times[k];
    const fan = rng.pick(memberFans);
    const persona = personalityOf(fan.id);
    const roll = rng.next();
    let body: string | null = null;
    let replyTo: ChatEntry['replyTo'] = null;
    if (roll < 0.28 && sportEvents.length > 0) {
      // React to a real result that finished in the last couple of hours.
      const done = sportEvents.map((m) => finalState(m)).filter((s) => s.endsAt <= at && s.endsAt > at - 3 * HOUR && s.meta.competitorIds.length === 2);
      if (done.length > 0) {
        const s = rng.pick(done);
        const win = s.entries.find((e) => e.isWinner);
        const lose = s.entries.find((e) => e.isWinner === false);
        if (win && lose) {
          const score = win.score !== null && lose.score !== null ? `${win.score}-${lose.score}` : (win.scoreText ?? '');
          body = fillLine(rng.pick(SECTION_RESULT), {
            winner: competitorById(win.competitorId)?.name, loser: competitorById(lose.competitorId)?.name, score: score || 'what a game',
          });
        }
      }
    } else if (roll < 0.42 && sportEvents.length > 0) {
      // Talk about a game that is live right then.
      const live = sportEvents.filter((m) => m.startsAt <= at).map((m) => simulate(m, at)).filter((s) => s.status === 'live');
      if (live.length > 0) {
        const s = rng.pick(live);
        const h = s.entries[0];
        const a = s.entries[1];
        const line = h && a && h.score !== null && a.score !== null
          ? `${competitorById(h.competitorId)?.shortName} ${h.score}-${a.score} ${competitorById(a.competitorId)?.shortName}${s.periodLabel ? ` (${s.periodLabel})` : ''}`
          : s.periodLabel ?? 'it';
        body = fillLine(rng.pick(SECTION_LIVE), { title: s.meta.title, line });
      }
    } else if (roll < 0.52 && out.length > 0) {
      const target = rng.pick(out);
      if (target.userId !== fan.id && target.at < at) {
        body = fillLine(rng.pick(REPLIES), { user: target.username });
        replyTo = { username: target.username, body: target.body.slice(0, 70) };
      }
    }
    if (!body) body = voice(rng, (fillLine(rng.pick(lines), { n: String(rng.int(3, 40)) }) ?? 'Hey all'), persona, 'flat');
    const id = `${threadId}~${slot}.${k}`;
    out.push({
      id, threadId, userId: fan.id, username: fan.username, displayName: fan.displayName, avatarSeed: fan.avatarSeed, body, at,
      playId: null, isMine: false, reactions: reactionsFor(id, 0.12), kind: 'fan', supports: null, replyTo, moment: null,
    });
  }
  out.sort((x, y) => y.at - x.at);
  slotCache.set(key, out);
  if (slotCache.size > 3000) slotCache.delete(slotCache.keys().next().value as string);
  return out;
}

/** Simulated chatter in a public Section, newest first. */
export function sectionBotMessages(sectionId: string, sportId: string, memberFans: Fan[], now: number, limit = 100): ChatEntry[] {
  const threadId = `section:${sectionId}`;
  const out: ChatEntry[] = [];
  const firstSlot = Math.floor((now - 72 * HOUR) / SLOT_MS);
  for (let slot = Math.floor(now / SLOT_MS); slot >= firstSlot && out.length < limit; slot--) {
    for (const m of sectionSlot(threadId, sportId, memberFans, slot)) if (m.at <= now && out.length < limit) out.push(m);
  }
  return out;
}

export function sectionChatSnapshot(sectionId: string, sportId: string, memberFans: Fan[], members: number, now: number): ChatSnapshot {
  const rng = createRng(`online:${sectionId}:${Math.floor(now / (2 * MINUTE))}`);
  const online = Math.max(1, Math.min(members, Math.round(members * (0.12 + 0.28 * activityAt(now) / 1.35) + rng.int(-1, 2))));
  const msgs = sectionBotMessages(sectionId, sportId, memberFans, now);
  const nextSlot = sectionSlot(`section:${sectionId}`, sportId, memberFans, Math.floor(now / SLOT_MS));
  const typing = nextSlot.filter((m) => m.at > now && m.at <= now + 8000).map((m) => ({ userId: m.userId, username: m.username }));
  return { messages: msgs, typing, live: false, phase: 'section', watchers: null, chatters: online, members, hype: null, sportId };
}
