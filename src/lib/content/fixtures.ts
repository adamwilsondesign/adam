/**
 * Typed local fixture adapter.
 *
 * Serves the generated placeholder content (content/fixtures/*.json) through
 * the same interface as the Sanity source, so the whole site runs without
 * Sanity credentials during development. Regenerate the data with
 * `npm run placeholders`; import it into a real Sanity project with
 * `npm run sanity:seed`.
 */

import fixtureClients from "@content/fixtures/clients.json";
import fixtureSettings from "@content/fixtures/site-settings.json";

import type { CaseStudy, SiteSettings, WorkClient } from "./model";

type FixtureFile = {
  clients: WorkClient[];
  caseStudies: CaseStudy[];
};

const data = fixtureClients as unknown as FixtureFile;
const settings = fixtureSettings as unknown as SiteSettings;

function assertFixtures(): void {
  if (!Array.isArray(data.clients) || data.clients.length === 0) {
    throw new Error(
      "Fixture content is missing or empty. Run `npm run placeholders` to regenerate content/fixtures.",
    );
  }
}

export function fixtureSiteSettings(): SiteSettings {
  return settings;
}

export function fixtureWorkIndex(): WorkClient[] {
  assertFixtures();
  return data.clients;
}

export function fixtureCaseStudy(slug: string): CaseStudy | null {
  assertFixtures();
  return data.caseStudies.find((study) => study.slug === slug) ?? null;
}

export function fixtureCaseStudySlugs(): { slug: string; updatedAt: string }[] {
  assertFixtures();
  return data.caseStudies.map((study) => ({
    slug: study.slug,
    updatedAt: new Date(0).toISOString(),
  }));
}
