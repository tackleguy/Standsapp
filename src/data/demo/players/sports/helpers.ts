// Small helpers for writing sport stat definitions.
import type { GridCell, StatLine } from '../types';

/** A stat from a line, 0 when missing. */
export const n = (l: StatLine, key: string): number => l[key] ?? 0;

/** A grid cell that shows one stat as a whole number. */
export const stat = (key: string, label: string): GridCell => ({ label, value: (l) => String(Math.round(n(l, key))) });

/** A grid cell with a custom value. */
export const cell = (label: string, value: (l: StatLine) => string | number): GridCell => ({ label, value: (l) => String(value(l)) });

/** a / b to one decimal, or "–" when b is 0. */
export const avg = (a: number, b: number): string => (b > 0 ? (a / b).toFixed(1) : '–');

/** "7/9" made/attempted. */
export const ratio = (made: number, att: number): string => `${made}/${att}`;

/** "64%" or "–". */
export const pct = (a: number, b: number): string => (b > 0 ? `${Math.round((a / b) * 100)}%` : '–');

/** Joins the non-empty parts with spaces: ["2 G", "", "1 A"] -> "2 G 1 A". */
export const join = (parts: (string | null | false | undefined)[], sep = ' '): string => parts.filter(Boolean).join(sep);

/** "1 try" / "2 tries" style counts; null when zero (so join() drops it). */
export const count = (value: number, one: string, many = `${one}s`): string | null =>
  (value ? `${value} ${value === 1 ? one : many}` : null);

/** "6.2" innings pitched from outs recorded. */
export const innings = (outs: number): string => `${Math.floor(outs / 3)}.${outs % 3}`;

/** "+3" / "-2" / "E" (even) for golf scores relative to par. */
export const toPar = (v: number): string => (v === 0 ? 'E' : v > 0 ? `+${v}` : String(v));
