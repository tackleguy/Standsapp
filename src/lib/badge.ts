// Generated badges instead of logos: initials on a two-color shape.
import { hashText } from './random';

export { hashText };

const PALETTE = [
  ['#E63946', '#F1FAEE'], ['#1D3557', '#A8DADC'], ['#2A9D8F', '#E9C46A'],
  ['#6A4C93', '#FFCA3A'], ['#F3722C', '#1B1B1E'], ['#277DA1', '#F9C74F'],
  ['#43AA8B', '#0B132B'], ['#B5179E', '#F8F9FA'], ['#3A0CA3', '#4CC9F0'],
  ['#588157', '#DAD7CD'], ['#BC4749', '#F2E8CF'], ['#14213D', '#FCA311'],
] as const;

export type BadgeShape = 'circle' | 'shield' | 'hex';

export interface BadgeSpec {
  initials: string;
  background: string;
  foreground: string;
  shape: BadgeShape;
}

/** Same name always gives the same badge, on every phone. */
export function badgeFor(
  name: string,
  shortName?: string,
  kind: 'team' | 'athlete' = 'team',
  colors?: readonly [string, string] | null,
): BadgeSpec {
  const h = hashText(name.toLowerCase());
  const [paletteBg, paletteFg] = PALETTE[h % PALETTE.length];
  const fromName = name
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => w[0])
    .join('');
  const source = (shortName ?? '').trim().length > 0 ? (shortName as string) : fromName;
  const cleaned = source.replace(/[^A-Za-z0-9]/g, '');
  const initials = (cleaned.length > 0 ? cleaned : '?').slice(0, 3).toUpperCase();
  const shape: BadgeShape = kind === 'athlete' ? 'circle' : (h >> 8) % 2 === 0 ? 'shield' : 'hex';
  return {
    initials,
    background: colors?.[0] ?? paletteBg,
    foreground: colors?.[1] ?? paletteFg,
    shape,
  };
}

/** Avatar colors for fans, from their avatar seed. */
export function avatarColors(seed: string): [string, string] {
  const [bg, fg] = PALETTE[hashText(seed) % PALETTE.length];
  return [bg, fg];
}
