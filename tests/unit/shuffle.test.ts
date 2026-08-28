import { describe, expect, it } from "vitest";

import { nextOrder, orderForSeed, shuffleWithSeed } from "@/features/work/shuffle";

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

describe("nextOrder (spatial continuity)", () => {
  const canonical = orderForSeed(IDS, 7);

  it("keeps survivors in their relative order when the set narrows", () => {
    const previous = shuffleWithSeed(IDS, 3);
    const visible = IDS.filter((_, i) => i % 3 === 0);
    const next = nextOrder(previous, visible, canonical);
    expect(next).toEqual(previous.filter((id) => visible.includes(id)));
  });

  it("keeps survivors first and appends newcomers when the set expands", () => {
    const previous = shuffleWithSeed(IDS.slice(0, 10), 3);
    const next = nextOrder(previous, IDS, canonical);
    expect(next.slice(0, previous.length)).toEqual(previous);
    expect([...next].sort()).toEqual([...IDS].sort());
  });

  it("orders newcomers deterministically by the canonical order", () => {
    const previous = shuffleWithSeed(IDS.slice(0, 10), 3);
    const a = nextOrder(previous, IDS, canonical);
    const b = nextOrder(previous, IDS, canonical);
    expect(a).toEqual(b);
    const newcomers = a.slice(previous.length);
    const sorted = [...newcomers].sort((x, y) => (canonical.get(x) ?? 0) - (canonical.get(y) ?? 0));
    expect(newcomers).toEqual(sorted);
  });

  it("returns the same array reference when the visible set is unchanged", () => {
    const previous = shuffleWithSeed(IDS, 5);
    const next = nextOrder(previous, [...previous].reverse(), canonical);
    expect(next).toBe(previous);
  });

  it("is stable across a narrow-then-restore round trip", () => {
    const initial = shuffleWithSeed(IDS, 11);
    const narrowed = nextOrder(initial, IDS.slice(0, 12), canonical);
    const restored = nextOrder(narrowed, IDS, canonical);
    // The 12 survivors keep their exact narrowed positions at the head.
    expect(restored.slice(0, narrowed.length)).toEqual(narrowed);
  });
});
