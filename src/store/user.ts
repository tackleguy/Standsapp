// Everything about this fan, saved on the device until the database arrives.
// Every action enforces the same rules the server routines will.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { allTemplates, CARD_WIN_TIX, mintedBefore, templateById } from '@/data/demo/cards';
import { callsForEvent, outcomeFor } from '@/data/demo/calls';
import { finalState, simulate } from '@/data/demo/engines';
import { eventMetaById, eventsBetween } from '@/data/demo/schedule';
import { demoSectionByCode, demoSectionById } from '@/data/demo/sections';
import { competitorById } from '@/data/demo/world';
import type { CallOption, CallView, CardRarity } from '@/data/types';
import { HOUR, utcDayKey } from '@/lib/format';
import { localId } from '@/lib/random';
import { containsBlockedWord, FILTER_MESSAGE } from '@/lib/wordFilter';
import { validateBirthYear, validateDisplayName, validateEmail, validateUsername } from '@/logic/account';
import { computeGateCheck } from '@/logic/gateCheck';
import { pickTemplate, rollRarity } from '@/logic/packs';
import { potentialPayout, validateStake } from '@/logic/predictions';
import { COMMENT_COOLDOWN_MS, COMMENT_MAX, PACK_COST, PACK_SIZE, WELCOME_CLOUT, WELCOME_TIX } from '@/logic/rules';

export type Currency = 'clout' | 'tix';

export interface Profile {
  username: string;
  displayName: string;
  avatarSeed: string;
  birthYear: number | null;
  email: string | null;
  isGuest: boolean;
  createdAt: number;
}

export interface LedgerEntry { id: string; currency: Currency; amount: number; reason: string; at: number; ref: string | null }

export interface Prediction {
  id: string;
  callId: string;
  eventId: string;
  sportId: string;
  eventTitle: string;
  question: string;
  optionId: string;
  optionLabel: string;
  excludes?: string[];
  stake: number;
  multiplier: number;
  placedAt: number;
  status: 'open' | 'won' | 'lost' | 'void';
  payout: number | null;
  settledAt: number | null;
}

export interface OwnedCard { id: string; templateId: string; competitorId: string; rarity: CardRarity; serial: number; acquiredAt: number }
export interface MyMessage { id: string; threadId: string; body: string; at: number; deleted: boolean }
export interface UserSection { id: string; name: string; sportId: string; inviteCode: string; isPublic: boolean; createdAt: number }

export interface SettleReport { won: number; lost: number; refunded: number; clout: number; tix: number }

interface UserState {
  profile: Profile;
  onboarded: boolean;
  followedSports: string[];
  followedCompetitors: string[];
  /** Other fans you follow, for the Following leaderboard. */
  followedFans: string[];
  clout: number;
  tix: number;
  streakDays: number;
  lastGateCheck: string | null;
  ledger: LedgerEntry[];
  predictions: Prediction[];
  cards: OwnedCard[];
  cardBonusesPaid: string[];
  mintCounts: Record<string, number>;
  ratings: Record<string, number>;
  reactions: Record<string, string>;
  blocked: string[];
  hiddenMessages: string[];
  reports: { messageId: string; userId: string; reason: string; at: number }[];
  messages: MyMessage[];
  sections: UserSection[];
  joinedDemoSections: string[];
  lastPostAt: number;

  completeOnboarding: () => void;
  restartOnboarding: () => void;
  setFollowedSports: (ids: string[]) => void;
  toggleSport: (id: string) => void;
  toggleCompetitor: (id: string) => void;
  toggleFan: (id: string) => void;
  createAccount: (input: { username: string; displayName: string; birthYear: number; email: string }) => string | null;
  updateProfile: (input: { username: string; displayName: string }) => string | null;
  gateCheck: (now: number) => { clout: number; tix: number; streakDays: number } | { error: string };
  placePrediction: (input: { call: CallView; option: CallOption; options: CallOption[]; stake: number; eventTitle: string; sportId: string; now: number }) => string | null;
  settle: (now: number) => SettleReport;
  openPack: (sportId: string | null, now: number) => OwnedCard[] | { error: string };
  ratePlay: (playId: string, rating: number) => void;
  react: (messageId: string, emoji: string) => void;
  postMessage: (threadId: string, body: string, now: number) => string | null;
  deleteMessage: (id: string) => void;
  report: (messageId: string, userId: string, reason: string, now: number) => void;
  block: (userId: string) => void;
  unblock: (userId: string) => void;
  createSection: (name: string, sportId: string, isPublic: boolean, now: number) => UserSection | { error: string };
  joinSection: (code: string) => { id: string } | { error: string };
  leaveSection: (id: string) => void;
  deleteSection: (id: string) => void;
  deleteAccount: () => void;
}

function newProfile(): Profile {
  const seed = localId('fan').slice(-10);
  return { username: `fan_${seed.replace(/[^a-z0-9]/g, '').slice(0, 10)}`, displayName: 'New Fan', avatarSeed: seed,
    birthYear: null, email: null, isGuest: true, createdAt: Date.now() };
}

function initialData() {
  const now = Date.now();
  return {
    profile: newProfile(),
    onboarded: false,
    followedSports: [] as string[],
    followedCompetitors: [] as string[],
    followedFans: [] as string[],
    clout: WELCOME_CLOUT,
    tix: WELCOME_TIX,
    streakDays: 0,
    lastGateCheck: null as string | null,
    ledger: [
      { id: localId('l'), currency: 'clout' as Currency, amount: WELCOME_CLOUT, reason: 'welcome', at: now, ref: null },
      { id: localId('l'), currency: 'tix' as Currency, amount: WELCOME_TIX, reason: 'welcome', at: now, ref: null },
    ],
    predictions: [] as Prediction[],
    cards: [] as OwnedCard[],
    cardBonusesPaid: [] as string[],
    mintCounts: {} as Record<string, number>,
    ratings: {} as Record<string, number>,
    reactions: {} as Record<string, string>,
    blocked: [] as string[],
    hiddenMessages: [] as string[],
    reports: [] as UserState['reports'],
    messages: [] as MyMessage[],
    sections: [] as UserSection[],
    joinedDemoSections: [] as string[],
    lastPostAt: 0,
  };
}

const ledgerRow = (currency: Currency, amount: number, reason: string, ref: string | null = null): LedgerEntry =>
  ({ id: localId('l'), currency, amount, reason, at: Date.now(), ref });

const keepRecent = <T>(list: T[], max: number) => (list.length > max ? list.slice(list.length - max) : list);

function inviteCode(): string {
  return Array.from({ length: 8 }, () => '0123456789ABCDEF'[Math.floor(Math.random() * 16)]).join('');
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      ...initialData(),

      completeOnboarding: () => set({ onboarded: true }),
      restartOnboarding: () => set({ onboarded: false }),
      setFollowedSports: (ids) => set({ followedSports: ids }),
      toggleSport: (id) => {
        const cur = get().followedSports;
        set({ followedSports: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
      },
      toggleCompetitor: (id) => {
        const cur = get().followedCompetitors;
        set({ followedCompetitors: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
      },
      toggleFan: (id) => {
        const cur = get().followedFans ?? [];
        set({ followedFans: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
      },

      createAccount: ({ username, displayName, birthYear, email }) => {
        const err = validateUsername(username) ?? validateDisplayName(displayName)
          ?? validateBirthYear(birthYear, new Date().getFullYear()) ?? validateEmail(email);
        if (err) return err;
        set({ profile: { ...get().profile, username, displayName: displayName.trim(), birthYear,
          email: email.trim() || null, isGuest: false } });
        return null;
      },
      updateProfile: ({ username, displayName }) => {
        const err = validateUsername(username) ?? validateDisplayName(displayName);
        if (err) return err;
        set({ profile: { ...get().profile, username, displayName: displayName.trim() } });
        return null;
      },

      gateCheck: (now) => {
        const s = get();
        if (s.profile.isGuest) return { error: 'Create a free account to collect your daily Gate Check.' };
        const today = utcDayKey(now);
        const result = computeGateCheck({ clout: s.clout, streakDays: s.streakDays, lastGateCheck: s.lastGateCheck }, today);
        if ('error' in result) return result;
        set({
          clout: s.clout + result.clout, tix: s.tix + result.tix, streakDays: result.streakDays, lastGateCheck: today,
          ledger: keepRecent([...s.ledger, ledgerRow('clout', result.clout, 'gate_check'), ledgerRow('tix', result.tix, 'gate_check')], 600),
        });
        return result;
      },

      placePrediction: ({ call, option, options, stake, eventTitle, sportId, now }) => {
        const s = get();
        if (s.profile.isGuest) return 'Create a free account to make Calls.';
        if (call.status !== 'open' || now >= call.closesAt) return 'This call is closed.';
        if (!options.some((o) => o.id === option.id)) return 'That option no longer exists.';
        if (s.predictions.some((p) => p.callId === call.id)) return 'You already made this call.';
        const err = validateStake(stake, s.clout);
        if (err) return err;
        const prediction: Prediction = {
          id: localId('p'), callId: call.id, eventId: call.eventId, sportId, eventTitle, question: call.question,
          optionId: option.id, optionLabel: option.label, stake, multiplier: option.multiplier, placedAt: now,
          excludes: option.id.endsWith(':field') ? options.map((o) => o.competitorId).filter((x): x is string => !!x) : undefined,
          status: 'open', payout: null, settledAt: null,
        };
        set({
          clout: s.clout - stake,
          predictions: [...s.predictions, prediction],
          ledger: keepRecent([...s.ledger, ledgerRow('clout', -stake, 'prediction', prediction.id)], 600),
        });
        return null;
      },

      settle: (now) => {
        const s = get();
        const report: SettleReport = { won: 0, lost: 0, refunded: 0, clout: 0, tix: 0 };
        const ledger: LedgerEntry[] = [];
        let changed = false;
        const predictions = s.predictions.map((p) => {
          if (p.status !== 'open') return p;
          const meta = eventMetaById(p.eventId);
          if (!meta) return p;
          const state = simulate(meta, now);
          if (state.status !== 'finished' && state.status !== 'cancelled' && state.status !== 'postponed') return p;
          const call = callsForEvent(meta).find((c) => c.id === p.callId);
          const outcome = call ? outcomeFor(call, { optionId: p.optionId, excludes: p.excludes }, finalState(meta)) : 'void';
          changed = true;
          if (outcome === 'won') {
            const payout = potentialPayout(p.stake, p.multiplier);
            report.won++; report.clout += payout;
            ledger.push(ledgerRow('clout', payout, 'prediction_win', p.id));
            return { ...p, status: 'won' as const, payout, settledAt: now };
          }
          if (outcome === 'void') {
            report.refunded++; report.clout += p.stake;
            ledger.push(ledgerRow('clout', p.stake, 'prediction_refund', p.id));
            return { ...p, status: 'void' as const, payout: p.stake, settledAt: now };
          }
          report.lost++;
          return { ...p, status: 'lost' as const, payout: 0, settledAt: now };
        });

        // Cards of competitors who won today earn Tix, once per card per event.
        const paid = new Set(s.cardBonusesPaid);
        if (s.cards.length > 0) {
          const owned = new Map<string, OwnedCard[]>();
          for (const c of s.cards) owned.set(c.competitorId, [...(owned.get(c.competitorId) ?? []), c]);
          for (const meta of eventsBetween(now - 24 * HOUR, now)) {
            if (!meta.competitorIds.some((id) => owned.has(id))) continue;
            const st = simulate(meta, now);
            if (st.status !== 'finished') continue;
            for (const e of st.entries) {
              if (!e.isWinner) continue;
              for (const card of owned.get(e.competitorId) ?? []) {
                const key = `${card.id}:${meta.id}`;
                if (paid.has(key)) continue;
                paid.add(key);
                const amount = CARD_WIN_TIX[card.rarity];
                report.tix += amount;
                ledger.push(ledgerRow('tix', amount, 'card_win', card.id));
                changed = true;
              }
            }
          }
        }
        if (!changed) return report;
        set({
          predictions,
          clout: s.clout + report.clout,
          tix: s.tix + report.tix,
          cardBonusesPaid: keepRecent([...paid], 3000),
          ledger: keepRecent([...s.ledger, ...ledger], 600),
        });
        return report;
      },

      openPack: (sportId, now) => {
        const s = get();
        if (s.profile.isGuest) return { error: 'Create a free account to collect Stand Cards.' };
        if (s.tix < PACK_COST) return { error: 'Not enough Tix.' };
        const templates = allTemplates();
        const mint = { ...s.mintCounts };
        const cards: OwnedCard[] = [];
        for (let i = 0; i < PACK_SIZE; i++) {
          const rarity = rollRarity(Math.random());
          const t = pickTemplate(templates, rarity, Math.random,
            sportId ? (tpl) => competitorById(tpl.competitorId)?.sportId === sportId : undefined);
          if (!t) return { error: 'No cards are available yet.' };
          mint[t.id] = (mint[t.id] ?? mintedBefore(t.id)) + 1;
          cards.push({ id: localId('c'), templateId: t.id, competitorId: t.competitorId, rarity: t.rarity,
            serial: mint[t.id], acquiredAt: now + i });
        }
        const ref = localId('pack');
        set({
          tix: s.tix - PACK_COST, cards: [...s.cards, ...cards], mintCounts: mint,
          ledger: keepRecent([...s.ledger, ledgerRow('tix', -PACK_COST, 'pack', ref)], 600),
        });
        return cards;
      },

      ratePlay: (playId, rating) => {
        if (rating < 1 || rating > 10) return;
        set({ ratings: { ...get().ratings, [playId]: Math.round(rating) } });
      },
      react: (messageId, emoji) => {
        const cur = { ...get().reactions };
        if (cur[messageId] === emoji) delete cur[messageId];
        else cur[messageId] = emoji;
        set({ reactions: cur });
      },

      postMessage: (threadId, body, now) => {
        const s = get();
        if (s.profile.isGuest) return 'Create a free account to join the chat.';
        const text = body.trim();
        if (text.length === 0) return 'Write something first.';
        if (text.length > COMMENT_MAX) return `Keep it under ${COMMENT_MAX} characters.`;
        if (containsBlockedWord(text)) return FILTER_MESSAGE;
        if (now - s.lastPostAt < COMMENT_COOLDOWN_MS) return 'You are posting too fast. Try again in a moment.';
        set({ messages: keepRecent([...s.messages, { id: localId('m'), threadId, body: text, at: now, deleted: false }], 1500), lastPostAt: now });
        return null;
      },
      deleteMessage: (id) => set({ messages: get().messages.map((m) => (m.id === id ? { ...m, deleted: true } : m)) }),
      report: (messageId, userId, reason, now) => {
        const s = get();
        if (s.reports.some((r) => r.messageId === messageId)) return;
        set({ reports: [...s.reports, { messageId, userId, reason, at: now }], hiddenMessages: [...s.hiddenMessages, messageId] });
      },
      block: (userId) => { if (!get().blocked.includes(userId)) set({ blocked: [...get().blocked, userId] }); },
      unblock: (userId) => set({ blocked: get().blocked.filter((b) => b !== userId) }),

      createSection: (name, sportId, isPublic, now) => {
        const s = get();
        if (s.profile.isGuest) return { error: 'Create a free account to start a Section.' };
        const clean = name.trim();
        if (clean.length < 2 || clean.length > 40) return { error: 'Section names are 2 to 40 characters.' };
        if (containsBlockedWord(clean)) return { error: FILTER_MESSAGE };
        const section: UserSection = { id: localId('sec'), name: clean, sportId, inviteCode: inviteCode(), isPublic, createdAt: now };
        set({ sections: [...s.sections, section] });
        return section;
      },
      joinSection: (code) => {
        const s = get();
        if (s.profile.isGuest) return { error: 'Create a free account to join a Section.' };
        const clean = code.trim().toUpperCase();
        const mine = s.sections.find((x) => x.inviteCode === clean);
        if (mine) return { id: mine.id };
        const demo = demoSectionByCode(clean);
        if (!demo) return { error: 'That invite code does not match a Section.' };
        if (!s.joinedDemoSections.includes(demo.id)) set({ joinedDemoSections: [...s.joinedDemoSections, demo.id] });
        return { id: demo.id };
      },
      leaveSection: (id) => {
        if (demoSectionById(id)) set({ joinedDemoSections: get().joinedDemoSections.filter((x) => x !== id) });
      },
      deleteSection: (id) => set({ sections: get().sections.filter((x) => x.id !== id) }),

      deleteAccount: () => set({ ...initialData() }),
    }),
    {
      name: 'stands-user',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      // Save only data, never the functions.
      partialize: (s) => Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v !== 'function')) as Partial<UserState>,
    },
  ),
);

/** Clout won from Calls in the last 7 days (same rule as the weekly leaderboard). */
export function weeklyCloutWon(ledger: LedgerEntry[], now: number): number {
  return ledger.filter((l) => l.currency === 'clout' && l.reason === 'prediction_win' && l.at > now - 7 * 24 * HOUR)
    .reduce((a, l) => a + l.amount, 0);
}

export { templateById };
