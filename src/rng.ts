// Seeded pseudo-random number generator (mulberry32)
// Allows reproducible runs — players can share seeds to replay.

export type RNG = () => number;

export function mulberry32(seed: number): RNG {
  let s = seed;
  return function () {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [min, max] inclusive */
export function rngInt(rng: RNG, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** Weighted random choice from an array of {id, weight} objects */
export function weightedChoice<T extends string>(
  rng: RNG,
  options: Array<{ id: T; weight: number }>
): T {
  const total = options.reduce((s, o) => s + o.weight, 0);
  let r = rng() * total;
  for (const o of options) {
    r -= o.weight;
    if (r <= 0) return o.id;
  }
  return options[options.length - 1].id;
}

/** Fisher-Yates shuffle */
export function rngShuffle<T>(rng: RNG, arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Generate a random seed from Math.random (used only once per run) */
export function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}
