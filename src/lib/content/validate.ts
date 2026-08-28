/**
 * Development-time content validation.
 *
 * Runs once per server process at the content facade (src/lib/content/index.ts)
 * and reports structural problems (duplicate slugs, invalid date ranges,
 * missing required copy, missing alt text) as well as placeholder leakage
 * (example.com URLs, placeholder contact addresses).
 *
 * Two modes, tied to the content source:
 *   - "placeholder": fixtures serve the site intentionally. Structural
 *     problems are reported as errors, placeholder leakage as warnings —
 *     the build never fails for content that is documented as placeholder.
 *   - "production": Sanity is the source (or NEXT_PUBLIC_CONTENT_VALIDATION
 *     is set to "production"). Placeholder leakage becomes an error, and
 *     errors fail the production build with an actionable message.
 *
 * Rendering is additionally protected by placeholder-guard.ts sanitizers, so
 * placeholder URLs can never appear in the interface in either mode.
 */

import type { CaseStudy, SiteSettings, WorkClient } from "./model";
import { isPlaceholderContactUrl, isPlaceholderExternalUrl } from "./placeholder-guard";

export type ValidationMode = "placeholder" | "production";

export type ContentIssue = {
  level: "error" | "warning";
  /** Machine-readable category, useful for tests. */
  code:
    | "duplicate-client-id"
    | "duplicate-client-slug"
    | "duplicate-case-slug"
    | "invalid-engagement-range"
    | "engagement-out-of-bounds"
    | "missing-required"
    | "missing-alt-text"
    | "placeholder-contact"
    | "placeholder-external-url";
  message: string;
};

type ContentBundle = {
  settings: SiteSettings;
  clients: WorkClient[];
  caseStudies: CaseStudy[];
};

export function validateContent(bundle: ContentBundle, mode: ValidationMode): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const { settings, clients, caseStudies } = bundle;
  const leakLevel = mode === "production" ? "error" : "warning";

  const ids = new Set<string>();
  const slugs = new Set<string>();
  for (const client of clients) {
    if (ids.has(client.id)) {
      issues.push({
        level: "error",
        code: "duplicate-client-id",
        message: `Duplicate client id "${client.id}".`,
      });
    }
    ids.add(client.id);
    if (slugs.has(client.slug)) {
      issues.push({
        level: "error",
        code: "duplicate-client-slug",
        message: `Duplicate client slug "${client.slug}".`,
      });
    }
    slugs.add(client.slug);

    if (!client.name || !client.logoUrl) {
      issues.push({
        level: "error",
        code: "missing-required",
        message: `Client "${client.slug || client.id}" is missing a name or logo.`,
      });
    }
    if (!client.description) {
      issues.push({
        level: "error",
        code: "missing-required",
        message: `Client "${client.name}" has no informational description.`,
      });
    }
    if (client.engagements.length === 0) {
      issues.push({
        level: "error",
        code: "missing-required",
        message: `Client "${client.name}" has no engagements; it can never match a filter.`,
      });
    }
    for (const engagement of client.engagements) {
      if (engagement.endYear < engagement.startYear) {
        issues.push({
          level: "error",
          code: "invalid-engagement-range",
          message: `Client "${client.name}" has an engagement ending (${engagement.endYear}) before it starts (${engagement.startYear}).`,
        });
      }
      if (
        engagement.startYear > settings.workEndYear ||
        engagement.endYear < settings.workStartYear
      ) {
        issues.push({
          level: "warning",
          code: "engagement-out-of-bounds",
          message: `Client "${client.name}" has an engagement (${engagement.startYear}–${engagement.endYear}) entirely outside the slider bounds ${settings.workStartYear}–${settings.workEndYear}; it will never be reachable.`,
        });
      }
    }
  }

  const caseSlugs = new Set<string>();
  for (const study of caseStudies) {
    if (caseSlugs.has(study.slug)) {
      issues.push({
        level: "error",
        code: "duplicate-case-slug",
        message: `Duplicate case-study slug "${study.slug}".`,
      });
    }
    caseSlugs.add(study.slug);

    if (!study.title || !study.summary) {
      issues.push({
        level: "error",
        code: "missing-required",
        message: `Case study "${study.slug}" is missing a title or summary.`,
      });
    }
    if (!study.hero.alt) {
      issues.push({
        level: leakLevel,
        code: "missing-alt-text",
        message: `Case study "${study.slug}" hero image has no alt text.`,
      });
    }
    study.gallery.forEach((media, index) => {
      if (!media.alt) {
        issues.push({
          level: leakLevel,
          code: "missing-alt-text",
          message: `Case study "${study.slug}" gallery item ${index + 1} has no alt text.`,
        });
      }
    });
    if (isPlaceholderExternalUrl(study.externalUrl)) {
      issues.push({
        level: leakLevel,
        code: "placeholder-external-url",
        message: `Case study "${study.slug}" links to a placeholder URL (${study.externalUrl}); the CTA is omitted until a real project URL is set.`,
      });
    }
  }

  if (isPlaceholderContactUrl(settings.contactUrl)) {
    issues.push({
      level: leakLevel,
      code: "placeholder-contact",
      message: `Site settings contact ("${settings.contactUrl}") is a placeholder; the Contact control is hidden until a real address is configured (Sanity site settings, or NEXT_PUBLIC_CONTACT_URL on fixtures).`,
    });
  } else if (!settings.contactUrl && mode === "production") {
    issues.push({
      level: "warning",
      code: "placeholder-contact",
      message:
        "No contact address is configured; the Contact control is hidden. Set it in Sanity site settings.",
    });
  }

  return issues;
}

/** Formats issues for one readable console report. */
export function formatIssues(issues: ContentIssue[]): string {
  return issues.map((issue) => `  [${issue.level}] ${issue.message}`).join("\n");
}
