/**
 * Deterministic ordering for the logo field. The grid keeps a seed in state
 * and re-seeds only at the intended moments: Work entry, a completed tag
 * change, and a settled (debounced) year change — never for unrelated
 * updates, so React re-renders cannot accidentally reshuffle the field.
 */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleWithSeed<T>(items: readonly T[], seed: number): T[] {
  const random = mulberry32(seed);
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = result[i] as T;
    result[i] = result[j] as T;
    result[j] = a;
  }
  return result;
}

export function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

/** Orders `ids` by the shuffled order for `seed`; stable for a fixed seed. */
export function orderForSeed(ids: readonly string[], seed: number): Map<string, number> {
  const shuffled = shuffleWithSeed(ids, seed);
  const order = new Map<string, number>();
  shuffled.forEach((id, index) => order.set(id, index));
  return order;
}
