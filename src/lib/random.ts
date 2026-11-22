// Deterministic randomness. The demo world must look identical on every phone and
// after every reload, so every "random" choice is derived from a text seed.

/** FNV-1a hash: same text in, same 32-bit number out. */
export function hashText(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A small, fast seeded random generator (mulberry32). */
export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Float in [min, max). */
  float(min: number, max: number): number;
  /** True with the given probability. */
  chance(p: number): boolean;
  /** One item from a non-empty list. */
  pick<T>(items: readonly T[]): T;
  /** A shuffled copy. */
  shuffle<T>(items: readonly T[]): T[];
  /** Poisson-distributed count with the given mean. */
  poisson(mean: number): number;
  /** Roughly normal value (sum of uniforms). */
  normal(mean: number, spread: number): number;
}

export function createRng(seed: string | number): Rng {
  let a = typeof seed === 'number' ? seed >>> 0 : hashText(seed);
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    float: (min, max) => min + next() * (max - min),
    chance: (p) => next() < p,
    pick: (items) => items[Math.floor(next() * items.length)],
    shuffle: (items) => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
    poisson: (mean) => {
      const limit = Math.exp(-mean);
      let k = 0;
      let p = 1;
      do {
        k++;
        p *= next();
      } while (p > limit && k < 200);
      return k - 1;
    },
    normal: (mean, spread) => {
      const u = next() + next() + next() + next() - 2; // roughly -2..2, bell shaped
      return mean + (u / 2) * spread;
    },
  };
  return rng;
}

/** Short unique-enough id for things created on this device. */
export function localId(prefix: string): string {
  const rand = Math.floor(Math.random() * 0xffffffff).toString(36);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}
