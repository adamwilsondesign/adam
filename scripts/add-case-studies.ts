/**
 * Attaches placeholder case studies to ten real clients:
 *
 *   npx tsx scripts/add-case-studies.ts
 *
 * Each case study gets clearly-labelled placeholder copy (to be rewritten in
 * Studio → Clients → <client> → Case study) and reuses the generated
 * placeholder imagery already sitting in the media library from the original
 * seed (uploaded again from public/placeholders when missing). Clients are
 * PATCHED — every other field, including Studio edits, is left untouched.
 * Re-running replaces only the caseStudy object.
 *
 * Requirements (environment or .env.local): NEXT_PUBLIC_SANITY_PROJECT_ID,
 * SANITY_API_WRITE_TOKEN.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@sanity/client";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type Target = {
  /** client-<slug> document to patch; also used as the case-study slug. */
  slug: string;
  name: string;
  title: string;
  displayDate: string;
  /** Which fixture image set (public/placeholders/case-studies/<set>) to reuse. */
  imageSet: string;
};

const TARGETS: Target[] = [
  {
    slug: "disney",
    name: "Disney",
    title: "Connected Guest Experience",
    displayDate: "2010",
    imageSet: "auralith",
  },
  {
    slug: "google-glass",
    name: "Google Glass",
    title: "Heads-Up Interface Studies",
    displayDate: "2010",
    imageSet: "cairnstack",
  },
  {
    slug: "nike-fuelband",
    name: "Nike Fuelband",
    title: "Movement, Measured",
    displayDate: "2012",
    imageSet: "emberline",
  },
  {
    slug: "mercedes-f1",
    name: "Mercedes F1",
    title: "Race Systems R&D",
    displayDate: "2012",
    imageSet: "halcyard",
  },
  {
    slug: "reddit",
    name: "Reddit",
    title: "Community in Motion",
    displayDate: "2016",
    imageSet: "lumenfold",
  },
  {
    slug: "red-bull",
    name: "Red Bull",
    title: "Augmented Event Layer",
    displayDate: "2019",
    imageSet: "quarrel-and-post",
  },
  {
    slug: "the-olympics",
    name: "The Olympics",
    title: "Games, Live and Layered",
    displayDate: "2020",
    imageSet: "umbrelight",
  },
  {
    slug: "playstation",
    name: "PlayStation",
    title: "Play, Extended",
    displayDate: "2021",
    imageSet: "xylograph",
  },
  {
    slug: "coinbase",
    name: "Coinbase",
    title: "Markets Made Legible",
    displayDate: "2024",
    imageSet: "auralith",
  },
  {
    slug: "google-gemini",
    name: "Google Gemini",
    title: "Conversations with Gemini",
    displayDate: "2025",
    imageSet: "emberline",
  },
];

const SUBTITLE = "Placeholder case study — the real story lands here";

function placeholderBody(name: string) {
  const paragraph = (key: string, text: string) => ({
    _type: "block",
    _key: key,
    style: "normal",
    markDefs: [],
    children: [{ _type: "span", _key: `${key}s`, text, marks: [] }],
  });
  const heading = (key: string, text: string) => ({
    _type: "block",
    _key: key,
    style: "h2",
    markDefs: [],
    children: [{ _type: "span", _key: `${key}s`, text, marks: [] }],
  });
  return [
    paragraph(
      "p1",
      `This is placeholder copy standing in for the real ${name} case study. The finished write-up will open with the brief: what ${name} needed, the constraints the team was working inside, and where the project started.`,
    ),
    paragraph(
      "p2",
      "It will then walk the work itself — the early explorations, the decisions that shaped the final direction, and the details that made the interface feel considered rather than assembled.",
    ),
    heading("h1", "What shipped"),
    paragraph(
      "p3",
      "A closing section will cover what actually launched and what it changed. Until then, this placeholder keeps the page's structure, rhythm and imagery in place.",
    ),
    paragraph("p4", `Replace this text in Sanity Studio: Clients → ${name} → Case study.`),
  ];
}

type FixtureMedia = {
  url: string;
  aspect: "square" | "16:9";
  alt: string;
  caption: string | null;
};
type FixtureStudy = { slug: string; hero: FixtureMedia; gallery: FixtureMedia[] };

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

async function main(): Promise<void> {
  await loadDotEnvLocal();
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";
  const token = process.env.SANITY_API_WRITE_TOKEN;
  if (!projectId || !token) {
    console.error(
      "Missing NEXT_PUBLIC_SANITY_PROJECT_ID or SANITY_API_WRITE_TOKEN (env or .env.local).",
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

  const fixtures = JSON.parse(
    await readFile(path.join(root, "content/fixtures/clients.json"), "utf8"),
  ) as { caseStudies: FixtureStudy[] };
  const imageSets = new Map(fixtures.caseStudies.map((study) => [study.slug, study]));

  const assetCache = new Map<string, string>();
  async function imageAsset(publicPath: string): Promise<string> {
    const cached = assetCache.get(publicPath);
    if (cached) return cached;
    const filename = `placeholder--${publicPath.split("/").slice(-2).join("--")}`;
    let id = await client.fetch<string | null>(
      `*[_type == "sanity.imageAsset" && originalFilename == $filename][0]._id`,
      { filename },
    );
    if (!id) {
      const buffer = await readFile(path.join(root, "public", publicPath.replace(/^\//, "")));
      const asset = await client.assets.upload("image", buffer, {
        filename,
        contentType: "image/webp",
      });
      id = asset._id;
    }
    assetCache.set(publicPath, id);
    return id;
  }

  console.log(`Attaching ${TARGETS.length} placeholder case studies in ${projectId}/${dataset}…`);
  for (const target of TARGETS) {
    const images = imageSets.get(target.imageSet);
    if (!images) throw new Error(`No fixture image set named "${target.imageSet}".`);

    const documentId = `client-${target.slug}`;
    const exists = await client.fetch<string | null>(`*[_id == $id][0]._id`, { id: documentId });
    if (!exists) throw new Error(`Client document ${documentId} not found.`);

    const heroAssetId = await imageAsset(images.hero.url);
    const gallery = [];
    for (let index = 0; index < images.gallery.length; index++) {
      const media = images.gallery[index]!;
      gallery.push({
        _type: "caseStudyMedia",
        _key: `media-${index}`,
        image: { _type: "image", asset: { _type: "reference", _ref: await imageAsset(media.url) } },
        alt: `Placeholder frame ${index + 1} for the ${target.name} case study`,
        caption: `${target.name.toLowerCase()} — placeholder frame ${index + 1}`,
        aspect: media.aspect,
      });
    }

    const summary = `Placeholder case study for ${target.name} — replace with the real project summary in Studio.`;
    await client
      .patch(documentId)
      .set({
        caseStudy: {
          _type: "caseStudy",
          slug: { _type: "slug", current: target.slug },
          title: target.title,
          subtitle: SUBTITLE,
          displayDate: target.displayDate,
          shortDescription: summary,
          body: placeholderBody(target.name),
          heroImage: {
            _type: "image",
            asset: { _type: "reference", _ref: heroAssetId },
            alt: `Placeholder hero image for the ${target.name} case study`,
          },
          gallery,
          seoTitle: `${target.title} — ${target.name}`,
          seoDescription: summary,
        },
      })
      .commit();
    console.log(`  ✓ ${target.name} → “${target.title}” (${gallery.length} gallery frames)`);
  }
  console.log("Done. Rewrite each study in Studio → Clients → <client> → Case study.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
