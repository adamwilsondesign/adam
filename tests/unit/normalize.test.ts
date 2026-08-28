import { describe, expect, it } from "vitest";

import {
  normalizeCaseStudy,
  normalizeSiteSettings,
  normalizeWorkIndex,
} from "@/lib/content/normalize";
import type {
  CASE_STUDY_QUERY_RESULT,
  SITE_SETTINGS_QUERY_RESULT,
  WORK_INDEX_QUERY_RESULT,
} from "@/sanity/types.generated";

const imageRef = (name: string, w = 1920, h = 1080) =>
  ({
    _type: "image" as const,
    asset: { _ref: `image-${name}-${w}x${h}-webp`, _type: "reference" as const },
  }) as never;

function rawClient(overrides: Partial<WORK_INDEX_QUERY_RESULT[number]> = {}) {
  return {
    id: "client-1",
    name: "Auralith",
    slug: "auralith",
    logoUrl: "https://cdn.sanity.io/files/p/d/logo.svg",
    description: "One sentence.",
    engagements: [{ startYear: 2015, endYear: 2018, tags: ["AI", "AR"], description: null }],
    caseStudy: null,
    ...overrides,
  } as WORK_INDEX_QUERY_RESULT[number];
}

describe("normalizeWorkIndex", () => {
  it("maps a valid client", () => {
    const [client] = normalizeWorkIndex([rawClient()]);
    expect(client).toMatchObject({
      id: "client-1",
      name: "Auralith",
      slug: "auralith",
      engagements: [{ startYear: 2015, endYear: 2018, tags: ["AI", "AR"] }],
      caseStudy: null,
    });
  });

  it("drops clients without a logo, slug, or valid engagements", () => {
    expect(normalizeWorkIndex([rawClient({ logoUrl: null })])).toHaveLength(0);
    expect(normalizeWorkIndex([rawClient({ slug: null })])).toHaveLength(0);
    expect(normalizeWorkIndex([rawClient({ engagements: [] })])).toHaveLength(0);
  });

  it("drops unknown tags and engagements that end before they start", () => {
    const [client] = normalizeWorkIndex([
      rawClient({
        engagements: [
          { startYear: 2015, endYear: 2018, tags: ["AI", "Blockchain"], description: null },
          { startYear: 2020, endYear: 2018, tags: ["AI"], description: null },
          { startYear: 2021, endYear: 2022, tags: ["NotATag"], description: null },
        ],
      }),
    ]);
    expect(client?.engagements).toEqual([
      { startYear: 2015, endYear: 2018, tags: ["AI"], description: null },
    ]);
  });

  it("builds a case-study summary only when slug, title and hero exist", () => {
    const withStudy = normalizeWorkIndex([
      rawClient({
        caseStudy: { slug: "auralith", title: "Field Console", heroImage: imageRef("hero") },
      }),
    ]);
    expect(withStudy[0]?.caseStudy?.slug).toBe("auralith");
    expect(withStudy[0]?.caseStudy?.heroUrl).toContain("cdn.sanity.io");

    const noHero = normalizeWorkIndex([
      rawClient({ caseStudy: { slug: "auralith", title: "Field Console", heroImage: null } }),
    ]);
    expect(noHero[0]?.caseStudy).toBeNull();
  });
});

function rawCaseStudy(
  overrides: Partial<NonNullable<NonNullable<CASE_STUDY_QUERY_RESULT>["caseStudy"]>> = {},
): CASE_STUDY_QUERY_RESULT {
  return {
    clientId: "client-1",
    clientName: "Auralith",
    logoUrl: "https://cdn.sanity.io/files/p/d/logo.svg",
    engagements: [
      { startYear: 2017, endYear: 2018, tags: ["Hardware"] },
      { startYear: 2020, endYear: 2022, tags: ["AI"] },
    ],
    caseStudy: {
      slug: "auralith",
      title: "Field Console",
      subtitle: "Sub",
      displayDate: null,
      shortDescription: "Short summary.",
      body: null,
      externalUrl: "https://example.com/x",
      heroImage: { ...(imageRef("hero") as object), dimensions: null, lqip: null, alt: "Hero" },
      gallery: [
        {
          _key: "a",
          image: { ...(imageRef("g1", 1440, 1440) as object), dimensions: null, lqip: null },
          alt: "Square",
          caption: null,
          aspect: "square",
        },
        {
          _key: "b",
          image: { ...(imageRef("g2") as object), dimensions: null, lqip: null },
          alt: "Wide",
          caption: "Caption",
          aspect: null, // invalid: dropped
        },
      ],
      seoTitle: null,
      seoDescription: null,
      ogImage: null,
      ...overrides,
    },
  } as CASE_STUDY_QUERY_RESULT;
}

describe("normalizeCaseStudy", () => {
  it("maps the full study with derived values", () => {
    const study = normalizeCaseStudy(rawCaseStudy());
    expect(study).not.toBeNull();
    expect(study?.displayDate).toBe("2017–2022");
    // Canonical tag order: AI before Hardware.
    expect(study?.tags).toEqual(["AI", "Hardware"]);
    expect(study?.seo.title).toBe("Field Console — Auralith");
    expect(study?.seo.description).toBe("Short summary.");
    expect(study?.seo.ogImageUrl).toContain("cdn.sanity.io");
    expect(study?.gallery).toHaveLength(1);
    expect(study?.gallery[0]?.aspect).toBe("square");
  });

  it("prefers explicit display date and SEO fields", () => {
    const study = normalizeCaseStudy(
      rawCaseStudy({ displayDate: "Winter 2021", seoTitle: "Custom", seoDescription: "Desc" }),
    );
    expect(study?.displayDate).toBe("Winter 2021");
    expect(study?.seo.title).toBe("Custom");
    expect(study?.seo.description).toBe("Desc");
  });

  it("returns null for missing or incomplete studies", () => {
    expect(normalizeCaseStudy(null)).toBeNull();
    expect(normalizeCaseStudy(rawCaseStudy({ slug: null }))).toBeNull();
    expect(normalizeCaseStudy(rawCaseStudy({ heroImage: null }))).toBeNull();
  });
});

describe("normalizeSiteSettings", () => {
  it("supplies defaults when settings are missing", () => {
    const settings = normalizeSiteSettings(null as SITE_SETTINGS_QUERY_RESULT);
    expect(settings.workStartYear).toBe(2010);
    expect(settings.workEndYear).toBe(2026);
    expect(settings.title).toBe("Portfolio");
  });

  it("normalizes an inverted year range", () => {
    const settings = normalizeSiteSettings({
      title: "T",
      description: "D",
      logoUrl: null,
      contactUrl: null,
      linkedinUrl: null,
      navigation: null,
      workStartYear: 2030,
      workEndYear: 2012,
      seoTitle: null,
      seoDescription: null,
      defaultOgImage: null,
    });
    expect(settings.workStartYear).toBe(2012);
    expect(settings.workEndYear).toBe(2030);
  });
});
