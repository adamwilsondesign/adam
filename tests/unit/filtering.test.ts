import { describe, expect, it } from "vitest";

import { WORK_TAGS, type WorkClient } from "@/lib/content/model";
import {
  clampYearRange,
  clientMatches,
  defaultFilter,
  engagementMatches,
  filterClients,
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
    description: "",
    engagements,
    caseStudy: null,
  };
}

const filterWith = (overrides: Partial<WorkFilter>): WorkFilter => ({
  ...defaultFilter(BOUNDS),
  ...overrides,
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

  it("uses inclusive OR across active tags", () => {
    const multi = { startYear: 2015, endYear: 2018, tags: ["AI" as const, "Crypto" as const] };
    expect(engagementMatches(multi, filterWith({ tags: ["Crypto"] }))).toBe(true);
    expect(engagementMatches(multi, filterWith({ tags: ["Hardware"] }))).toBe(false);
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

  it("removes and restores tags preserving canonical order", () => {
    const filter = defaultFilter(BOUNDS);
    const removed = toggleTag(clients, filter, "Crypto");
    expect(removed.rejected).toBe(false);
    expect(removed.filter.tags).not.toContain("Crypto");

    const restored = toggleTag(clients, removed.filter, "Crypto");
    expect(restored.filter.tags).toEqual([...WORK_TAGS]);
  });

  it("rejects a toggle that would produce zero results", () => {
    const filter = filterWith({ tags: ["AI"], years: { start: 2012, end: 2014 } });
    const result = toggleTag(clients, filter, "AI");
    expect(result.rejected).toBe(true);
    expect(result.filter).toEqual(filter);
  });

  it("rejects toggles when the year range excludes the added tag's engagements", () => {
    const filter = filterWith({ tags: ["AI"], years: { start: 2012, end: 2014 } });
    // Activating Crypto is fine (OR logic) but removing AI afterwards would zero out.
    const withCrypto = toggleTag(clients, filter, "Crypto");
    expect(withCrypto.rejected).toBe(false);
    const withoutAI = toggleTag(clients, withCrypto.filter, "AI");
    expect(withoutAI.rejected).toBe(true);
  });

  it("never leaves zero active tags", () => {
    const filter = filterWith({ tags: ["AI"] });
    const result = toggleTag(clients, filter, "AI");
    expect(result.rejected).toBe(true);
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
});
