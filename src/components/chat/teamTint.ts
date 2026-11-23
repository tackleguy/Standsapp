import { luminance, readableOnDark } from '@/lib/color';
import { colors } from '@/theme/tokens';

/**
 * The team colour to use for small accents on the dark background. Black or
 * navy kits use their second colour when it is a real colour (yellow, gold, red).
 */
export function teamTint(teamColors: readonly [string, string] | null | undefined, fallback: string = colors.textDim): string {
  if (!teamColors) return fallback;
  const [primary, secondary] = teamColors;
  if (luminance(primary) >= 0.06) return readableOnDark(primary);
  const s = luminance(secondary);
  if (s > 0.12 && s < 0.8) return secondary;
  return readableOnDark(primary, 0.22);
}
