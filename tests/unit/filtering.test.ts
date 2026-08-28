import { describe, expect, it } from "vitest";

import type { WorkClient } from "@/lib/content/model";
import {
  blockedTags,
  clampYearRange,
  clientMatches,
  defaultFilter,
  engagementMatches,
  filterClients,
  isAllSelected,
  isEmptySelection,
  selectAll,
  toggleAll,
  toggleTag,
  type WorkFilter,
} from "@/features/work/filtering";

const BOUNDS = { start: 2010, end: 2026 };

function client(id: string, engagements: WorkClient["engagements"]): WorkClient {
  return {
    id,
    name: id,
    slug: id,
    logoUrl: `/logos/${id}.svg`,
    logoAspect: 1,
    logoTreatment: null,
    description: "",
    engagements,
    caseStudy: null,
  };
}

const filterWith = (overrides: Partial<WorkFilter>): WorkFilter => ({
  ...defaultFilter(BOUNDS),
  // Overriding tags implies leaving the All state unless said otherwise.
  all: overrides.all ?? !(overrides.tags && overrides.tags.length > 0),
  ...overrides,
});

describe("the All selection", () => {
  it("is the default: no individual tag is selected", () => {
    const filter = defaultFilter(BOUNDS);
    expect(filter.tags).toEqual([]);
    expect(isAllSelected(filter)).toBe(true);
    expect(isEmptySelection(filter)).toBe(false);
  });

  it("matches every tagged engagement in range", () => {
    const engagement = { startYear: 2015, endYear: 2018, tags: ["AI" as const] };
    expect(engagementMatches(engagement, defaultFilter(BOUNDS))).toBe(true);
    expect(engagementMatches(engagement, filterWith({ years: { start: 2019, end: 2026 } }))).toBe(
      false,
    );
  });

  it("is restored by selectAll and never rejected", () => {
    const filter = filterWith({ tags: ["AI", "Crypto"] });
    const restored = selectAll(filter);
    expect(isAllSelected(restored)).toBe(true);
    expect(restored.tags).toEqual([]);
    expect(restored.years).toEqual(filter.years);
  });

  it("toggles off into the deliberate empty selection and back", () => {
    const clients = [client("a", [{ startYear: 2015, endYear: 2018, tags: ["AI"] }])];
    const emptied = toggleAll(defaultFilter(BOUNDS));
    expect(isEmptySelection(emptied)).toBe(true);
    expect(filterClients(clients, emptied)).toEqual([]);

    const restored = toggleAll(emptied);
    expect(isAllSelected(restored)).toBe(true);
    expect(filterClients(clients, restored)).toHaveLength(1);
  });

  it("selecting a tag escapes the empty selection", () => {
    const clients = [client("a", [{ startYear: 2015, endYear: 2018, tags: ["AI"] }])];
    const emptied = toggleAll(defaultFilter(BOUNDS));
    const result = toggleTag(clients, emptied, "AI");
    expect(result.rejected).toBe(false);
    expect(result.filter.tags).toEqual(["AI"]);
    expect(filterClients(clients, result.filter)).toHaveLength(1);
  });

  it("keeps the slider freely adjustable inside the empty selection", () => {
    const clients = [client("a", [{ startYear: 2015, endYear: 2018, tags: ["AI"] }])];
    const emptied = toggleAll(defaultFilter(BOUNDS));
    const moved = clampYearRange(clients, emptied, { start: 2020, end: 2026 }, "start", BOUNDS);
    expect(moved).toEqual({ years: { start: 2020, end: 2026 }, adjusted: false });
  });
});

describe("engagementMatches", () => {
  const engagement = { startYear: 2015, endYear: 2018, tags: ["AI" as const] };

  it("uses inclusive date overlap on both ends", () => {
    expect(engagementMatches(engagement, filterWith({ years: { start: 2018, end: 2026 } }))).toBe(
      true,
    );
    expect(engagementMatches(engagement, filterWith({ years: { start: 2010, end: 2015 } }))).toBe(
      true,
    );
    expect(engagementMatches(engagement, filterWith({ years: { start: 2019, end: 2026 } }))).toBe(
      false,
    );
    expect(engagementMatches(engagement, filterWith({ years: { start: 2010, end: 2014 } }))).toBe(
      false,
    );
  });

  it("uses inclusive OR across selected tags", () => {
    const multi = { startYear: 2015, endYear: 2018, tags: ["AI" as const, "Crypto" as const] };
    expect(engagementMatches(multi, filterWith({ tags: ["Crypto"] }))).toBe(true);
    expect(engagementMatches(multi, filterWith({ tags: ["Hardware"] }))).toBe(false);
    expect(engagementMatches(multi, filterWith({ tags: ["Hardware", "AI"] }))).toBe(true);
  });
});

describe("clientMatches (engagement-aware)", () => {
  it("requires the tag and year range to match the same engagement", () => {
    const split = client("split", [
      { startYear: 2010, endYear: 2012, tags: ["AI"] },
      { startYear: 2020, endYear: 2022, tags: ["Hardware"] },
    ]);
    // AI matches only the early engagement; the selected years cover only the late one.
    expect(
      clientMatches(split, filterWith({ tags: ["AI"], years: { start: 2020, end: 2022 } })),
    ).toBe(false);
    expect(
      clientMatches(split, filterWith({ tags: ["Hardware"], years: { start: 2020, end: 2022 } })),
    ).toBe(true);
    expect(
      clientMatches(split, filterWith({ tags: ["AI"], years: { start: 2010, end: 2012 } })),
    ).toBe(true);
  });
});

describe("toggleTag", () => {
  const clients = [
    client("a", [{ startYear: 2012, endYear: 2014, tags: ["AI"] }]),
    client("b", [{ startYear: 2016, endYear: 2018, tags: ["Crypto"] }]),
  ];

  it("selecting a tag exits All and narrows to it", () => {
    const result = toggleTag(clients, defaultFilter(BOUNDS), "AI");
    expect(result.rejected).toBe(false);
    expect(result.filter.tags).toEqual(["AI"]);
    expect(filterClients(clients, result.filter).map((c) => c.id)).toEqual(["a"]);
  });

  it("selecting additional tags expands the set (inclusive OR)", () => {
    const one = toggleTag(clients, defaultFilter(BOUNDS), "AI");
    const two = toggleTag(clients, one.filter, "Crypto");
    expect(two.rejected).toBe(false);
    expect(two.filter.tags).toEqual(["AI", "Crypto"]);
    expect(filterClients(clients, two.filter)).toHaveLength(2);
  });

  it("preserves canonical tag order regardless of selection order", () => {
    const crypto = toggleTag(clients, defaultFilter(BOUNDS), "Crypto");
    const both = toggleTag(clients, crypto.filter, "AI");
    expect(both.filter.tags).toEqual(["AI", "Crypto"]);
  });

  it("deselecting the last selected tag returns to All", () => {
    const one = toggleTag(clients, defaultFilter(BOUNDS), "AI");
    const back = toggleTag(clients, one.filter, "AI");
    expect(back.rejected).toBe(false);
    expect(isAllSelected(back.filter)).toBe(true);
    expect(filterClients(clients, back.filter)).toHaveLength(2);
  });

  it("rejects selecting a tag with no matches in the selected years", () => {
    const filter = filterWith({ years: { start: 2012, end: 2014 } });
    const result = toggleTag(clients, filter, "Crypto");
    expect(result.rejected).toBe(true);
    expect(result.filter).toEqual(filter);
  });

  it("rejects removing a tag when the remaining selection would be empty", () => {
    // Both tags selected but the years only cover AI's engagement: removing
    // AI would leave Crypto alone with zero matches.
    const filter = filterWith({ tags: ["AI", "Crypto"], years: { start: 2012, end: 2014 } });
    const result = toggleTag(clients, filter, "AI");
    expect(result.rejected).toBe(true);
  });
});

describe("blockedTags", () => {
  const clients = [
    client("a", [{ startYear: 2012, endYear: 2014, tags: ["AI"] }]),
    client("b", [{ startYear: 2016, endYear: 2018, tags: ["Crypto"] }]),
  ];

  it("reports the tags whose toggle would currently empty the grid", () => {
    const filter = filterWith({ years: { start: 2012, end: 2014 } });
    const blocked = blockedTags(clients, filter);
    expect(blocked.has("Crypto")).toBe(true);
    expect(blocked.has("AI")).toBe(false);
  });
});

describe("clampYearRange", () => {
  const clients = [
    client("early", [{ startYear: 2010, endYear: 2012, tags: ["AI"] }]),
    client("late", [{ startYear: 2020, endYear: 2022, tags: ["AI"] }]),
  ];

  it("passes valid movements through", () => {
    const result = clampYearRange(
      clients,
      defaultFilter(BOUNDS),
      { start: 2011, end: 2026 },
      "start",
      BOUNDS,
    );
    expect(result).toEqual({ years: { start: 2011, end: 2026 }, adjusted: false });
  });

  it("returns the start handle to the nearest valid year", () => {
    // start=2023 with end=2026 excludes everyone; nearest valid start is 2022.
    const filter = filterWith({ years: { start: 2010, end: 2026 } });
    const result = clampYearRange(clients, filter, { start: 2023, end: 2026 }, "start", BOUNDS);
    expect(result.adjusted).toBe(true);
    expect(result.years).toEqual({ start: 2022, end: 2026 });
  });

  it("returns the end handle to the nearest valid year", () => {
    const filter = filterWith({ years: { start: 2010, end: 2026 } });
    const result = clampYearRange(clients, filter, { start: 2010, end: 2013 }, "end", BOUNDS);
    // 2013 keeps "early" visible (2010–2012 overlaps 2010–2013) — valid as-is.
    expect(result.adjusted).toBe(false);

    const narrow = clampYearRange(
      clients,
      filterWith({ years: { start: 2015, end: 2026 } }),
      { start: 2015, end: 2016 },
      "end",
      BOUNDS,
    );
    // Nothing exists in 2015–2016; walk the end handle up to 2020.
    expect(narrow.adjusted).toBe(true);
    expect(narrow.years).toEqual({ start: 2015, end: 2020 });
  });

  it("clamps to bounds and keeps handles ordered", () => {
    const filter = defaultFilter(BOUNDS);
    const result = clampYearRange(clients, filter, { start: 1990, end: 2050 }, "end", BOUNDS);
    expect(result.years).toEqual({ start: 2010, end: 2026 });

    const crossed = clampYearRange(clients, filter, { start: 2024, end: 2020 }, "start", BOUNDS);
    expect(crossed.years.start).toBeLessThanOrEqual(crossed.years.end);
  });

  it("never returns a zero-result range", () => {
    const filter = defaultFilter(BOUNDS);
    for (let start = 2010; start <= 2026; start++) {
      const result = clampYearRange(clients, filter, { start, end: 2026 }, "start", BOUNDS);
      expect(filterClients(clients, { ...filter, years: result.years }).length).toBeGreaterThan(0);
    }
  });

  it("respects narrowed tag selections when validating", () => {
    const filter = filterWith({ tags: ["AI"], years: { start: 2010, end: 2026 } });
    const result = clampYearRange(clients, filter, { start: 2013, end: 2019 }, "end", BOUNDS);
    expect(filterClients(clients, { ...filter, years: result.years }).length).toBeGreaterThan(0);
  });
});
