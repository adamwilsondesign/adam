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

export type LogoAlignment = "center" | "start" | "end";

/**
 * Optional per-client optical overrides for the grid presentation. Automatic
 * defaults derived from the logo's intrinsic aspect ratio are correct for
 * most marks; these exist for the exceptions (an unusually dense symbol, a
 * wordmark with heavy descenders). Sanity mapping: `client.logoTreatment.*`.
 */
export type LogoTreatment = {
  /** Multiplier on the automatic optical size (0.5–1.5; 1 = automatic). */
  scale?: number | null;
  /** Extra breathing room inside the cell as a fraction of it (0–0.2). */
  padding?: number | null;
  alignment?: LogoAlignment | null;
  /** Theme-specific asset overrides. The default `logoUrl` is rendered as a
   *  currentColor alpha mask, so it already adapts to both themes; these are
   *  for real-world logos that cannot be masked. */
  lightUrl?: string | null;
  darkUrl?: string | null;
  /** Denser alternate mark used when cells get very small (mobile pinch). */
  compactUrl?: string | null;
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
  /** Intrinsic aspect ratio (width / height) of the logo asset; drives the
   *  automatic optical sizing. Defaults to 1 when a source omits it. */
  logoAspect: number;
  /** Optional optical overrides; most clients leave this null. */
  logoTreatment: LogoTreatment | null;
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

export type NavSection = {
  label: string;
  href: string;
  /** Unavailable sections are hidden entirely (never shown as "soon"). */
  available: boolean;
};

export type SiteSettings = {
  title: string;
  description: string;
  /** Personal SVG logo URL; the built-in wordmark renders when absent. */
  logoUrl: string | null;
  /**
   * `mailto:` address or external contact URL. Null hides the Contact
   * control. Placeholder values (example.com / example addresses) are
   * neutralized to null at the content facade, so a fake address can never
   * ship — set the real one in Sanity site settings, or via
   * NEXT_PUBLIC_CONTACT_URL while running on fixtures.
   */
  contactUrl: string | null;
  /** Public LinkedIn profile URL; null hides the LinkedIn control. */
  linkedinUrl: string | null;
  /** Site sections in display order; unavailable ones stay hidden. */
  navigation: NavSection[];
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
