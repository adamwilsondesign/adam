import { describe, expect, it } from "vitest";

import { orderForSeed, shuffleWithSeed } from "@/features/work/shuffle";

const IDS = Array.from({ length: 40 }, (_, i) => `client-${i}`);

describe("shuffleWithSeed", () => {
  it("is deterministic for a fixed seed", () => {
    expect(shuffleWithSeed(IDS, 12345)).toEqual(shuffleWithSeed(IDS, 12345));
  });

  it("produces different orders for different seeds", () => {
    expect(shuffleWithSeed(IDS, 1)).not.toEqual(shuffleWithSeed(IDS, 2));
  });

  it("keeps every element exactly once", () => {
    const shuffled = shuffleWithSeed(IDS, 99);
    expect([...shuffled].sort()).toEqual([...IDS].sort());
  });
});

describe("orderForSeed", () => {
  it("assigns a stable position to every id", () => {
    const order = orderForSeed(IDS, 7);
    expect(order.size).toBe(IDS.length);
    const positions = [...order.values()].sort((a, b) => a - b);
    expect(positions).toEqual(IDS.map((_, i) => i));
  });

  it("keeps surviving items' relative order stable across filtering", () => {
    const order = orderForSeed(IDS, 42);
    const subsetA = IDS.filter((_, i) => i % 2 === 0).sort(
      (a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0),
    );
    const subsetB = IDS.filter((_, i) => i % 4 === 0).sort(
      (a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0),
    );
    // subsetB is subsetA filtered further; relative order must be preserved.
    const filtered = subsetA.filter((id) => subsetB.includes(id));
    expect(filtered).toEqual(subsetB);
  });
});
