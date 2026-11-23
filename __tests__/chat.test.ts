import {
  echoesFor, eventBotMessages, eventChatSnapshot, eventTyping, messagesPerMinute, personalityOf, sectionBotMessages,
  sectionChatSnapshot, type ChatEntry,
} from '@/data/demo/chat';
import { finalState } from '@/data/demo/engines';
import { eventsForUtcDay } from '@/data/demo/schedule';
import { DEMO_SECTIONS, sectionFans } from '@/data/demo/sections';
import type { EventMeta, Play } from '@/data/types';

const DAY = Date.parse('2026-11-22T00:00:00Z');
const MIN = 60_000;
const metas = eventsForUtcDay(DAY);

/** A soccer match with a goal in the second half, so the burst is not mixed up with kick-off. */
function soccerWithLateGoal(): { meta: EventMeta; goal: Play } {
  for (const meta of metas.filter((m) => m.sportId === 'soccer' && !m.disruption)) {
    const f = finalState(meta);
    const goal = f.plays.find((p) => p.tag === 'GOAL' && p.at > meta.startsAt + 70 * MIN && p.at < f.endsAt - 10 * MIN);
    if (goal) return { meta, goal };
  }
  throw new Error('no soccer match with a late goal');
}

const everything = (meta: EventMeta) => eventBotMessages(finalState(meta), Number.MAX_SAFE_INTEGER, 1_000_000);
const fansIn = (list: ChatEntry[], from: number, to: number) => list.filter((m) => m.kind === 'fan' && m.at >= from && m.at < to).length;

describe('event chat', () => {
  it('is the same on every phone (deterministic)', () => {
    const { meta } = soccerWithLateGoal();
    const t = meta.startsAt + 60 * MIN;
    // Load the chat twice from scratch (fresh caches), as two different phones would.
    const freshRun = () => {
      let out: string[] = [];
      jest.isolateModules(() => {
        const chat = jest.requireActual<typeof import('@/data/demo/chat')>('@/data/demo/chat');
        const engines = jest.requireActual<typeof import('@/data/demo/engines')>('@/data/demo/engines');
        out = chat.eventBotMessages(engines.finalState(meta), t, 400).map((m) => `${m.id}|${m.at}|${m.body}`);
      });
      return out;
    };
    const a = freshRun();
    const b = freshRun();
    expect(a.length).toBeGreaterThan(100);
    expect(a).toEqual(b);
  });

  it('never shows a message from the future, newest first', () => {
    const { meta } = soccerWithLateGoal();
    const t = meta.startsAt + 47 * MIN;
    const list = eventBotMessages(finalState(meta), t);
    expect(list.length).toBe(150);
    for (const m of list) expect(m.at).toBeLessThanOrEqual(t);
    for (let i = 1; i < list.length; i++) expect(list[i - 1].at).toBeGreaterThanOrEqual(list[i].at);
    // People "typing" are exactly the ones about to post.
    const typing = eventTyping(finalState(meta), t, 5000);
    const upcoming = everything(meta).filter((m) => m.kind === 'fan' && m.at > t && m.at <= t + 5000).map((m) => m.userId);
    expect(typing.map((x) => x.userId).sort()).toEqual([...new Set(upcoming)].sort());
  });

  it('gets busier as the crowd grows', () => {
    expect(messagesPerMinute(2000)).toBeGreaterThan(messagesPerMinute(200));
    expect(messagesPerMinute(200)).toBeGreaterThan(messagesPerMinute(10));
    const { meta } = soccerWithLateGoal();
    const all = everything(meta);
    const earlyBuildUp = fansIn(all, meta.startsAt - 85 * MIN, meta.startsAt - 75 * MIN);
    const lateGame = fansIn(all, meta.startsAt + 75 * MIN, meta.startsAt + 85 * MIN);
    expect(lateGame).toBeGreaterThan(earlyBuildUp * 2);
    expect(lateGame).toBeGreaterThan(40); // a live match thread, not one line a minute
  });

  it('erupts after a goal and names the scorer', () => {
    const { meta, goal } = soccerWithLateGoal();
    const all = everything(meta);
    const before = fansIn(all, goal.at - 60_000, goal.at);
    const after = fansIn(all, goal.at, goal.at + 60_000);
    expect(after).toBeGreaterThan(before);
    const reactions = all.filter((m) => m.playId === goal.id && m.kind === 'fan');
    expect(reactions.length).toBeGreaterThanOrEqual(4);
    const scorer = /([A-Z]\. )([A-Z][A-Za-z'’-]+)/.exec(goal.description)?.[2];
    expect(scorer).toBeTruthy();
    expect(reactions.some((m) => m.body.toLowerCase().includes(String(scorer).toLowerCase()))).toBe(true);
    // The goal drops into the stream as a card with the score.
    const card = all.find((m) => m.kind === 'moment' && m.playId === goal.id);
    expect(card?.moment?.label).toBe('GOAL');
    expect(card?.moment?.line).toMatch(/^[A-Z0-9]+ \d+-\d+ [A-Z0-9]+$/);
  });

  it('gives fans one side and one personality', () => {
    const { meta } = soccerWithLateGoal();
    const all = everything(meta).filter((m) => m.kind === 'fan');
    const sides = new Map<string, Set<string | null>>();
    for (const m of all) sides.set(m.userId, (sides.get(m.userId) ?? new Set()).add(m.supports));
    for (const s of sides.values()) expect(s.size).toBe(1);
    expect(personalityOf('fan_3')).toBe(personalityOf('fan_3'));
    for (const m of all) if (m.supports) expect(meta.competitorIds).toContain(m.supports);
    // Nobody posts three ambient messages in a row.
    const ambient = all.filter((m) => !m.playId);
    for (let i = 2; i < ambient.length; i++) {
      expect(ambient[i].userId === ambient[i - 1].userId && ambient[i].userId === ambient[i - 2].userId).toBe(false);
    }
    // Plenty of variety: most lines in a busy stretch are different.
    const stretch = all.filter((m) => m.at > meta.startsAt + 30 * MIN && m.at < meta.startsAt + 45 * MIN && !m.replyTo).map((m) => m.body);
    expect(new Set(stretch).size / stretch.length).toBeGreaterThan(0.8);
  });

  it('builds a live snapshot with the crowd and who is typing', () => {
    const { meta } = soccerWithLateGoal();
    const snap = eventChatSnapshot(meta, meta.startsAt + 60 * MIN);
    expect(snap.phase).toBe('live');
    expect(snap.watchers).toBeGreaterThan(snap.chatters);
    expect(snap.messages.length).toBeGreaterThan(0);
  });

  it('works for every kind of sport', () => {
    for (const sport of ['f1', 'cricket', 'tennis', 'golf', 'mma', 'cycling', 'basketball', 'baseball']) {
      const meta = metas.find((m) => m.sportId === sport && !m.disruption)!;
      const list = eventBotMessages(finalState(meta), meta.startsAt + meta.durationMs * 0.6, 50);
      expect(list.length).toBe(50);
      for (const m of list) expect(m.body).not.toMatch(/\{\w+\}|undefined/);
    }
  });
});

describe('your messages and Section chat', () => {
  it('answers your messages with reactions that only build over time', () => {
    const msg = { id: 'm_test1', threadId: 'event:x', body: 'Come on!!', at: 1_000_000 };
    const early = echoesFor(msg, 'keithr', msg.at + 1000, 'soccer');
    const later = echoesFor(msg, 'keithr', msg.at + 120_000, 'soccer');
    expect(Object.keys(early.reactions)).toHaveLength(0);
    const total = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
    expect(total(later.reactions)).toBeGreaterThan(0);
    expect(echoesFor(msg, 'keithr', msg.at + 120_000, 'soccer')).toEqual(later);
    for (const r of later.replies) {
      expect(r.body).toContain('@keithr');
      expect(r.at).toBeGreaterThan(msg.at);
    }
  });

  it('keeps public Sections lively and in order', () => {
    const section = DEMO_SECTIONS[3];
    const now = Date.parse('2026-11-22T21:00:00Z');
    const list = sectionBotMessages(section.id, section.sportId, sectionFans(section), now);
    expect(list.length).toBe(100);
    for (const m of list) expect(m.at).toBeLessThanOrEqual(now);
    for (let i = 1; i < list.length; i++) expect(list[i - 1].at).toBeGreaterThanOrEqual(list[i].at);
    // At least a few messages in the last hour of a busy evening.
    expect(list.filter((m) => m.at > now - 60 * MIN).length).toBeGreaterThanOrEqual(3);
    // A reply always quotes something said before it.
    for (const m of list.filter((x) => x.replyTo)) {
      expect(list.some((x) => x.username === m.replyTo!.username && x.at < m.at && x.body.startsWith(m.replyTo!.body))).toBe(true);
    }
    const snap = sectionChatSnapshot(section.id, section.sportId, sectionFans(section), section.memberIds.length, now);
    expect(snap.chatters).toBeLessThanOrEqual(section.memberIds.length);
    expect(snap.chatters).toBeGreaterThan(0);
  });
});
