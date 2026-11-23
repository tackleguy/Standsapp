// Fantasy points: every sport has its own scoring table (see
// src/data/demo/players/sports/), and a player card earns its player's fantasy
// points, rounded, as Tix after every game. Pure functions, so the server
// routines can mirror them exactly later.

/** Fantasy points for a stat line, using a sport's points-per-stat table. Two decimal places. */
export function fantasyPoints(weights: Record<string, number>, line: Record<string, number>): number {
  let pts = 0;
  for (const key of Object.keys(weights)) pts += (line[key] ?? 0) * weights[key];
  return Math.round(pts * 100) / 100;
}

/**
 * Tix a player card earns for one game: the player's fantasy points, rounded to
 * the nearest whole number. A bad game earns nothing; it never costs Tix.
 */
export function fantasyTix(points: number): number {
  return Math.max(0, Math.round(points));
}

/** How many of a team's best performers count towards its team card. */
export const TEAM_CARD_TOP = 3;

/**
 * Fantasy points for a team card: the combined points of the team's three best
 * performers in that game (or all of them, when fewer took part).
 */
export function teamFantasyPoints(playerPoints: number[]): number {
  const top = [...playerPoints].sort((a, b) => b - a).slice(0, TEAM_CARD_TOP);
  return Math.round(top.reduce((a, b) => a + Math.max(0, b), 0) * 100) / 100;
}

/** "12.4" — fantasy points as shown on screen. */
export function formatPoints(points: number): string {
  return (Math.round(points * 10) / 10).toFixed(1);
}
