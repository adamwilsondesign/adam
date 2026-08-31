import { describe, expect, it } from "vitest";

import { resolveSiblings, type CaseSibling } from "@/features/case-study/case-siblings";

const sibling = (slug: string, clientId: string): CaseSibling => ({
  slug,
  title: slug.toUpperCase(),
  clientId,
  clientName: slug,
  logoUrl: `/logos/${slug}.svg`,
  logoAspect: 1,
});

const ALL = [
  sibling("alpha", "c1"),
  sibling("beta", "c2"),
  sibling("gamma", "c3"),
  sibling("delta", "c4"),
];

describe("resolveSiblings", () => {
  it("walks the full list in order with wrap-around", () => {
    const middle = resolveSiblings(ALL, null, "beta");
    expect(middle.prev?.slug).toBe("alpha");
    expect(middle.next?.slug).toBe("gamma");

    const first = resolveSiblings(ALL, null, "alpha");
    expect(first.prev?.slug).toBe("delta");
    expect(first.next?.slug).toBe("beta");

    const last = resolveSiblings(ALL, null, "delta");
    expect(last.next?.slug).toBe("alpha");
  });

  it("adopts the filtered composition order when the current study is in it", () => {
    // Visible order: gamma's client first, then alpha's — beta filtered out.
    const order = ["c3", "x-info-client", "c1"];
    const pair = resolveSiblings(ALL, order, "gamma");
    expect(pair.next?.slug).toBe("alpha");
    expect(pair.prev?.slug).toBe("alpha"); // two items wrap onto each other
  });

  it("falls back to the full list when the current study is filtered out", () => {
    const order = ["c3", "c1"]; // beta not visible
    const pair = resolveSiblings(ALL, order, "beta");
    expect(pair.prev?.slug).toBe("alpha");
    expect(pair.next?.slug).toBe("gamma");
  });

  it("returns nulls for a single (or unknown) study", () => {
    expect(resolveSiblings([sibling("only", "c1")], null, "only")).toEqual({
      prev: null,
      next: null,
    });
    expect(resolveSiblings(ALL, null, "missing")).toEqual({ prev: null, next: null });
    // A filter narrowing to one case study also disables progression.
    expect(resolveSiblings(ALL, ["c2"], "beta")).toEqual({ prev: null, next: null });
  });
});
