/**
 * Typed local fixture adapter.
 *
 * Serves the generated placeholder content (content/fixtures/*.json) through
 * the same interface as the Sanity source, so the whole site runs without
 * Sanity credentials during development. Regenerate the data with
 * `npm run placeholders`; import it into a real Sanity project with
 * `npm run sanity:seed`.
 *
 * Missing optional fields degrade gracefully here (aspect ratios default to
 * 1, treatments to null, navigation to a Work-only index), so older fixture
 * files and hand-edited content keep working.
 */

import fixtureClients from "@content/fixtures/clients.json";
import fixtureSettings from "@content/fixtures/site-settings.json";

import type { CaseStudy, NavSection, SiteSettings, WorkClient } from "./model";

type FixtureFile = {
  clients: (Omit<WorkClient, "logoAspect" | "logoTreatment"> &
    Partial<Pick<WorkClient, "logoAspect" | "logoTreatment">>)[];
  caseStudies: CaseStudy[];
};

type FixtureSettings = Omit<SiteSettings, "navigation"> & { navigation?: NavSection[] };

const data = fixtureClients as unknown as FixtureFile;
const settings = fixtureSettings as unknown as FixtureSettings;

const DEFAULT_NAVIGATION: NavSection[] = [{ label: "Work", href: "/work", available: true }];

function assertFixtures(): void {
  if (!Array.isArray(data.clients) || data.clients.length === 0) {
    throw new Error(
      "Fixture content is missing or empty. Run `npm run placeholders` to regenerate content/fixtures.",
    );
  }
}

export function fixtureSiteSettings(): SiteSettings {
  return {
    ...settings,
    linkedinUrl: settings.linkedinUrl ?? null,
    navigation: settings.navigation ?? DEFAULT_NAVIGATION,
    seo: { ...settings.seo, faviconUrl: settings.seo.faviconUrl ?? null },
  };
}

export function fixtureWorkIndex(): WorkClient[] {
  assertFixtures();
  return data.clients.map((client) => ({
    ...client,
    logoAspect: client.logoAspect ?? 1,
    logoTreatment: client.logoTreatment ?? null,
  }));
}

export function fixtureCaseStudy(slug: string): CaseStudy | null {
  assertFixtures();
  return data.caseStudies.find((study) => study.slug === slug) ?? null;
}

export function fixtureCaseStudySlugs(): { slug: string; updatedAt: string }[] {
  assertFixtures();
  // Fixtures carry no edit history; report build time so sitemaps look sane.
  const updatedAt = new Date().toISOString();
  return data.caseStudies.map((study) => ({ slug: study.slug, updatedAt }));
}
