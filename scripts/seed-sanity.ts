/**
 * Imports the generated placeholder content into a Sanity dataset.
 *
 *   npm run sanity:seed              create/update placeholder documents
 *   npm run sanity:seed -- --dry-run validate fixtures + assets and print the
 *                                    plan without touching any network
 *   npm run sanity:seed -- --remove  delete every placeholder document
 *
 * Requirements (read from the environment or .env.local):
 *   NEXT_PUBLIC_SANITY_PROJECT_ID
 *   NEXT_PUBLIC_SANITY_DATASET      (defaults to "production")
 *   SANITY_API_WRITE_TOKEN          a token with Editor rights (server-side only)
 *
 * Safety:
 *   - Every document this script writes uses an id with the `placeholder-`
 *     prefix (e.g. placeholder-client-auralith), so re-running only replaces
 *     placeholder documents and can never overwrite real content. The prefix
 *     is dash-separated on purpose: Sanity treats ids containing dots as
 *     path-scoped and hides them from public (unauthenticated) queries, which
 *     would make the seeded content invisible to the published site.
 *   - Site settings are created with `createIfNotExists` — an existing
 *     settings document is left untouched.
 *   - Uploaded assets are tagged with a `placeholder--` filename prefix and
 *     reused on re-runs instead of being duplicated.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@sanity/client";

import { isPlaceholderExternalUrl } from "../src/lib/content/placeholder-guard";

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

/**
 * The write surface. The real implementation wraps @sanity/client; the
 * dry-run implementation validates every local asset and mutation shape
 * without any network access, so the full seed path can be exercised in CI
 * and credential-less environments.
 */
type Writer = {
  findAsset(assetType: string, filename: string): Promise<string | null>;
  uploadAsset(
    kind: "file" | "image",
    filename: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string>;
  createIfNotExists(doc: Record<string, unknown> & { _id: string; _type: string }): Promise<void>;
  createOrReplace(doc: Record<string, unknown> & { _id: string; _type: string }): Promise<void>;
  deletePlaceholders(): Promise<void>;
};

function realWriter(projectId: string, dataset: string, token: string): Writer {
  const client = createClient({
    projectId,
    dataset,
    token,
    apiVersion: "2025-08-01",
    useCdn: false,
  });
  return {
    findAsset: (assetType, filename) =>
      client.fetch<string | null>(`*[_type == $type && originalFilename == $filename][0]._id`, {
        type: assetType,
        filename,
      }),
    uploadAsset: async (kind, filename, buffer, contentType) => {
      const asset = await client.assets.upload(kind, buffer, { filename, contentType });
      return asset._id;
    },
    createIfNotExists: async (doc) => {
      await client.createIfNotExists(doc);
    },
    createOrReplace: async (doc) => {
      await client.createOrReplace(doc);
    },
    deletePlaceholders: async () => {
      // Covers current dash-prefixed ids and the dotted ids of earlier seeds.
      await client.delete({
        query: `*[string::startsWith(_id, "placeholder-") || _id in path("placeholder.**")]`,
      });
    },
  };
}

function dryWriter(counters: { assets: number; documents: string[] }): Writer {
  return {
    findAsset: async () => null,
    uploadAsset: async (kind, filename, buffer) => {
      if (buffer.length === 0) throw new Error(`Asset ${filename} is empty.`);
      counters.assets += 1;
      return `${kind === "file" ? "file" : "image"}-dryrun-${counters.assets}`;
    },
    createIfNotExists: async (doc) => {
      counters.documents.push(`${doc._id} (create-if-missing)`);
    },
    createOrReplace: async (doc) => {
      if (!doc._id.startsWith("placeholder-") && doc._id !== "siteSettings") {
        throw new Error(`Refusing non-placeholder id: ${doc._id}`);
      }
      counters.documents.push(doc._id);
    },
    deletePlaceholders: async () => {
      counters.documents.push("(delete placeholder.**)");
    },
  };
}

async function main(): Promise<void> {
  await loadDotEnvLocal();
  const dryRun = process.argv.includes("--dry-run");

  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";
  const token = process.env.SANITY_API_WRITE_TOKEN;

  if (!dryRun && (!projectId || !token)) {
    console.error(
      "Missing configuration. Set NEXT_PUBLIC_SANITY_PROJECT_ID and SANITY_API_WRITE_TOKEN " +
        "(in the environment or .env.local) before seeding — `npm run sanity:setup` creates " +
        "both. See README → Sanity setup. (Use --dry-run to validate without credentials.)",
    );
    process.exit(1);
  }

  const counters = { assets: 0, documents: [] as string[] };
  const writer = dryRun ? dryWriter(counters) : realWriter(projectId!, dataset, token!);

  if (process.argv.includes("--remove")) {
    console.log(`Removing placeholder documents from ${projectId}/${dataset}…`);
    await writer.deletePlaceholders();
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
    linkedinUrl?: string | null;
    navigation?: { label: string; href: string; available: boolean }[];
    workStartYear: number;
    workEndYear: number;
    seo: { title: string; description: string };
  };

  console.log(
    dryRun
      ? `Dry run: validating ${fixtures.clients.length} placeholder clients (${fixtures.caseStudies.length} case studies)…`
      : `Seeding ${fixtures.clients.length} placeholder clients (${fixtures.caseStudies.length} case studies) into ${projectId}/${dataset}…`,
  );

  const assetCache = new Map<string, string>();

  async function uploadAsset(kind: "file" | "image", publicPath: string): Promise<string> {
    const cacheKey = `${kind}:${publicPath}`;
    const cached = assetCache.get(cacheKey);
    if (cached) return cached;

    const filename = `placeholder--${publicPath.split("/").slice(-2).join("--")}`;
    const assetType = kind === "file" ? "sanity.fileAsset" : "sanity.imageAsset";
    const existing = await writer.findAsset(assetType, filename);
    if (existing) {
      assetCache.set(cacheKey, existing);
      return existing;
    }

    const buffer = await readFile(path.join(root, "public", publicPath.replace(/^\//, "")));
    const id = await writer.uploadAsset(
      kind,
      filename,
      buffer,
      publicPath.endsWith(".svg") ? "image/svg+xml" : "image/webp",
    );
    assetCache.set(cacheKey, id);
    return id;
  }

  await writer.createIfNotExists({
    _id: "siteSettings",
    _type: "siteSettings",
    title: settings.title,
    description: settings.description,
    contactUrl: settings.contactUrl ?? undefined,
    linkedinUrl: settings.linkedinUrl ?? undefined,
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
  if (!dryRun) console.log("Site settings ensured (existing settings are never overwritten).");

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
        displayDate: study.displayDate,
        shortDescription: study.summary,
        body: study.body,
        // Placeholder URLs (example.com) never enter the dataset: production
        // validation treats them as errors, and the CTA is meant to appear
        // only once a real project URL is set in Studio.
        externalUrl:
          study.externalUrl && !isPlaceholderExternalUrl(study.externalUrl)
            ? study.externalUrl
            : undefined,
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

    await writer.createOrReplace({
      // Fixture ids are dotted (placeholder.client.foo); dots would make the
      // document path-scoped and publicly invisible, so flatten them.
      _id: fixture.id.replace(/\./g, "-"),
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
    if (!dryRun) console.log(`  ✓ ${fixture.name}${study ? " (case study)" : ""}`);
  }

  if (dryRun) {
    console.log(
      `Dry run OK: ${counters.documents.length} documents (${counters.documents.filter((d) => d.startsWith("placeholder-")).length} placeholder-scoped), ${counters.assets} assets readable and ready to upload.`,
    );
    return;
  }
  console.log("Seed complete. Remove placeholders later with: npm run sanity:seed -- --remove");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
