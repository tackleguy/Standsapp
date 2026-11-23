// Colour helpers for team colours on a dark background. Pure functions.

function clamp(n: number, lo = 0, hi = 255): number {
  return Math.min(hi, Math.max(lo, n));
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return [128, 128, 128];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.round(clamp(v)).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** "#FF0000", 0.2 -> "rgba(255,0,0,0.2)" */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Relative luminance 0 (black) .. 1 (white). */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Blend two colours: t = 0 gives a, t = 1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/**
 * A version of a team colour that stands out on the night-sky background:
 * very dark colours (navy, black) are lifted toward white until readable.
 */
export function readableOnDark(hex: string, minLuminance = 0.16): string {
  let out = hex;
  for (let i = 0; i < 10 && luminance(out) < minLuminance; i++) out = mix(out, '#FFFFFF', 0.18);
  return out;
}

/** Black or white, whichever reads better on top of the colour. */
export function inkOn(hex: string): '#0A0E17' | '#FFFFFF' {
  return luminance(hex) > 0.42 ? '#0A0E17' : '#FFFFFF';
}
