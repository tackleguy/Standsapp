// Demo chatter: simulated fans react to plays and talk between the action.
import { sportById } from '@/config/sports';
import { HOUR, MINUTE } from '@/lib/format';
import { createRng, hashText } from '@/lib/random';

import type { ChatMessage, EventState, Fan } from '../types';
import { cachedScript } from './engines/common';
import { fansForSport } from './fans';
import { competitorById } from './world';

const BIG_TAGS = new Set(['GOAL', 'TRY', 'TD', 'SIX', 'WICKET', 'LEAD', 'HR', 'WALKOFF', 'KNOCKDOWN', 'FINAL', 'DNF', 'SC',
  'EAGLE', 'ACE', 'CATCH', 'RED', 'DROP', 'FG', 'SAF', 'INT', 'FUMBLE', 'HUNDRED', 'SET', 'BREAK', 'SUPER', 'SHOOTOUT', 'INNINGS']);

const HYPE_FOR = [
  'LETS GOOOO {team} 🔥', 'Called it. Absolutely called it.', 'What a moment!!', '{team} are cooking tonight',
  'I am out of my seat 😤', 'That is why I watch this sport', 'Clutch. Pure clutch.', 'Get in there!!', 'Unreal from {team}',
  'Momentum is ALL {team} now', 'Somebody check on the other fans 😂', 'Chills. Actual chills.',
];
const HYPE_AGAINST = [
  'Nooo not like this', 'Defending like it is a Sunday stroll', 'That one hurts', 'We are falling apart',
  'How?? HOW??', 'Somebody wake {team} up', 'My Clout is in danger 😬', 'Still time. Still time…', 'I can’t watch',
  'Officials need to take a look at that', 'Painful.',
];
const NEUTRAL_REACT = ['Wow.', 'Game changer', 'Did not see that coming', 'Big moment', 'Rate that a 9 at least', '👀👀', 'This is wild'];
const LIVE_CHATTER = [
  'Who else is watching from work? 👀', 'This atmosphere is unreal', '{team} need to tighten up', 'Momentum swinging back and forth',
  'Anyone made a Call on this one?', 'Clout on {team}. Don’t let me down.', 'Best game of the day so far', '{team} look sharper today',
  'Rate that last play a 10 please', 'The pace of this is ridiculous', 'Second screen gang 📱', 'I need a replay of that',
  'Tactical masterclass from {team} so far', 'Whoever is in charge of {team}’s plan deserves a raise', 'Hydrate, people. Long way to go.',
  'Cannot believe the {sport} we are getting today', 'Who’s your pick for best player so far?', '{team} fans, how we feeling?',
];
const PRE_CHATTER = [
  'Predictions?', '{team} by a mile', 'Can’t wait for this one', 'Upset alert 🚨', 'Line-ups look strong', 'Made my Call already. All in on {team}.',
  'Who are we backing?', 'First time watching {sport} live on here, hi all 👋', 'Weather looks perfect for it', 'This should be close',
];
const POST_CHATTER = ['GG everyone', 'What a finish', 'Deserved it', 'Robbed.', 'See you all next time 👋', 'My Calls went well for once 😅', 'Need a lie down after that'];

const REACTION_EMOJI = ['🔥', '😂', '😮', '👏', '😤'];

function fanSupports(fan: Fan, eventId: string): 0 | 1 {
  return (hashText(`${fan.id}:${eventId}`) % 2) as 0 | 1;
}

function reactionsFor(seed: string, boost: number): Record<string, number> {
  const rng = createRng(seed);
  const out: Record<string, number> = {};
  if (!rng.chance(0.45 + boost)) return out;
  const n = rng.int(1, 2);
  for (let i = 0; i < n; i++) out[rng.pick(REACTION_EMOJI)] = rng.int(1, 4 + Math.round(boost * 30));
  return out;
}

function message(threadId: string, i: number, fan: Fan, body: string, at: number, playId: string | null, boost = 0): ChatMessage {
  const id = `${threadId}~${i}`;
  return { id, threadId, userId: fan.id, username: fan.username, displayName: fan.displayName, avatarSeed: fan.avatarSeed,
    body, at, playId, isMine: false, reactions: reactionsFor(id, boost) };
}

/** Every simulated message in an event's chat, for the whole event. */
function eventScript(state: EventState): ChatMessage[] {
  const meta = state.meta;
  const threadId = `event:${meta.id}`;
  const rng = createRng(threadId);
  const fans = fansForSport(meta.sportId);
  const sportName = sportById(meta.sportId)?.name ?? 'sport';
  const side = (i: 0 | 1) => competitorById(meta.competitorIds[i] ?? meta.competitorIds[0])?.name ?? 'them';
  const fill = (t: string, team: string) => t.replace('{team}', team).replace('{sport}', sportName);
  const out: ChatMessage[] = [];
  let i = 0;

  if (meta.disruption) return out;
  // Before the start.
  for (let t = meta.startsAt - 90 * MINUTE + rng.int(0, 5) * MINUTE; t < meta.startsAt; t += rng.int(3, 9) * MINUTE) {
    const fan = rng.pick(fans);
    out.push(message(threadId, i++, fan, fill(rng.pick(PRE_CHATTER), side(fanSupports(fan, meta.id))), t, null));
  }
  // Reactions to every big moment, across the full script.
  const fullPlays = state.plays; // state here is the final state, so this is every play
  for (const p of fullPlays) {
    if (p.importance < 2 && !BIG_TAGS.has(p.tag ?? '')) continue;
    const count = p.importance === 3 ? rng.int(2, 4) : rng.int(0, 2);
    for (let k = 0; k < count; k++) {
      const fan = rng.pick(fans);
      const supports = meta.competitorIds[fanSupports(fan, meta.id)];
      const isFor = p.competitorId !== null && p.competitorId === supports;
      const isAgainst = p.competitorId !== null && !isFor;
      const pool = meta.format === 'race' ? (isFor ? HYPE_FOR : NEUTRAL_REACT) : isFor ? HYPE_FOR : isAgainst ? HYPE_AGAINST : NEUTRAL_REACT;
      const team = competitorById(isFor ? supports : supports)?.name ?? 'us';
      out.push(message(threadId, i++, fan, fill(rng.pick(pool), team), p.at + rng.int(4, 70) * 1000, p.id, p.importance === 3 ? 0.35 : 0.1));
    }
  }
  // Chatter while it is live.
  for (let t = meta.startsAt + rng.int(30, 120) * 1000; t < state.endsAt; t += rng.int(55, 150) * 1000) {
    const fan = rng.pick(fans);
    out.push(message(threadId, i++, fan, fill(rng.pick(LIVE_CHATTER), side(fanSupports(fan, meta.id))), t, null));
  }
  // After the finish.
  for (let t = state.endsAt + rng.int(1, 3) * MINUTE; t < state.endsAt + 40 * MINUTE; t += rng.int(4, 12) * MINUTE) {
    const fan = rng.pick(fans);
    out.push(message(threadId, i++, fan, rng.pick(POST_CHATTER), t, null));
  }
  return out.sort((a, b) => a.at - b.at);
}

/**
 * Simulated messages in an event chat up to `now`, newest first.
 * `finalState` must be the event's finished state so the script is stable.
 */
export function eventBotMessages(finalState: EventState, now: number, limit = 150): ChatMessage[] {
  const all = cachedScript(`chat:${finalState.meta.id}`, () => eventScript(finalState));
  const visible: ChatMessage[] = [];
  for (let k = all.length - 1; k >= 0 && visible.length < limit; k--) {
    if (all[k].at <= now) visible.push(all[k]);
  }
  return visible;
}

const SECTION_LINES: Record<string, string[]> = {
  default: [
    'Anyone watching tonight?', 'My Calls this week have been a disaster 😂', 'Gate Check streak at {n} days 💪',
    'Who is top of the board right now?', 'Just pulled an epic card!!', 'That last game was a classic',
    'We need more people in here, share the code', 'Big weekend coming up', 'Hot take: the underdogs are due',
    'Good morning, Section', 'Rate the last match out of 10?', 'I owe this Section an apology for that Call',
  ],
  f1: ['Pole lap was insane', 'Tyre strategy is everything this weekend', 'Safety car Call paid out for me 💰', 'Who is winning the sprint?'],
  cricket: ['That run chase was unreal', 'Need a big total batting first', 'Spinners will decide this one', 'Sixes Call is free Clout'],
  rugby_union: ['Scrum was dominant today', 'That try in the corner 😍', 'Bench made the difference', 'Kicking game needs work'],
  soccer: ['What a strike that was', 'Clean sheet incoming', 'Midfield battle is everything', 'VAR strikes again'],
  basketball: ['Fourth quarter was madness', 'Splash brothers energy from that backcourt', 'Defense wins championships', 'Over Call hit easily'],
};

/** Simulated chatter in a demo Section, newest first. */
export function sectionBotMessages(sectionId: string, sportId: string, memberFans: Fan[], now: number, limit = 80): ChatMessage[] {
  const threadId = `section:${sectionId}`;
  const lines = [...SECTION_LINES.default, ...(SECTION_LINES[sportId] ?? [])];
  const out: ChatMessage[] = [];
  const firstHour = Math.floor((now - 72 * HOUR) / HOUR);
  const lastHour = Math.floor(now / HOUR);
  for (let h = lastHour; h >= firstHour && out.length < limit; h--) {
    const rng = createRng(`${threadId}:${h}`);
    const count = rng.chance(0.55) ? rng.int(1, 3) : 0;
    const msgs: ChatMessage[] = [];
    for (let k = 0; k < count; k++) {
      const at = h * HOUR + rng.int(0, 59) * MINUTE + rng.int(0, 59) * 1000;
      if (at > now || memberFans.length === 0) continue;
      const fan = rng.pick(memberFans);
      const body = rng.pick(lines).replace('{n}', String(rng.int(3, 40)));
      msgs.push(message(threadId, h * 10 + k, fan, body, at, null, 0.1));
    }
    out.push(...msgs.sort((a, b) => b.at - a.at));
  }
  return out;
}
