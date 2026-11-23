// A small symbol for each kind of play, used in one-line play snippets.
const GLYPHS: Record<string, string> = {
  // Soccer
  GOAL: '⚽', PEN: '⚽', CHANCE: '🎯', POST: '🎯', SAVE: '🧤', YELLOW: '🟨', RED: '🟥', SUB: '🔁', VAR: '📺', CORNER: '🚩',
  // Rugby and footy
  TRY: '🏉', CONV: '🏉', PENALTY: '🏉', DROP: '🏉', TMO: '📺', SINBIN: '🟨', SCRUM: '🏉', LINEOUT: '🏉', MARK: '🏉',
  BEHIND: '🏉', TACKLE: '💥', SETRESTART: '🏉',
  // Gridiron
  TD: '🏈', FG: '🏈', SAF: '🏈', PAT: '🏈', INT: '🏈', INTERCEPT: '🏈', FUMBLE: '🏈', SACK: '💥', PUNT: '🏈', BIGPLAY: '🏈',
  // Basketball and netball
  REBOUND: '🏀', STEAL: '🏀', BLOCK: '🏀', TURNOVER: '🔄', TIMEOUT: '⏸️', FT: '🏀', SUPER: '🔥',
  // Hockey
  CLEARANCE: '🏒',
  // Baseball
  HR: '⚾', WALKOFF: '⚾', K: '⚾', DOUBLE: '⚾', DP: '⚾', RUN: '⚾', ERROR: '⚾',
  // Cricket
  SIX: '🏏', FOUR: '🏏', WICKET: '🏏', HUNDRED: '💯', FIFTY: '🏏', CATCH: '🏏', REVIEW: '📺', TOSS: '🪙', INNINGS: '🏏',
  // Combat
  KNOCKDOWN: '🥊', ROUND: '🥊', ACTION: '🥊',
  // Motorsport
  OVERTAKE: '🏎️', PIT: '🔧', SC: '🚨', DNF: '⚠️', LEAD: '🏁', FASTEST: '⏱️', FINAL_LAP: '🏁', PODIUM: '🏆',
  // Golf
  BIRDIE: '⛳', EAGLE: '🦅', ACE: '⛳', HOLD: '⛳',
  // Tennis
  BREAK: '🎾', SET: '🎾', TIEBREAK: '🎾', MATCHPOINT: '🎾',
  // Cycling
  ATTACK: '🚴', SPRINT: '🚴', KOM: '⛰️', CRASH: '⚠️', FLAMME: '🚩',
  // Everyone
  FINAL: '🏁', SHOOTOUT: '🥅', CHALLENGE: '📺',
};

export function tagGlyph(tag: string | null | undefined): string {
  if (!tag) return '•';
  return GLYPHS[tag] ?? '•';
}
