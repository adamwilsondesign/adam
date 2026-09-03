/**
 * Converts raw Sanity query results into the app model (src/lib/content/model.ts).
 *
 * Everything interactive — filtering, the grid, overlays — depends on this
 * boundary: no component ever sees Sanity references, asset objects, or
 * stega-encoded logic fields. Display strings intentionally keep their stega
 * encoding so Visual Editing overlays work; values used in logic (tags,
 * aspects, slugs) are cleaned before comparison.
 */

import { stegaClean } from "next-sanity";

import { urlFor } from "@/sanity/lib/image";
import type {
  ABOUT_PAGE_QUERY_RESULT,
  CASE_STUDY_QUERY_RESULT,
  CASE_STUDY_SLUGS_QUERY_RESULT,
  HOME_PAGE_QUERY_RESULT,
  SITE_SETTINGS_QUERY_RESULT,
  WORK_INDEX_QUERY_RESULT,
} from "@/sanity/types.generated";

import { ABOUT_PAGE_DEFAULTS, HOME_PAGE_DEFAULTS } from "./about-defaults";
import {
  formatYearRange,
  isWorkTag,
  WORK_TAGS,
  type AboutPageContent,
  type CaseStudy,
  type CoverItem,
  type Engagement,
  type HomePageContent,
  type LogoAlignment,
  type LogoTreatment,
  type MediaAspect,
  type NavSection,
  type SiteSettings,
  type WorkClient,
  type WorkMedia,
  type WorkTag,
} from "./model";

export const DEFAULT_WORK_RANGE = { start: 2010, end: 2026 } as const;

const HERO_WIDTH = 1600;
const GALLERY_WIDTH = 2000;

type RawImage = {
  asset?: { _ref: string } | null;
  [key: string]: unknown;
};

function imageUrl(image: RawImage | null | undefined, width: number): string | null {
  if (!image?.asset?._ref) return null;
  try {
    return urlFor(image).width(width).fit("max").url();
  } catch {
    return null;
  }
}

function normalizeTags(tags: readonly (string | null)[] | null | undefined): WorkTag[] {
  const cleaned = (tags ?? []).map((tag) => stegaClean(tag));
  return cleaned.filter(isWorkTag);
}

type RawEngagement = {
  startYear: number | null;
  endYear: number | null;
  tags: Array<string> | null;
  description?: string | null;
};

function normalizeEngagements(raw: RawEngagement[] | null): Engagement[] {
  const engagements: Engagement[] = [];
  for (const item of raw ?? []) {
    if (typeof item.startYear !== "number" || typeof item.endYear !== "number") continue;
    if (item.endYear < item.startYear) continue;
    const tags = normalizeTags(item.tags);
    if (tags.length === 0) continue;
    engagements.push({
      startYear: item.startYear,
      endYear: item.endYear,
      tags,
      description: item.description ?? null,
    });
  }
  return engagements;
}

type RawLogoTreatment = {
  scale?: number | null;
  padding?: number | null;
  alignment?: string | null;
  lightUrl?: string | null;
  darkUrl?: string | null;
  compactUrl?: string | null;
} | null;

function normalizeLogoTreatment(raw: RawLogoTreatment): LogoTreatment | null {
  if (!raw) return null;
  const alignment = stegaClean(raw.alignment) as LogoAlignment | null;
  const treatment: LogoTreatment = {
    scale: raw.scale ?? null,
    padding: raw.padding ?? null,
    alignment:
      alignment === "start" || alignment === "end" || alignment === "center" ? alignment : null,
    lightUrl: raw.lightUrl ?? null,
    darkUrl: raw.darkUrl ?? null,
    compactUrl: raw.compactUrl ?? null,
  };
  const meaningful = Object.values(treatment).some((value) => value !== null);
  return meaningful ? treatment : null;
}

export function normalizeWorkIndex(raw: WORK_INDEX_QUERY_RESULT): WorkClient[] {
  const clients: WorkClient[] = [];
  for (const item of raw) {
    const slug = stegaClean(item.slug);
    const engagements = normalizeEngagements(item.engagements);
    if (!item.name || !slug || !item.logoUrl || engagements.length === 0) continue;

    const caseStudySlug = stegaClean(item.caseStudy?.slug ?? null);
    const heroUrl = imageUrl(item.caseStudy?.heroImage, HERO_WIDTH);
    const caseStudy =
      caseStudySlug && item.caseStudy?.title && heroUrl
        ? { slug: caseStudySlug, title: item.caseStudy.title, heroUrl }
        : null;

    clients.push({
      id: item.id,
      name: item.name,
      slug,
      logoUrl: item.logoUrl,
      logoAspect: item.logoAspect ?? 1,
      logoTreatment: normalizeLogoTreatment(item.logoTreatment),
      description: item.description ?? "",
      engagements,
      caseStudy,
    });
  }
  return clients;
}

type RawCaseStudyMedia = NonNullable<
  NonNullable<NonNullable<CASE_STUDY_QUERY_RESULT>["caseStudy"]>["gallery"]
>[number];

function normalizeMedia(item: RawCaseStudyMedia): WorkMedia | null {
  const aspect = stegaClean(item.aspect) as MediaAspect | null;
  if (aspect !== "square" && aspect !== "16:9") return null;
  const fallback =
    aspect === "square" ? { width: 1600, height: 1600 } : { width: 1920, height: 1080 };

  if (stegaClean(item.mediaType) === "video") {
    // Uploaded files win over external URLs when both are set.
    const url = item.videoFileUrl ?? stegaClean(item.videoUrl) ?? null;
    if (!url) return null;
    return {
      kind: "video",
      url,
      width: fallback.width,
      height: fallback.height,
      aspect,
      alt: item.alt ?? "",
      caption: item.caption ?? null,
      lqip: null,
      posterUrl: imageUrl(item.poster, GALLERY_WIDTH),
    };
  }

  const url = imageUrl(item.image, GALLERY_WIDTH);
  if (!url) return null;
  const dimensions = item.image?.dimensions;
  return {
    kind: "image",
    url,
    width: dimensions?.width ?? fallback.width,
    height: dimensions?.height ?? fallback.height,
    aspect,
    alt: item.alt ?? "",
    caption: item.caption ?? null,
    lqip: item.image?.lqip ?? null,
    posterUrl: null,
  };
}

export function normalizeCaseStudy(raw: CASE_STUDY_QUERY_RESULT): CaseStudy | null {
  if (!raw?.caseStudy) return null;
  const study = raw.caseStudy;
  const slug = stegaClean(study.slug);
  const heroUrl = imageUrl(study.heroImage, GALLERY_WIDTH);
  if (!slug || !study.title || !raw.clientName || !raw.logoUrl || !heroUrl) return null;

  const engagements = normalizeEngagements(raw.engagements);
  const seenTags = new Set<WorkTag>();
  for (const engagement of engagements) {
    for (const tag of engagement.tags) seenTags.add(tag);
  }
  const tags = WORK_TAGS.filter((tag) => seenTags.has(tag));

  const heroDimensions = study.heroImage?.dimensions;
  const hero: WorkMedia = {
    kind: "image",
    url: heroUrl,
    width: heroDimensions?.width ?? 1920,
    height: heroDimensions?.height ?? 1080,
    aspect: "16:9",
    alt: study.heroImage?.alt ?? "",
    caption: null,
    lqip: study.heroImage?.lqip ?? null,
  };

  const gallery = (study.gallery ?? [])
    .map(normalizeMedia)
    .filter((media): media is WorkMedia => media !== null);

  const span = engagements.reduce<{ start: number; end: number } | null>(
    (acc, engagement) =>
      acc
        ? {
            start: Math.min(acc.start, engagement.startYear),
            end: Math.max(acc.end, engagement.endYear),
          }
        : { start: engagement.startYear, end: engagement.endYear },
    null,
  );

  const summary = study.shortDescription ?? "";
  const seoOgUrl = imageUrl(study.ogImage, 1200);

  return {
    slug,
    clientId: raw.clientId,
    clientName: raw.clientName,
    logoUrl: raw.logoUrl,
    title: study.title,
    subtitle: study.subtitle ?? null,
    displayDate: study.displayDate ?? formatYearRange(span),
    tags,
    summary,
    // The generated block type is structurally looser (optional children)
    // than @portabletext's; the renderer tolerates both.
    body: (study.body as CaseStudy["body"]) ?? null,
    externalUrl: study.externalUrl ?? null,
    hero,
    gallery,
    seo: {
      title:
        stegaClean(study.seoTitle) ?? `${stegaClean(study.title)} — ${stegaClean(raw.clientName)}`,
      description: stegaClean(study.seoDescription) ?? stegaClean(summary),
      ogImageUrl: seoOgUrl ?? heroUrl,
    },
  };
}

const DEFAULT_NAVIGATION: NavSection[] = [{ label: "Work", href: "/work", available: true }];

function normalizeNavigation(
  raw: Array<{ label: string | null; href: string | null; available: boolean | null }> | null,
): NavSection[] {
  const sections = (raw ?? []).flatMap((item) => {
    const href = stegaClean(item.href);
    if (!item.label || !href || !href.startsWith("/")) return [];
    return [{ label: item.label, href, available: item.available === true }];
  });
  return sections.length > 0 ? sections : DEFAULT_NAVIGATION;
}

export function normalizeSiteSettings(raw: SITE_SETTINGS_QUERY_RESULT): SiteSettings {
  const title = raw?.title ?? "Portfolio";
  const description = raw?.description ?? "";
  const start = raw?.workStartYear ?? DEFAULT_WORK_RANGE.start;
  const end = raw?.workEndYear ?? DEFAULT_WORK_RANGE.end;
  return {
    title,
    description,
    logoUrl: raw?.logoUrl ?? null,
    contactUrl: stegaClean(raw?.contactUrl) ?? null,
    linkedinUrl: stegaClean(raw?.linkedinUrl) ?? null,
    navigation: normalizeNavigation(raw?.navigation ?? null),
    workStartYear: Math.min(start, end),
    workEndYear: Math.max(start, end),
    seo: {
      title: stegaClean(raw?.seoTitle) ?? stegaClean(title),
      description: stegaClean(raw?.seoDescription) ?? stegaClean(description),
      ogImageUrl: imageUrl(raw?.defaultOgImage, 1200),
      faviconUrl: raw?.faviconUrl ?? null,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Page content (homepage / About)                                     */
/* ------------------------------------------------------------------ */

const COVER_WIDTH = 600;

/**
 * A missing document (or any missing field) falls back to the local
 * placeholder content, so the pages render fully before the Studio documents
 * exist and partial edits never blank a section.
 */
export function normalizeHomePage(raw: HOME_PAGE_QUERY_RESULT): HomePageContent {
  return {
    intro: raw?.intro ?? HOME_PAGE_DEFAULTS.intro,
    seo: {
      title: stegaClean(raw?.seoTitle) ?? null,
      description: stegaClean(raw?.seoDescription) ?? null,
    },
  };
}

type RawCoverItem = {
  title: string | null;
  cover?: RawImage | null;
  alt: string | null;
  author?: string | null;
  year?: number | null;
};

function normalizeCovers(
  raw: RawCoverItem[] | null | undefined,
  defaults: CoverItem[],
): CoverItem[] {
  const items = (raw ?? []).flatMap<CoverItem>((item) => {
    if (!item.title) return [];
    const title = item.title;
    // Uploaded artwork wins; otherwise reuse the local placeholder cover for
    // a matching default title so a text-only Studio edit still shows art.
    const fallback = defaults.find(
      (candidate) => stegaClean(candidate.title).toLowerCase() === stegaClean(title).toLowerCase(),
    );
    const coverUrl = imageUrl(item.cover, COVER_WIDTH) ?? fallback?.coverUrl;
    if (!coverUrl) return [];
    return [
      {
        title,
        coverUrl,
        alt: item.alt ?? fallback?.alt ?? `Cover artwork for “${stegaClean(title)}”`,
        author: item.author ?? null,
        year: item.year ?? null,
      },
    ];
  });
  return items.length > 0 ? items : defaults;
}

export function normalizeAboutPage(raw: ABOUT_PAGE_QUERY_RESULT): AboutPageContent {
  const defaults = ABOUT_PAGE_DEFAULTS;

  const facts = (raw?.facts ?? []).flatMap((fact) =>
    fact.label && fact.value ? [{ label: fact.label, value: fact.value }] : [],
  );
  const experience = (raw?.experience ?? []).flatMap((entry) =>
    entry.year && entry.title && entry.employer
      ? [{ year: entry.year, title: entry.title, employer: entry.employer }]
      : [],
  );
  const principles = (raw?.principles ?? []).flatMap((principle) =>
    principle.title && principle.body ? [{ title: principle.title, body: principle.body }] : [],
  );

  return {
    intro: raw?.intro ?? defaults.intro,
    facts: facts.length > 0 ? facts : defaults.facts,
    careerStatement: raw?.careerStatement ?? defaults.careerStatement,
    experienceLabel: raw?.experienceLabel ?? defaults.experienceLabel,
    experience: experience.length > 0 ? experience : defaults.experience,
    principlesLabel: raw?.principlesLabel ?? defaults.principlesLabel,
    principles: principles.length > 0 ? principles : defaults.principles,
    moviesLabel: raw?.moviesLabel ?? defaults.moviesLabel,
    booksLabel: raw?.booksLabel ?? defaults.booksLabel,
    movies: normalizeCovers(raw?.movies, defaults.movies),
    books: normalizeCovers(raw?.books, defaults.books),
    contactHeading: raw?.contactHeading ?? defaults.contactHeading,
    contactBody: raw?.contactBody ?? defaults.contactBody,
    contactCtaLabel: raw?.contactCtaLabel ?? defaults.contactCtaLabel,
    seo: {
      title: stegaClean(raw?.seoTitle) ?? defaults.seo.title,
      description: stegaClean(raw?.seoDescription) ?? defaults.seo.description,
    },
  };
}

export function normalizeCaseStudySlugs(
  raw: CASE_STUDY_SLUGS_QUERY_RESULT,
): { slug: string; updatedAt: string }[] {
  return raw.flatMap((item) => {
    const slug = stegaClean(item.slug);
    return slug ? [{ slug, updatedAt: item.updatedAt }] : [];
  });
}
