import "server-only";

import { sanityFetch } from "@/sanity/lib/live";
import {
  CASE_STUDY_QUERY,
  CASE_STUDY_SLUGS_QUERY,
  SITE_SETTINGS_QUERY,
  WORK_INDEX_QUERY,
} from "@/sanity/lib/queries";

import type {
  CASE_STUDY_QUERY_RESULT,
  CASE_STUDY_SLUGS_QUERY_RESULT,
  SITE_SETTINGS_QUERY_RESULT,
  WORK_INDEX_QUERY_RESULT,
} from "@/sanity/types.generated";

import type { CaseStudy, SiteSettings, WorkClient } from "./model";
import {
  normalizeCaseStudy,
  normalizeCaseStudySlugs,
  normalizeSiteSettings,
  normalizeWorkIndex,
} from "./normalize";

/**
 * Content Lake source. All fetching goes through `sanityFetch` (Live Content
 * API) so published edits invalidate the cache without a redeploy, and draft
 * mode automatically switches the perspective for previews.
 *
 * The `as` casts pair each fetch with its TypeGen result type. (next-sanity
 * currently nests its own @sanity/client, so TypeGen's automatic
 * `SanityQueries` overloads don't reach `sanityFetch`; these casts are the
 * one sanctioned bridge, revalidated whenever `npm run sanity:typegen` runs.)
 */

export async function sanitySiteSettings(): Promise<SiteSettings> {
  const { data } = await sanityFetch({ query: SITE_SETTINGS_QUERY });
  return normalizeSiteSettings(data as SITE_SETTINGS_QUERY_RESULT);
}

export async function sanityWorkIndex(): Promise<WorkClient[]> {
  const { data } = await sanityFetch({ query: WORK_INDEX_QUERY });
  return normalizeWorkIndex(data as WORK_INDEX_QUERY_RESULT);
}

export async function sanityCaseStudy(slug: string): Promise<CaseStudy | null> {
  const { data } = await sanityFetch({ query: CASE_STUDY_QUERY, params: { slug } });
  return normalizeCaseStudy(data as CASE_STUDY_QUERY_RESULT);
}

export async function sanityCaseStudySlugs(): Promise<{ slug: string; updatedAt: string }[]> {
  const { data } = await sanityFetch({
    query: CASE_STUDY_SLUGS_QUERY,
    perspective: "published",
    stega: false,
  });
  return normalizeCaseStudySlugs(data as CASE_STUDY_SLUGS_QUERY_RESULT);
}
