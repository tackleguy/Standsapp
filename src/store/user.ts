// Everything about this fan, saved on the device until the database arrives.
// Every action enforces the same rules the server routines will.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { allTemplates, mintedBefore, setMembers, templateById } from '@/data/demo/cards';
import { callsForEvent, outcomeFor } from '@/data/demo/calls';
import { finalState, simulate } from '@/data/demo/engines';
import { eventMetaById, eventsBetween } from '@/data/demo/schedule';
import { demoSectionByCode, demoSectionById } from '@/data/demo/sections';
import { competitorById } from '@/data/demo/world';
import type { CallOption, CallView, CardTemplate, OwnedCard, PackTypeId } from '@/data/types';
import { HOUR, utcDayKey } from '@/lib/format';
import { localId } from '@/lib/random';
import { containsBlockedWord, FILTER_MESSAGE } from '@/lib/wordFilter';
import { validateBirthYear, validateDisplayName, validateEmail, validateUsername } from '@/logic/account';
import {
  isProtected, nextRarity, quickSellValue, setProgress, validateShowcaseAdd, validateTradeUp, variantKey,
} from '@/logic/cards';
import { computeGateCheck } from '@/logic/gateCheck';
import { gamePackOpen, rollCards } from '@/logic/packs';
import { potentialPayout, validateStake } from '@/logic/predictions';
import {
  CARD_WIN_TIX, COMMENT_COOLDOWN_MS, COMMENT_MAX, GAME_DAY_WIN_MULTIPLIER, PACK_TYPES, WELCOME_CLOUT, WELCOME_TIX,
} from '@/logic/rules';

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

export type { OwnedCard };
export interface PackResult { cards: OwnedCard[]; isNew: boolean[] }
export interface PackRequest { packId: PackTypeId; sportId?: string | null; eventId?: string | null }
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
  /** Card ids pinned to the profile showcase, in order. */
  showcase: string[];
  /** Sports whose set reward has been collected. */
  claimedSets: string[];
  /** UTC day key of the last Daily Free Pack. */
  lastFreePack: string | null;
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
  openPack: (request: PackRequest, now: number) => PackResult | { error: string };
  quickSell: (cardIds: string[], now: number) => { sold: number; tix: number } | { error: string };
  toggleFavorite: (cardId: string) => void;
  toggleShowcase: (cardId: string) => string | null;
  tradeUp: (cardIds: string[], now: number) => PackResult | { error: string };
  claimSet: (sportId: string, now: number) => { tix: number } | { error: string };
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
    showcase: [] as string[],
    claimedSets: [] as string[],
    lastFreePack: null as string | null,
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
        // Game Day cards earn double for their own game and get a WON stamp.
        const paid = new Set(s.cardBonusesPaid);
        const stamped = new Set<string>();
        if (s.cards.length > 0) {
          const owned = new Map<string, OwnedCard[]>();
          for (const c of s.cards) owned.set(c.competitorId, [...(owned.get(c.competitorId) ?? []), c]);
          // A team card (an F1 constructor, a cycling team) also pays when one of its athletes wins.
          const parentOf = (id: string) => competitorById(id)?.parentId ?? '';
          for (const meta of eventsBetween(now - 24 * HOUR, now)) {
            if (!meta.competitorIds.some((id) => owned.has(id) || owned.has(parentOf(id)))) continue;
            const st = simulate(meta, now);
            if (st.status !== 'finished') continue;
            for (const e of st.entries) {
              if (!e.isWinner) continue;
              for (const card of [...(owned.get(e.competitorId) ?? []), ...(owned.get(parentOf(e.competitorId)) ?? [])]) {
                const key = `${card.id}:${meta.id}`;
                if (paid.has(key)) continue;
                // Only wins that finish after the fan got the card count.
                if (st.endsAt < card.acquiredAt) continue;
                paid.add(key);
                const gameDay = card.eventId === meta.id;
                if (gameDay) stamped.add(card.id);
                const amount = CARD_WIN_TIX[card.rarity] * (gameDay ? GAME_DAY_WIN_MULTIPLIER : 1);
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
          cards: stamped.size > 0 ? s.cards.map((c) => (stamped.has(c.id) ? { ...c, wonGame: true } : c)) : s.cards,
          cardBonusesPaid: keepRecent([...paid], 3000),
          ledger: keepRecent([...s.ledger, ...ledger], 600),
        });
        return report;
      },

      openPack: ({ packId, sportId = null, eventId = null }, now) => {
        const s = get();
        if (s.profile.isGuest) return { error: 'Create a free account to collect Stand Cards.' };
        const pack = PACK_TYPES[packId];
        if (!pack) return { error: 'That pack is not in the store.' };
        const today = utcDayKey(now);
        if (packId === 'daily' && s.lastFreePack === today) return { error: 'You have opened today\u2019s free pack. A new one arrives tomorrow.' };
        if (s.tix < pack.cost) return { error: 'Not enough Tix.' };

        let filter: ((t: CardTemplate) => boolean) | null = null;
        let gameId: string | null = null;
        if (packId === 'game') {
          const meta = eventId ? eventMetaById(eventId) : undefined;
          if (!meta || meta.disruption) return { error: 'That game is not on the schedule.' };
          if (!gamePackOpen(simulate(meta, now), now)) return { error: 'The Game Pack for this game is closed.' };
          const inGame = new Set(meta.competitorIds);
          filter = (t) => inGame.has(t.competitorId);
          gameId = meta.id;
        } else if (sportId && pack.sportChoice) {
          filter = (t) => competitorById(t.competitorId)?.sportId === sportId;
        }

        const rolled = rollCards({ pack, templates: filter ? allTemplates().filter(filter) : allTemplates(),
          mint: s.mintCounts, random: Math.random, mintedBefore, eventId: gameId });
        if ('error' in rolled) return rolled;
        const cards: OwnedCard[] = rolled.cards.map((r, i) => ({
          id: localId('c'), templateId: r.templateId, competitorId: r.competitorId, rarity: r.rarity, serial: r.serial,
          acquiredAt: now + i, finish: r.finish, eventId: gameId, source: packId,
        }));
        const owned = new Set(s.cards.map(variantKey));
        const isNew = cards.map((c) => {
          const k = variantKey(c);
          const fresh = !owned.has(k);
          owned.add(k);
          return fresh;
        });
        const ref = localId('pack');
        set({
          tix: s.tix - pack.cost, cards: [...s.cards, ...cards], mintCounts: rolled.mint,
          lastFreePack: packId === 'daily' ? today : s.lastFreePack,
          ledger: pack.cost > 0 ? keepRecent([...s.ledger, ledgerRow('tix', -pack.cost, `pack_${packId}`, ref)], 600) : s.ledger,
        });
        return { cards, isNew };
      },

      quickSell: (cardIds, now) => {
        const s = get();
        const ids = new Set(cardIds);
        const selling = s.cards.filter((c) => ids.has(c.id));
        if (selling.length === 0) return { error: 'Those cards are no longer in your collection.' };
        if (selling.some((c) => isProtected(c, s.showcase))) {
          return { error: 'Favorites and showcased cards are protected. Unfavorite the card first.' };
        }
        const tix = selling.reduce((sum, c) => sum + quickSellValue(c), 0);
        set({
          cards: s.cards.filter((c) => !ids.has(c.id)),
          tix: s.tix + tix,
          ledger: keepRecent([...s.ledger, { ...ledgerRow('tix', tix, 'quick_sell', selling.map((c) => c.id).join(',')), at: now }], 600),
        });
        return { sold: selling.length, tix };
      },

      toggleFavorite: (cardId) => set({ cards: get().cards.map((c) => (c.id === cardId ? { ...c, favorite: !c.favorite } : c)) }),

      toggleShowcase: (cardId) => {
        const s = get();
        if (!s.cards.some((c) => c.id === cardId)) return 'That card is no longer in your collection.';
        if (s.showcase.includes(cardId)) {
          set({ showcase: s.showcase.filter((id) => id !== cardId) });
          return null;
        }
        const err = validateShowcaseAdd(s.showcase, cardId);
        if (err) return err;
        set({ showcase: [...s.showcase, cardId] });
        return null;
      },

      tradeUp: (cardIds, now) => {
        const s = get();
        if (s.profile.isGuest) return { error: 'Create a free account to collect Stand Cards.' };
        const picked = cardIds.map((id) => s.cards.find((c) => c.id === id)).filter((c): c is OwnedCard => !!c);
        if (picked.length !== cardIds.length) return { error: 'Some of those cards are no longer in your collection.' };
        const err = validateTradeUp(picked, s.showcase);
        if (err) return { error: err };
        const target = nextRarity(picked[0].rarity);
        if (!target) return { error: 'Legendary is already the top rarity.' };
        // Five cards from one sport trade up within that sport; a mix can become any sport.
        const sports = new Set(picked.map((c) => competitorById(c.competitorId)?.sportId));
        const sport = sports.size === 1 ? [...sports][0] : null;
        const pool = allTemplates().filter((t) => t.rarity === target && (!sport || competitorById(t.competitorId)?.sportId === sport));
        const pack = { ...PACK_TYPES.standard, size: 1, odds: [{ rarity: target, chance: 1 }] };
        const rolled = rollCards({ pack, templates: pool, mint: s.mintCounts, random: Math.random, mintedBefore });
        if ('error' in rolled) return rolled;
        const r = rolled.cards[0];
        const card: OwnedCard = { id: localId('c'), templateId: r.templateId, competitorId: r.competitorId, rarity: r.rarity,
          serial: r.serial, acquiredAt: now, finish: r.finish, eventId: null, source: 'tradeup' };
        const used = new Set(cardIds);
        const remaining = s.cards.filter((c) => !used.has(c.id));
        set({ cards: [...remaining, card], mintCounts: rolled.mint });
        return { cards: [card], isNew: [!remaining.some((c) => variantKey(c) === variantKey(card))] };
      },

      claimSet: (sportId, now) => {
        const s = get();
        if (s.profile.isGuest) return { error: 'Create a free account to collect Stand Cards.' };
        if (s.claimedSets.includes(sportId)) return { error: 'You already collected this set reward.' };
        const progress = setProgress(setMembers(sportId).map((c) => c.id), s.cards);
        if (!progress.complete) return { error: `Collect all ${progress.total} cards first. You have ${progress.owned}.` };
        set({
          tix: s.tix + progress.reward,
          claimedSets: [...s.claimedSets, sportId],
          ledger: keepRecent([...s.ledger, { ...ledgerRow('tix', progress.reward, 'set_reward', sportId), at: now }], 600),
        });
        return { tix: progress.reward };
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
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      // Version 2 added Holo cards, favorites, the showcase, sets and the free pack.
      // Older saves keep every card; new fields start empty.
      migrate: (saved) => {
        const old = (saved ?? {}) as Partial<UserState>;
        return {
          ...old,
          cards: (old.cards ?? []).map((c) => ({ finish: 'base' as const, ...c })),
          showcase: old.showcase ?? [],
          claimedSets: old.claimedSets ?? [],
          lastFreePack: old.lastFreePack ?? null,
        } as UserState;
      },
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
