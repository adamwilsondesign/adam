/**
 * Imports the generated placeholder content into a Sanity dataset.
 *
 *   npm run sanity:seed            create/update placeholder documents
 *   npm run sanity:seed -- --remove  delete every placeholder document
 *
 * Requirements (read from the environment or .env.local):
 *   NEXT_PUBLIC_SANITY_PROJECT_ID
 *   NEXT_PUBLIC_SANITY_DATASET      (defaults to "production")
 *   SANITY_API_WRITE_TOKEN          a token with Editor rights (server-side only)
 *
 * Safety:
 *   - Every document this script writes uses an id under the `placeholder.`
 *     prefix (e.g. placeholder.client.auralith), so re-running only replaces
 *     placeholder documents and can never overwrite real content.
 *   - Site settings are created with `createIfNotExists` — an existing
 *     settings document is left untouched.
 *   - Uploaded assets are tagged with a `placeholder--` filename prefix and
 *     reused on re-runs instead of being duplicated.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@sanity/client";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function loadDotEnvLocal(): Promise<void> {
  for (const file of [".env.local", ".env"]) {
    try {
      const raw = await readFile(path.join(root, file), "utf8");
      for (const line of raw.split("\n")) {
        const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
        if (match && match[1] && process.env[match[1]] === undefined) {
          process.env[match[1]] = match[2]?.replace(/^["']|["']$/g, "") ?? "";
        }
      }
    } catch {
      // optional files
    }
  }
}

type FixtureMedia = {
  url: string;
  aspect: "square" | "16:9";
  alt: string;
  caption: string | null;
};

type FixtureCaseStudy = {
  slug: string;
  clientId: string;
  title: string;
  subtitle: string | null;
  displayDate: string;
  summary: string;
  body: unknown[];
  externalUrl: string | null;
  hero: FixtureMedia;
  gallery: FixtureMedia[];
  seo: { title: string; description: string };
};

type FixtureClient = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string;
  logoAspect?: number;
  description: string;
  engagements: {
    startYear: number;
    endYear: number;
    tags: string[];
    description?: string | null;
  }[];
  caseStudy: { slug: string } | null;
};

async function main(): Promise<void> {
  await loadDotEnvLocal();

  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";
  const token = process.env.SANITY_API_WRITE_TOKEN;

  if (!projectId || !token) {
    console.error(
      "Missing configuration. Set NEXT_PUBLIC_SANITY_PROJECT_ID and SANITY_API_WRITE_TOKEN " +
        "(in the environment or .env.local) before seeding. See README → Sanity setup.",
    );
    process.exit(1);
  }

  const client = createClient({
    projectId,
    dataset,
    token,
    apiVersion: "2025-08-01",
    useCdn: false,
  });

  if (process.argv.includes("--remove")) {
    console.log(`Removing placeholder documents from ${projectId}/${dataset}…`);
    await client.delete({ query: `*[_id in path("placeholder.**")]` });
    console.log(
      "Placeholder documents removed. Uploaded placeholder assets can be pruned in Studio → Media.",
    );
    return;
  }

  const fixtures = JSON.parse(
    await readFile(path.join(root, "content/fixtures/clients.json"), "utf8"),
  ) as { clients: FixtureClient[]; caseStudies: FixtureCaseStudy[] };
  const settings = JSON.parse(
    await readFile(path.join(root, "content/fixtures/site-settings.json"), "utf8"),
  ) as {
    title: string;
    description: string;
    contactUrl: string | null;
    navigation?: { label: string; href: string; available: boolean }[];
    workStartYear: number;
    workEndYear: number;
    seo: { title: string; description: string };
  };

  console.log(
    `Seeding ${fixtures.clients.length} placeholder clients (${fixtures.caseStudies.length} case studies) into ${projectId}/${dataset}…`,
  );

  const assetCache = new Map<string, string>();

  async function uploadAsset(kind: "file" | "image", publicPath: string): Promise<string> {
    const cacheKey = `${kind}:${publicPath}`;
    const cached = assetCache.get(cacheKey);
    if (cached) return cached;

    const filename = `placeholder--${publicPath.split("/").slice(-2).join("--")}`;
    const assetType = kind === "file" ? "sanity.fileAsset" : "sanity.imageAsset";
    const existing = await client.fetch<string | null>(
      `*[_type == $type && originalFilename == $filename][0]._id`,
      { type: assetType, filename },
    );
    if (existing) {
      assetCache.set(cacheKey, existing);
      return existing;
    }

    const buffer = await readFile(path.join(root, "public", publicPath.replace(/^\//, "")));
    const asset = await client.assets.upload(kind, buffer, {
      filename,
      contentType: publicPath.endsWith(".svg") ? "image/svg+xml" : "image/webp",
    });
    assetCache.set(cacheKey, asset._id);
    return asset._id;
  }

  await client.createIfNotExists({
    _id: "siteSettings",
    _type: "siteSettings",
    title: settings.title,
    description: settings.description,
    contactUrl: settings.contactUrl ?? undefined,
    navigation: (settings.navigation ?? []).map((section, index) => ({
      _key: `section-${index}`,
      label: section.label,
      href: section.href,
      available: section.available,
    })),
    workStartYear: settings.workStartYear,
    workEndYear: settings.workEndYear,
    seoTitle: settings.seo.title,
    seoDescription: settings.seo.description,
  });
  console.log("Site settings ensured (existing settings are never overwritten).");

  const studiesBySlug = new Map(fixtures.caseStudies.map((study) => [study.slug, study]));

  for (const fixture of fixtures.clients) {
    const logoAssetId = await uploadAsset("file", fixture.logoUrl);
    const study = fixture.caseStudy ? studiesBySlug.get(fixture.caseStudy.slug) : undefined;

    let caseStudy: Record<string, unknown> | undefined;
    if (study) {
      const heroAssetId = await uploadAsset("image", study.hero.url);
      const gallery = [];
      for (let i = 0; i < study.gallery.length; i++) {
        const media = study.gallery[i]!;
        const imageAssetId = await uploadAsset("image", media.url);
        gallery.push({
          _type: "caseStudyMedia",
          _key: `media-${i}`,
          image: { _type: "image", asset: { _type: "reference", _ref: imageAssetId } },
          alt: media.alt,
          caption: media.caption ?? undefined,
          aspect: media.aspect,
        });
      }
      caseStudy = {
        _type: "caseStudy",
        slug: { _type: "slug", current: study.slug },
        title: study.title,
        subtitle: study.subtitle ?? undefined,
        shortDescription: study.summary,
        body: study.body,
        externalUrl: study.externalUrl ?? undefined,
        heroImage: {
          _type: "image",
          asset: { _type: "reference", _ref: heroAssetId },
          alt: study.hero.alt,
        },
        gallery,
        seoTitle: study.seo.title,
        seoDescription: study.seo.description,
      };
    }

    await client.createOrReplace({
      _id: fixture.id,
      _type: "client",
      name: fixture.name,
      slug: { _type: "slug", current: fixture.slug },
      logo: { _type: "file", asset: { _type: "reference", _ref: logoAssetId } },
      logoAspect: fixture.logoAspect ?? undefined,
      description: fixture.description,
      hidden: false,
      engagements: fixture.engagements.map((engagement, index) => ({
        _type: "engagement",
        _key: `engagement-${index}`,
        startYear: engagement.startYear,
        endYear: engagement.endYear,
        tags: engagement.tags,
        description: engagement.description ?? undefined,
      })),
      ...(caseStudy ? { caseStudy } : {}),
    });
    console.log(`  ✓ ${fixture.name}${study ? " (case study)" : ""}`);
  }

  console.log("Seed complete. Remove placeholders later with: npm run sanity:seed -- --remove");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
