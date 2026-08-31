import { describe, expect, it } from "vitest";

import type { CaseStudy, SiteSettings, WorkClient, WorkMedia } from "@/lib/content/model";
import {
  isPlaceholderContactUrl,
  isPlaceholderExternalUrl,
  sanitizeContactUrl,
  sanitizeExternalUrl,
} from "@/lib/content/placeholder-guard";
import { validateContent, type ContentIssue } from "@/lib/content/validate";

function media(overrides: Partial<WorkMedia> = {}): WorkMedia {
  return {
    kind: "image",
    url: "/img.webp",
    width: 1920,
    height: 1080,
    aspect: "16:9",
    alt: "A described image",
    caption: null,
    lqip: null,
    ...overrides,
  };
}

function client(id: string, overrides: Partial<WorkClient> = {}): WorkClient {
  return {
    id,
    name: id,
    slug: id,
    logoUrl: `/logos/${id}.svg`,
    logoAspect: 1,
    logoTreatment: null,
    description: "Does a thing.",
    engagements: [{ startYear: 2015, endYear: 2018, tags: ["AI"] }],
    caseStudy: null,
    ...overrides,
  };
}

function study(slug: string, overrides: Partial<CaseStudy> = {}): CaseStudy {
  return {
    slug,
    clientId: `client-${slug}`,
    clientName: slug,
    logoUrl: `/logos/${slug}.svg`,
    title: "Title",
    subtitle: null,
    displayDate: "2015–2018",
    tags: ["AI"],
    summary: "Summary.",
    body: null,
    externalUrl: null,
    hero: media(),
    gallery: [media()],
    seo: { title: "t", description: "d", ogImageUrl: null },
    ...overrides,
  };
}

function settings(overrides: Partial<SiteSettings> = {}): SiteSettings {
  return {
    title: "Portfolio",
    description: "Intro.",
    logoUrl: null,
    contactUrl: null,
    linkedinUrl: null,
    navigation: [{ label: "Work", href: "/work", available: true }],
    workStartYear: 2010,
    workEndYear: 2026,
    seo: { title: "t", description: "d", ogImageUrl: null, faviconUrl: null },
    ...overrides,
  };
}

const errorsOf = (issues: ContentIssue[]) => issues.filter((issue) => issue.level === "error");

describe("validateContent — structural checks (both modes)", () => {
  it("passes a healthy bundle", () => {
    const issues = validateContent(
      { settings: settings(), clients: [client("a"), client("b")], caseStudies: [study("s")] },
      "placeholder",
    );
    expect(errorsOf(issues)).toEqual([]);
  });

  it("flags duplicate client slugs and ids", () => {
    const issues = validateContent(
      {
        settings: settings(),
        clients: [client("a"), client("a")],
        caseStudies: [],
      },
      "placeholder",
    );
    expect(issues.map((issue) => issue.code)).toContain("duplicate-client-slug");
    expect(issues.map((issue) => issue.code)).toContain("duplicate-client-id");
  });

  it("flags duplicate case-study slugs", () => {
    const issues = validateContent(
      { settings: settings(), clients: [client("a")], caseStudies: [study("s"), study("s")] },
      "placeholder",
    );
    expect(issues.map((issue) => issue.code)).toContain("duplicate-case-slug");
  });

  it("flags inverted engagement ranges as errors", () => {
    const bad = client("a", { engagements: [{ startYear: 2020, endYear: 2018, tags: ["AI"] }] });
    const issues = validateContent(
      { settings: settings(), clients: [bad], caseStudies: [] },
      "placeholder",
    );
    expect(errorsOf(issues).map((issue) => issue.code)).toContain("invalid-engagement-range");
  });

  it("warns about engagements outside the slider bounds", () => {
    const out = client("a", { engagements: [{ startYear: 1990, endYear: 1995, tags: ["AI"] }] });
    const issues = validateContent(
      { settings: settings(), clients: [out], caseStudies: [] },
      "placeholder",
    );
    expect(issues.map((issue) => issue.code)).toContain("engagement-out-of-bounds");
  });

  it("flags missing descriptions and empty engagement lists", () => {
    const bare = client("a", { description: "", engagements: [] });
    const issues = validateContent(
      { settings: settings(), clients: [bare], caseStudies: [] },
      "placeholder",
    );
    expect(errorsOf(issues).map((issue) => issue.code)).toContain("missing-required");
  });
});

describe("validateContent — placeholder vs production modes", () => {
  const leaky = {
    settings: settings({ contactUrl: "mailto:hello@example.com" }),
    clients: [client("a")],
    caseStudies: [
      study("s", {
        externalUrl: "https://example.com/s",
        hero: media({ alt: "" }),
      }),
    ],
  };

  it("reports placeholder leakage as warnings in placeholder mode", () => {
    const issues = validateContent(leaky, "placeholder");
    const codes = issues.map((issue) => `${issue.level}:${issue.code}`);
    expect(codes).toContain("warning:placeholder-contact");
    expect(codes).toContain("warning:placeholder-external-url");
    expect(codes).toContain("warning:missing-alt-text");
    expect(errorsOf(issues)).toEqual([]);
  });

  it("escalates the same leakage to errors in production mode", () => {
    const issues = validateContent(leaky, "production");
    const codes = errorsOf(issues).map((issue) => issue.code);
    expect(codes).toContain("placeholder-contact");
    expect(codes).toContain("placeholder-external-url");
    expect(codes).toContain("missing-alt-text");
  });
});

describe("placeholder-guard sanitizers", () => {
  it("detects example-domain URLs, with subdomain www", () => {
    expect(isPlaceholderExternalUrl("https://example.com/x")).toBe(true);
    expect(isPlaceholderExternalUrl("https://www.example.org/")).toBe(true);
    expect(isPlaceholderExternalUrl("https://real-client.com/case")).toBe(false);
    expect(isPlaceholderExternalUrl(null)).toBe(false);
  });

  it("detects placeholder contact addresses", () => {
    expect(isPlaceholderContactUrl("mailto:hello@example.com")).toBe(true);
    expect(isPlaceholderContactUrl("mailto:me@realdomain.co")).toBe(false);
    expect(isPlaceholderContactUrl("https://example.com/contact")).toBe(true);
  });

  it("nulls placeholders and passes real values through", () => {
    expect(sanitizeExternalUrl("https://example.com/x")).toBeNull();
    expect(sanitizeExternalUrl("https://client.com/x")).toBe("https://client.com/x");
    expect(sanitizeContactUrl("mailto:hello@example.com")).toBeNull();
    expect(sanitizeContactUrl("mailto:adam@studio.example.dev")).toBe(
      "mailto:adam@studio.example.dev",
    );
    expect(sanitizeContactUrl(null)).toBeNull();
  });
});
