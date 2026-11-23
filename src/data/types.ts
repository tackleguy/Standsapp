// The shapes the app works with. They mirror the planned database tables so
// that swapping the demo world for a real backend changes no screens.
import type { EventFormat } from '@/config/sports';

export type { EventFormat };
export type EventStatus = 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';
export type EntryRole = 'home' | 'away' | 'entrant';
export type CompetitorKind = 'team' | 'athlete';
export type CardRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type Importance = 1 | 2 | 3;

export interface Competition {
  id: string;
  sportId: string;
  name: string;
  short: string;
}

export interface Competitor {
  id: string;
  sportId: string;
  kind: CompetitorKind;
  name: string;
  shortName: string;
  parentId: string | null; // an athlete's team
  colors: readonly [string, string] | null;
  competitionId: string;
  /** Hidden skill rating 0..1 used by the demo simulator. */
  strength: number;
  /** Home city or nationality, shown as a fact. */
  home: string;
}

/** The fixed facts about an event, known before it starts. */
export interface EventMeta {
  id: string;
  sportId: string;
  format: EventFormat;
  competitionId: string;
  title: string;
  venue: string;
  startsAt: number; // ms since epoch
  durationMs: number; // expected real-world length
  competitorIds: string[]; // home first, then away (or the race field)
  /** Set when the event will not go ahead. */
  disruption: 'postponed' | 'cancelled' | null;
  /** Shown on every card and screen while data is invented. */
  isDemo: boolean;
}

export interface EntryState {
  competitorId: string;
  role: EntryRole;
  score: number | null;
  scoreText: string | null;
  position: number | null;
  isWinner: boolean | null;
  /** Extra short status like "Pit", "DNF", "Thru 14", "Serving". */
  note: string | null;
}

export interface Play {
  id: string; // `${eventId}#${seq}`
  eventId: string;
  seq: number;
  at: number; // ms timestamp when it happened
  clock: string;
  description: string;
  competitorId: string | null;
  importance: Importance;
  /** Short tag such as "GOAL", "TRY", "WICKET", "OVERTAKE". */
  tag: string | null;
  /** Score line right after this play, e.g. "2-1". */
  scoreAfter: string | null;
  /** Players in the play, main player first (ids from the player rosters). */
  playerIds?: string[];
  /** Each player's part in the play, same order as playerIds ("rush", "rec", "pass", "def", "bowl"...). */
  playerRoles?: string[];
  /** Short title for a play card: "13-yd catch", "Goal", "3-pointer", "Ace". */
  headline?: string;
  /** How big the play was, 0.0-9.9 (shown as the play's rating). */
  impact?: number;
  /** Index of the period it happened in (matches GameStats.periods). */
  period?: number;
  /** Football only: the situation before the snap and what happened. */
  football?: FootballSnap;
}

/** The down-and-distance details of one football play. */
export interface FootballSnap {
  /** Team with the ball. */
  offenseId: string;
  down: number; // 1-4, 0 for kicks
  distance: number;
  /** Ball spot as the offense's distance from its own goal line (0-100). */
  yardLine: number;
  /** Offensive personnel grouping, e.g. "11" = 1 RB, 1 TE, 3 WR. */
  personnel: string | null;
  kind: 'run' | 'pass' | 'sack' | 'kneel' | 'punt' | 'fg' | 'pat' | 'two' | 'kickoff' | 'penalty';
  yards: number;
  firstDown: boolean;
  touchdown: boolean;
  /** Yards after the catch, on completions. */
  yac: number | null;
  /** Gained enough to count as a successful play (40% of the distance on 1st down, 60% on 2nd, all of it on 3rd/4th). */
  success: boolean;
  /** Clock left in the period at the snap, in seconds. */
  clockSec: number;
}

export type StatsSection =
  | {
      type: 'table';
      title: string;
      columns: string[];
      rows: { key: string; competitorId?: string | null; cells: string[]; emphasis?: boolean }[];
    }
  | {
      type: 'compare';
      title: string;
      items: { label: string; home: number; away: number; suffix?: string }[];
    }
  | { type: 'note'; title: string; text: string };

export interface EventState {
  meta: EventMeta;
  status: EventStatus;
  periodLabel: string | null;
  /** 0 before the start, 1 at the finish. */
  progress: number;
  entries: EntryState[];
  plays: Play[]; // oldest first, only those that have happened
  stats: StatsSection[];
  /** One-line result once finished: "Harbor City won by 6 wickets". */
  resultText: string | null;
  /** Machine-readable facts used to settle Calls (totals, method, sets...). */
  facts: Record<string, string | number | boolean>;
  /** When the event ends (or is expected to), in ms. */
  endsAt: number;
}

// ---------- Calls (predictions) ----------
export type CallKind = 'winner' | 'total' | 'live_winner' | 'podium' | 'margin' | 'method' | 'first_score';

export interface CallOption {
  id: string;
  label: string;
  competitorId: string | null;
  multiplier: number;
}

export interface Call {
  id: string;
  eventId: string;
  kind: CallKind;
  question: string;
  opensAt: number;
  closesAt: number;
  options: CallOption[];
  /** In-play calls re-price their options from the live score. */
  livePriced: boolean;
  /** Over/under line, when the call has one. */
  line?: number;
  /** Which result fact settles this call. */
  factKey?: string;
  /** The competitor a yes/no call is about. */
  subjectId?: string;
}

export type CallStatus = 'upcoming' | 'open' | 'closed' | 'settled' | 'void';

export interface CallView extends Call {
  status: CallStatus;
  winningOptionId: string | null;
}

// ---------- Stand Cards ----------
export interface CardTemplate {
  id: string; // `${competitorId}:${rarity}`
  competitorId: string;
  rarity: CardRarity;
  season: string;
}

/** Holo cards are a shiny parallel of a card, with their own smaller print run. */
export type CardFinish = 'base' | 'holo';

/** The packs on sale in the Pack Store. Game Packs belong to one live game. */
export type PackTypeId = 'daily' | 'standard' | 'premium' | 'elite' | 'game';

/** Where a card came from. 'pick' = a player or team card you chose. */
export type CardSource = PackTypeId | 'tradeup' | 'pick';

/**
 * What a card shows. Players and teams are chosen and earn Tix from fantasy
 * points; plays and performances come out of packs. Cards saved before kinds
 * existed have no kind: they are classic team or athlete cards.
 */
export type CardKind = 'player' | 'team' | 'play' | 'performance';

/** A card a fan owns. Mirrors the planned `owned_cards` table. */
export interface OwnedCard {
  id: string;
  templateId: string;
  /** The team or athlete the card belongs to (for plays and performances: the player's side). */
  competitorId: string;
  kind?: CardKind;
  /** Player and performance cards: the player. Play cards: the main player. */
  playerId?: string | null;
  /** Play cards: the play (`${eventId}#${seq}`). */
  playId?: string | null;
  /** Play and performance cards: the game it happened in. */
  gameId?: string | null;
  rarity: CardRarity;
  serial: number;
  acquiredAt: number;
  /** Missing on cards opened before Holo existed: treat as 'base'. */
  finish?: CardFinish;
  /** Game Day cards remember the game their Game Pack came from. */
  eventId?: string | null;
  source?: CardSource;
  /** Favorites are protected from quick sell and trade-ups. */
  favorite?: boolean;
  /** A Game Day card whose team or athlete won its game. */
  wonGame?: boolean;
  /** Player and team cards: Tix earned so far. */
  earned?: number;
}

// ---------- Fans (simulated other people in the demo) ----------
export interface Fan {
  id: string;
  username: string;
  displayName: string;
  avatarSeed: string;
  favoriteSportId: string;
}

export interface ChatMessage {
  id: string;
  threadId: string; // "event:<id>" or "section:<id>"
  userId: string;
  username: string;
  displayName: string;
  avatarSeed: string;
  body: string;
  at: number;
  playId: string | null;
  isMine: boolean;
  /** Reaction counts from other fans, by emoji. */
  reactions: Record<string, number>;
}
