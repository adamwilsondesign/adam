/**
 * The normalized content model shared by every view in the site.
 *
 * This is the boundary between content sources (Sanity Content Lake or the
 * local fixture adapter) and the interface. Interactive components — the Work
 * grid, filtering, overlays — only ever see these serializable shapes and
 * never CMS-specific documents, references, or asset objects.
 *
 * Raw Sanity query results are converted into this model by
 * `src/lib/content/normalize.ts`.
 */

import type { PortableTextBlock } from "next-sanity";

export const WORK_TAGS = [
  "AI",
  "AR",
  "Crypto",
  "R&D",
  "Hardware",
  "Enterprise",
  "Startup",
  "Consumer",
] as const;

export type WorkTag = (typeof WORK_TAGS)[number];

export function isWorkTag(value: unknown): value is WorkTag {
  return typeof value === "string" && (WORK_TAGS as readonly string[]).includes(value);
}

export type YearRange = {
  start: number;
  end: number;
};

export type Engagement = {
  startYear: number;
  endYear: number;
  tags: WorkTag[];
  description?: string | null;
};

export type MediaAspect = "square" | "16:9";

export type WorkMedia = {
  /** Absolute or root-relative URL of the full-size asset. */
  url: string;
  /** Intrinsic pixel dimensions, used to prevent layout shift. */
  width: number;
  height: number;
  /** The intended display ratio; boxes are laid out from this, not the pixels. */
  aspect: MediaAspect;
  alt: string;
  caption?: string | null;
  /** Low-quality placeholder (data URI) when the source provides one. */
  lqip?: string | null;
};

/** The lightweight case-study data shipped with the Work grid payload. */
export type CaseStudySummary = {
  slug: string;
  title: string;
  /** Hero URL sized for the masked hover treatment; preloaded when visible. */
  heroUrl: string;
};

export type WorkClient = {
  /** Stable identity (Sanity `_id` or fixture id). */
  id: string;
  name: string;
  slug: string;
  /** URL of the monochrome SVG logo, used directly and as a CSS alpha mask. */
  logoUrl: string;
  /** One-sentence informational description shown in tooltips and cards. */
  description: string;
  engagements: Engagement[];
  caseStudy: CaseStudySummary | null;
};

export type CaseStudy = {
  slug: string;
  clientId: string;
  clientName: string;
  logoUrl: string;
  title: string;
  subtitle: string | null;
  /** Preformatted date or date-range label (override or derived). */
  displayDate: string;
  tags: WorkTag[];
  summary: string;
  body: PortableTextBlock[] | null;
  externalUrl: string | null;
  hero: WorkMedia;
  gallery: WorkMedia[];
  seo: {
    title: string;
    description: string;
    ogImageUrl: string | null;
  };
};

export type SiteSettings = {
  title: string;
  description: string;
  /** Personal SVG logo URL; the built-in wordmark renders when absent. */
  logoUrl: string | null;
  /** `mailto:` address or external contact URL. */
  contactUrl: string | null;
  workStartYear: number;
  workEndYear: number;
  seo: {
    title: string;
    description: string;
    ogImageUrl: string | null;
  };
};

/** Derived, display-oriented helpers shared by tooltips, cards and overlays. */

export function clientYearSpan(client: Pick<WorkClient, "engagements">): YearRange | null {
  if (client.engagements.length === 0) return null;
  let start = Number.POSITIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;
  for (const engagement of client.engagements) {
    start = Math.min(start, engagement.startYear);
    end = Math.max(end, engagement.endYear);
  }
  return { start, end };
}

export function clientTags(client: Pick<WorkClient, "engagements">): WorkTag[] {
  const seen = new Set<WorkTag>();
  for (const engagement of client.engagements) {
    for (const tag of engagement.tags) seen.add(tag);
  }
  return WORK_TAGS.filter((tag) => seen.has(tag));
}

export function formatYearRange(range: YearRange | null): string {
  if (!range) return "";
  return range.start === range.end ? `${range.start}` : `${range.start}–${range.end}`;
}
