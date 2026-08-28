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
  CASE_STUDY_QUERY_RESULT,
  CASE_STUDY_SLUGS_QUERY_RESULT,
  SITE_SETTINGS_QUERY_RESULT,
  WORK_INDEX_QUERY_RESULT,
} from "@/sanity/types.generated";

import {
  formatYearRange,
  isWorkTag,
  WORK_TAGS,
  type CaseStudy,
  type Engagement,
  type MediaAspect,
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
  const url = imageUrl(item.image, GALLERY_WIDTH);
  if (!url) return null;
  const dimensions = item.image?.dimensions;
  const fallback =
    aspect === "square" ? { width: 1600, height: 1600 } : { width: 1920, height: 1080 };
  return {
    url,
    width: dimensions?.width ?? fallback.width,
    height: dimensions?.height ?? fallback.height,
    aspect,
    alt: item.alt ?? "",
    caption: item.caption ?? null,
    lqip: item.image?.lqip ?? null,
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
    workStartYear: Math.min(start, end),
    workEndYear: Math.max(start, end),
    seo: {
      title: stegaClean(raw?.seoTitle) ?? stegaClean(title),
      description: stegaClean(raw?.seoDescription) ?? stegaClean(description),
      ogImageUrl: imageUrl(raw?.defaultOgImage, 1200),
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
