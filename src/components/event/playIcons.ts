// An icon (emoji) for every kind of play, and the headline shown when a big one lands.

const BY_TAG: Record<string, string> = {
  CHANCE: '💥', SAVE: '🧤', OFFSIDE: '🚩', FREEKICK: '🎯', FOUL: '⚠️', YELLOW: '🟨', RED: '🟥', CORNER: '⛳',
  SUB: '🔁', VAR: '📺', TMO: '📺', REVIEW: '📺', CHALLENGE: '🚩',
  TRY: '🏉', CONV: '🎯', CONV_MISS: '❌', PEN: '🎯', DROP: '🦶', BREAK: '⚡', TURNOVER: '🔄', SCRUM: '🤼', LINEOUT: '🙌',
  KICK: '🦶', CARRY: '💪', KNOCKON: '❌', SINBIN: '🟨', ERROR: '❌', SETRESTART: '🔁', SET: '🔁',
  '2PT': '🏀', '3PT': '🎯', FT: '🏀', MISS: '⭕', BLOCK: '🚫', STEAL: '🖐️', REB: '🔄', TO: '❌', TIMEOUT: '⏸️',
  TD: '🏈', PAT: '🎯', PAT_MISS: '❌', FG: '🎯', SAF: '🛡️', INT: '🙌', FUMBLE: '😱', SACK: '💥', BIGPLAY: '⚡', '4TH': '4️⃣',
  PUNT: '🦶', '1ST': '⛓️', PASS: '🏈', FLAG: '🚩',
  PENALTY: '⏱️', POST: '🔔', HIT: '💥', ICING: '🧊', FACEOFF: '⚫',
  MARK: '🙌', TACKLE: '💪', FIFTY: '🚩', CLEARANCE: '🦶', BEHIND: '•', IN50: '➡️', FREE: '🚩',
  SUPER: '⭐', INTERCEPT: '🙌', REBOUND: '🔄', HELD: '✋',
  WICKET: '☝️', SIX: '6️⃣', FOUR: '4️⃣', HUNDRED: '💯', TOSS: '🪙', INNINGS: '🔁',
  HR: '💣', WALKOFF: '🎉', K: '🔥', DP: '🔁', DOUBLE: '2️⃣',
  ACE: '🎾', TIEBREAK: '⚖️', MATCHPOINT: '🏆',
  KNOCKDOWN: '💥', ROUND: '🔔', ROUND_END: '🔔', ACTION: '👊',
  OVERTAKE: '⏩', PIT: '🔧', DNF: '🚫', SC: '🚨', LEAD: '🥇', FASTEST: '⏱️', FINAL_LAP: '🏁', PODIUM: '🏆', CRASH: '💥', GAP: '⏱️',
  BIRDIE: '🐦', EAGLE: '🦅', ATTACK: '⚡', KOM: '⛰️', SPRINT: '💨', FLAMME: '🚩', CATCH: '🤝',
  START: '🟢', FINAL: '🏁', PERIOD: '⏸️', HALF: '⏸️', RESTART: '▶️',
};

const SPORT_OVERRIDES: Record<string, Record<string, string>> = {
  soccer: { GOAL: '⚽', SHOT: '👟', FINAL: '🏁' },
  ice_hockey: { GOAL: '🚨', SHOT: '🏒', SAVE: '🧤' },
  aussie_rules: { GOAL: '🎯' },
  netball: { GOAL: '🏐', FOUL: '✋' },
  basketball: { FOUL: '✋' },
  tennis: { ACE: '🎾', BREAK: '💥', SET: '✅', DOUBLE: '❌', HOLD: '🎾' },
  golf: { ACE: '⛳' },
  cricket: { RUN: '🏏', CATCH: '🧤', DROP: '😬' },
  baseball: { RUN: '⚾' },
  american_football: { RUN: '🏃' },
};

export function playIcon(tag: string | null, sportId: string): string {
  if (!tag) return '•';
  return SPORT_OVERRIDES[sportId]?.[tag] ?? BY_TAG[tag] ?? '•';
}

const HEADLINES: Record<string, string> = {
  GOAL: 'GOAL!', TRY: 'TRY!', TD: 'TOUCHDOWN!', DROP: 'DROP GOAL!', FG: 'FIELD GOAL!', SAF: 'SAFETY!', RED: 'RED CARD',
  INT: 'INTERCEPTED!', FUMBLE: 'FUMBLE!', WICKET: 'WICKET!', SIX: 'SIX!', HUNDRED: 'CENTURY!', INNINGS: 'INNINGS OVER',
  HR: 'HOME RUN!', WALKOFF: 'WALK-OFF!', KNOCKDOWN: 'KNOCKDOWN!', SHOOTOUT: 'SHOOTOUT!', SET: 'SET!', BREAK: 'BREAK!',
  LEAD: 'NEW LEADER', DNF: 'OUT OF THE RACE', SC: 'SAFETY CAR', EAGLE: 'EAGLE!', ACE: 'ACE!', CATCH: 'CAUGHT!', SUPER: 'SUPER SHOT!',
  FINAL: 'FULL TIME', PERIOD: 'OVERTIME!',
};

const FINAL_WORDS: Record<string, string> = {
  soccer: 'FULL TIME', rugby_union: 'FULL TIME', rugby_league: 'FULL TIME', aussie_rules: 'FULL TIME', netball: 'FULL TIME',
  cricket: 'MATCH OVER', tennis: 'GAME, SET, MATCH', mma: 'WE HAVE A WINNER', boxing: 'WE HAVE A WINNER',
  f1: 'CHEQUERED FLAG', motogp: 'CHEQUERED FLAG', indycar: 'CHEQUERED FLAG', cycling: 'STAGE WINNER', golf: 'ROUND COMPLETE',
};

/** The banner headline for a big moment, or null if it is not worth a banner. */
export function headlineFor(tag: string | null, sportId: string): string | null {
  if (!tag) return null;
  if (tag === 'FINAL') return FINAL_WORDS[sportId] ?? 'FINAL';
  if (sportId === 'tennis' && tag === 'SET') return 'SET!';
  if (sportId === 'ice_hockey' && tag === 'GOAL') return 'GOAL!';
  return HEADLINES[tag] ?? null;
}

/** Tags that are not plays but breaks in the action, drawn as dividers. */
export const DIVIDER_TAGS = new Set(['START', 'PERIOD', 'HALF', 'INNINGS', 'ROUND', 'ROUND_END', 'OVER']);
