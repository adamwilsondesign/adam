import "server-only";

import { isSanityConfigured } from "@/sanity/env";

import {
  fixtureAboutPage,
  fixtureCaseStudy,
  fixtureCaseStudySlugs,
  fixtureHomePage,
  fixtureSiteSettings,
  fixtureWorkIndex,
} from "./fixtures";
import type {
  AboutPageContent,
  CaseStudy,
  HomePageContent,
  SiteSettings,
  WorkClient,
} from "./model";
import { sanitizeContactUrl, sanitizeExternalUrl } from "./placeholder-guard";
import {
  sanityAboutPage,
  sanityCaseStudy,
  sanityCaseStudySlugs,
  sanityHomePage,
  sanitySiteSettings,
  sanityWorkIndex,
} from "./sanity-source";
import { formatIssues, validateContent, type ValidationMode } from "./validate";

export type ContentSourceName = "sanity" | "fixtures";

export class ContentConfigurationError extends Error {
  constructor(detail?: string) {
    super(
      detail ??
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

/**
 * Placeholder mode is the documented fixture-backed state; production mode
 * turns placeholder leakage (example URLs, fake contact addresses, missing
 * alt text) into hard errors. Sanity-backed builds always validate as
 * production; NEXT_PUBLIC_CONTENT_VALIDATION=production forces it early.
 */
export function resolveValidationMode(): ValidationMode {
  if (process.env.NEXT_PUBLIC_CONTENT_VALIDATION === "production") return "production";
  return resolveContentSource() === "sanity" ? "production" : "placeholder";
}

/* ------------------------------------------------------------------ */
/* One-shot validation                                                 */
/* ------------------------------------------------------------------ */

let validationRun: Promise<void> | null = null;

async function loadAll(): Promise<{
  settings: SiteSettings;
  clients: WorkClient[];
  caseStudies: CaseStudy[];
}> {
  const sanity = resolveContentSource() === "sanity";
  const settings = sanity ? await sanitySiteSettings() : fixtureSiteSettings();
  const clients = sanity ? await sanityWorkIndex() : fixtureWorkIndex();
  const slugs = sanity ? await sanityCaseStudySlugs() : fixtureCaseStudySlugs();
  const caseStudies = (
    await Promise.all(
      slugs.map(({ slug }) => (sanity ? sanityCaseStudy(slug) : fixtureCaseStudy(slug))),
    )
  ).filter((study): study is CaseStudy => study !== null);
  return { settings, clients, caseStudies };
}

/**
 * Validates the full content set once per server process. Errors fail
 * production builds with an actionable message; in development everything is
 * reported to the console and the site keeps rendering.
 */
function ensureValidated(): Promise<void> {
  validationRun ??= (async () => {
    const mode = resolveValidationMode();
    const bundle = await loadAll();
    const issues = validateContent(bundle, mode);
    if (issues.length === 0) return;

    const errors = issues.filter((issue) => issue.level === "error");
    const report = formatIssues(issues);
    if (errors.length > 0 && process.env.NODE_ENV === "production") {
      throw new ContentConfigurationError(
        `Content validation failed (${mode} mode):\n${report}\n\nFix the content (Sanity Studio or \`npm run placeholders\`) and rebuild.`,
      );
    }
    console.warn(`[content] validation report (${mode} mode):\n${report}`);
  })().catch((error) => {
    validationRun = null; // allow a later retry in dev
    throw error;
  });
  return validationRun;
}

/* ------------------------------------------------------------------ */
/* Facade                                                              */
/* ------------------------------------------------------------------ */

export async function getSiteSettings(): Promise<SiteSettings> {
  await ensureValidated();
  const settings =
    resolveContentSource() === "sanity" ? await sanitySiteSettings() : fixtureSiteSettings();
  const envContact = process.env.NEXT_PUBLIC_CONTACT_URL || null;
  const envLinkedin = process.env.NEXT_PUBLIC_LINKEDIN_URL || null;
  return {
    ...settings,
    // Placeholder addresses / URLs can never render; the controls hide.
    contactUrl: sanitizeContactUrl(settings.contactUrl ?? envContact),
    linkedinUrl: sanitizeExternalUrl(settings.linkedinUrl ?? envLinkedin),
  };
}

export async function getWorkIndex(): Promise<WorkClient[]> {
  await ensureValidated();
  return resolveContentSource() === "sanity" ? sanityWorkIndex() : fixtureWorkIndex();
}

export async function getCaseStudy(slug: string): Promise<CaseStudy | null> {
  await ensureValidated();
  const study =
    resolveContentSource() === "sanity" ? await sanityCaseStudy(slug) : fixtureCaseStudy(slug);
  if (!study) return null;
  // A placeholder project URL never ships as a CTA.
  return { ...study, externalUrl: sanitizeExternalUrl(study.externalUrl) };
}

export async function getHomePage(): Promise<HomePageContent> {
  await ensureValidated();
  return resolveContentSource() === "sanity" ? sanityHomePage() : fixtureHomePage();
}

export async function getAboutPage(): Promise<AboutPageContent> {
  await ensureValidated();
  return resolveContentSource() === "sanity" ? sanityAboutPage() : fixtureAboutPage();
}

export async function getCaseStudySlugs(): Promise<{ slug: string; updatedAt: string }[]> {
  await ensureValidated();
  return resolveContentSource() === "sanity" ? sanityCaseStudySlugs() : fixtureCaseStudySlugs();
}

/** The case-study sibling list (index order) for prev/next navigation. */
export async function getCaseSiblings(): Promise<
  {
    slug: string;
    title: string;
    clientId: string;
    clientName: string;
    logoUrl: string;
    logoAspect: number;
  }[]
> {
  const clients = await getWorkIndex();
  return clients.flatMap((client) =>
    client.caseStudy
      ? [
          {
            slug: client.caseStudy.slug,
            title: client.caseStudy.title,
            clientId: client.id,
            clientName: client.name,
            logoUrl: client.logoUrl,
            logoAspect: client.logoAspect,
          },
        ]
      : [],
  );
}
