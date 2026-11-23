// Team colours for the live game screen: readable on the night background and
// never the same for both sides of a scoreboard.
import { competitorById } from '@/data/api';
import { hexToRgb, luminance, readableOnDark } from '@/lib/color';
import { colors } from '@/theme/tokens';

/** A competitor's main colour, lifted so it reads on dark backgrounds. */
export function teamColor(id: string | null | undefined): string {
  const c = competitorById(id);
  const pair = c?.colors ?? competitorById(c?.parentId)?.colors;
  return pair ? readableOnDark(pair[0]) : colors.textDim;
}

/** White or near-black text, whichever has the higher contrast on a team colour. */
export function bestInk(bg: string): '#FFFFFF' | '#0A0E17' {
  const l = luminance(bg);
  return 1.05 / (l + 0.05) >= (l + 0.05) / 0.054 ? '#FFFFFF' : '#0A0E17';
}

function distance(a: string, b: string): number {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

/** Home and away colours; if the kits clash, the away side switches to its second colour. */
export function sideColors(homeId: string | undefined, awayId: string | undefined): [string, string] {
  const home = teamColor(homeId);
  let away = teamColor(awayId);
  if (distance(home, away) < 110) {
    const alt = competitorById(awayId)?.colors?.[1];
    away = alt && distance(home, readableOnDark(alt)) >= 110 ? readableOnDark(alt) : home === '#FFFFFF' ? colors.accent : '#E8ECF4';
  }
  return [home, away];
}
