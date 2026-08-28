import "server-only";

import { isSanityConfigured } from "@/sanity/env";

import {
  fixtureCaseStudy,
  fixtureCaseStudySlugs,
  fixtureSiteSettings,
  fixtureWorkIndex,
} from "./fixtures";
import type { CaseStudy, SiteSettings, WorkClient } from "./model";
import {
  sanityCaseStudy,
  sanityCaseStudySlugs,
  sanitySiteSettings,
  sanityWorkIndex,
} from "./sanity-source";

export type ContentSourceName = "sanity" | "fixtures";

export class ContentConfigurationError extends Error {
  constructor() {
    super(
      [
        "No content source is configured for a production build.",
        "",
        "Sanity is the production source of truth. To connect it:",
        "  1. Set NEXT_PUBLIC_SANITY_PROJECT_ID (and NEXT_PUBLIC_SANITY_DATASET) — see .env.example.",
        "  2. Optionally set SANITY_API_READ_TOKEN for draft previews.",
        "  3. Seed placeholder content with `npm run sanity:seed` if the dataset is empty.",
        "",
        "To intentionally build with local fixture content (CI, previews without a CMS),",
        "set NEXT_PUBLIC_CONTENT_SOURCE=fixtures explicitly. Production never falls back",
        "to fixtures silently.",
      ].join("\n"),
    );
    this.name = "ContentConfigurationError";
  }
}

let warnedFixtureProduction = false;

/**
 * Decides where content comes from. Sanity wins whenever credentials exist;
 * fixtures serve development and explicitly opted-in production builds.
 */
export function resolveContentSource(): ContentSourceName {
  if (isSanityConfigured) return "sanity";
  if (process.env.NEXT_PUBLIC_CONTENT_SOURCE === "fixtures") {
    if (process.env.NODE_ENV === "production" && !warnedFixtureProduction) {
      warnedFixtureProduction = true;
      console.warn(
        "[content] Production build is using local fixture content (NEXT_PUBLIC_CONTENT_SOURCE=fixtures).",
      );
    }
    return "fixtures";
  }
  if (process.env.NODE_ENV !== "production") return "fixtures";
  throw new ContentConfigurationError();
}

export async function getSiteSettings(): Promise<SiteSettings> {
  return resolveContentSource() === "sanity" ? sanitySiteSettings() : fixtureSiteSettings();
}

export async function getWorkIndex(): Promise<WorkClient[]> {
  return resolveContentSource() === "sanity" ? sanityWorkIndex() : fixtureWorkIndex();
}

export async function getCaseStudy(slug: string): Promise<CaseStudy | null> {
  return resolveContentSource() === "sanity" ? sanityCaseStudy(slug) : fixtureCaseStudy(slug);
}

export async function getCaseStudySlugs(): Promise<{ slug: string; updatedAt: string }[]> {
  return resolveContentSource() === "sanity" ? sanityCaseStudySlugs() : fixtureCaseStudySlugs();
}
