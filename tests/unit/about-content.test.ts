import { describe, expect, it } from "vitest";

import { ABOUT_PAGE_DEFAULTS, HOME_PAGE_DEFAULTS } from "@/lib/content/about-defaults";
import { normalizeAboutPage, normalizeHomePage } from "@/lib/content/normalize";
import type { ABOUT_PAGE_QUERY_RESULT } from "@/sanity/types.generated";

describe("normalizeHomePage", () => {
  it("falls back to the local defaults when the document is missing", () => {
    const page = normalizeHomePage(null);
    expect(page.intro).toBe(HOME_PAGE_DEFAULTS.intro);
    expect(page.seo).toEqual({ title: null, description: null });
  });

  it("passes through edited copy and metadata overrides", () => {
    const page = normalizeHomePage({
      intro: "Hello.",
      seoTitle: "Custom title",
      seoDescription: "Custom description",
    } as never);
    expect(page.intro).toBe("Hello.");
    expect(page.seo).toEqual({ title: "Custom title", description: "Custom description" });
  });
});

describe("normalizeAboutPage", () => {
  it("returns the full defaults when the document is missing", () => {
    expect(normalizeAboutPage(null)).toEqual(ABOUT_PAGE_DEFAULTS);
  });

  it("keeps edited fields and fills gaps field-by-field", () => {
    const page = normalizeAboutPage({
      intro: "Edited intro.",
      facts: null,
      careerStatement: null,
      experienceLabel: null,
      experience: [{ year: "2020", title: "Designer", employer: "Studio" }],
      principlesLabel: null,
      principles: null,
      moviesLabel: "Films",
      movies: null,
      booksLabel: null,
      books: null,
      contactHeading: null,
      contactBody: null,
      contactCtaLabel: null,
      seoTitle: null,
      seoDescription: null,
    } as unknown as ABOUT_PAGE_QUERY_RESULT);
    expect(page.intro).toBe("Edited intro.");
    expect(page.facts).toEqual(ABOUT_PAGE_DEFAULTS.facts);
    expect(page.careerStatement).toBe(ABOUT_PAGE_DEFAULTS.careerStatement);
    expect(page.experience).toEqual([{ year: "2020", title: "Designer", employer: "Studio" }]);
    expect(page.principles).toEqual(ABOUT_PAGE_DEFAULTS.principles);
    expect(page.moviesLabel).toBe("Films");
    expect(page.movies).toEqual(ABOUT_PAGE_DEFAULTS.movies);
    expect(page.seo).toEqual(ABOUT_PAGE_DEFAULTS.seo);
  });

  it("drops incomplete rows and falls back when a section empties out", () => {
    const page = normalizeAboutPage({
      experience: [
        { year: "2020", title: null, employer: "Studio" },
        { year: null, title: "Designer", employer: "Studio" },
      ],
      principles: [{ title: "Only a title", body: null }],
      facts: [{ label: "Location", value: "Toronto" }],
    } as unknown as ABOUT_PAGE_QUERY_RESULT);
    expect(page.experience).toEqual(ABOUT_PAGE_DEFAULTS.experience);
    expect(page.principles).toEqual(ABOUT_PAGE_DEFAULTS.principles);
    expect(page.facts).toEqual([{ label: "Location", value: "Toronto" }]);
  });

  it("reuses the local placeholder cover when a matching title has no upload", () => {
    const page = normalizeAboutPage({
      movies: [
        { title: "The Matrix", year: 1999, cover: null, alt: null },
        { title: "Unknown Film Without Art", year: 2001, cover: null, alt: "x" },
      ],
    } as unknown as ABOUT_PAGE_QUERY_RESULT);
    expect(page.movies).toHaveLength(1);
    expect(page.movies[0]).toMatchObject({
      title: "The Matrix",
      coverUrl: "/placeholders/covers/movies/the-matrix.svg",
    });
    // alt falls back to the matched default's alt text.
    expect(page.movies[0]!.alt.length).toBeGreaterThan(0);
  });

  it("falls back to the default shelves when every row is unusable", () => {
    const page = normalizeAboutPage({
      books: [{ title: "No Art Anywhere", author: null, cover: null, alt: null }],
    } as unknown as ABOUT_PAGE_QUERY_RESULT);
    expect(page.books).toEqual(ABOUT_PAGE_DEFAULTS.books);
  });
});
