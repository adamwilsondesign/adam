/**
 * Seeds the Home page and About page singleton documents:
 *
 *   npx tsx scripts/seed-about.ts
 *
 * Copies the local placeholder content (src/lib/content/about-defaults.ts)
 * into Sanity — including the generated cover artwork from
 * public/placeholders/covers — and flips the About entry in site-settings
 * navigation to available. Existing homePage/aboutPage documents are left
 * untouched (createIfNotExists), so re-running never clobbers Studio edits.
 *
 * Requirements (environment or .env.local): NEXT_PUBLIC_SANITY_PROJECT_ID,
 * SANITY_API_WRITE_TOKEN.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@sanity/client";

import { ABOUT_PAGE_DEFAULTS, HOME_PAGE_DEFAULTS } from "../src/lib/content/about-defaults";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Node's global fetch (undici) ignores HTTP(S)_PROXY environment variables,
 * so in proxied environments it bypasses the proxy other tools use and gets
 * blocked. Route it through the env proxy when one is configured.
 */
async function installProxyDispatcher(): Promise<void> {
  if (!process.env.HTTPS_PROXY && !process.env.https_proxy) return;
  try {
    const { EnvHttpProxyAgent, setGlobalDispatcher } = await import("undici");
    setGlobalDispatcher(new EnvHttpProxyAgent());
  } catch {
    // undici unavailable — fetch stays direct
  }
}

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
  await installProxyDispatcher();
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

  /* Cover artwork: the locally generated SVGs become reusable image assets. */
  const assetCache = new Map<string, string>();
  async function coverAsset(publicPath: string): Promise<string> {
    const cached = assetCache.get(publicPath);
    if (cached) return cached;
    const filename = `cover--${publicPath.split("/").slice(-2).join("--")}`;
    let id = await client.fetch<string | null>(
      `*[_type == "sanity.imageAsset" && originalFilename == $filename][0]._id`,
      { filename },
    );
    if (!id) {
      const buffer = await readFile(path.join(root, "public", publicPath.replace(/^\//, "")));
      const asset = await client.assets.upload("image", buffer, {
        filename,
        contentType: "image/svg+xml",
      });
      id = asset._id;
    }
    assetCache.set(publicPath, id);
    return id;
  }

  const imageRef = (assetId: string) => ({
    _type: "image" as const,
    asset: { _type: "reference" as const, _ref: assetId },
  });

  console.log(`Seeding page documents in ${projectId}/${dataset}…`);

  /* Home page singleton. */
  const homeResult = await client.createIfNotExists({
    _id: "homePage",
    _type: "homePage",
    intro: HOME_PAGE_DEFAULTS.intro,
  });
  console.log(
    homeResult._rev
      ? "  ✓ homePage present (left untouched if it already existed)"
      : "  ✓ homePage created",
  );

  /* About page singleton, with the cover artwork uploaded first. */
  const about = ABOUT_PAGE_DEFAULTS;
  const movies = [];
  for (let index = 0; index < about.movies.length; index++) {
    const movie = about.movies[index]!;
    movies.push({
      _type: "movieItem",
      _key: `movie-${index}`,
      title: movie.title,
      year: movie.year ?? undefined,
      cover: imageRef(await coverAsset(movie.coverUrl)),
      alt: movie.alt,
    });
    console.log(`  ✓ cover uploaded: ${movie.title}`);
  }
  const books = [];
  for (let index = 0; index < about.books.length; index++) {
    const book = about.books[index]!;
    books.push({
      _type: "bookItem",
      _key: `book-${index}`,
      title: book.title,
      author: book.author ?? undefined,
      cover: imageRef(await coverAsset(book.coverUrl)),
      alt: book.alt,
    });
    console.log(`  ✓ cover uploaded: ${book.title}`);
  }

  await client.createIfNotExists({
    _id: "aboutPage",
    _type: "aboutPage",
    intro: about.intro,
    facts: about.facts.map((fact, index) => ({
      _type: "fact",
      _key: `fact-${index}`,
      label: fact.label,
      value: fact.value,
    })),
    careerStatement: about.careerStatement,
    experienceLabel: about.experienceLabel,
    experience: about.experience.map((entry, index) => ({
      _type: "experienceEntry",
      _key: `experience-${index}`,
      year: entry.year,
      title: entry.title,
      employer: entry.employer,
    })),
    principlesLabel: about.principlesLabel,
    principles: about.principles.map((principle, index) => ({
      _type: "principle",
      _key: `principle-${index}`,
      title: principle.title,
      body: principle.body,
    })),
    moviesLabel: about.moviesLabel,
    movies,
    booksLabel: about.booksLabel,
    books,
    contactHeading: about.contactHeading,
    contactBody: about.contactBody,
    contactCtaLabel: about.contactCtaLabel,
    seoTitle: about.seo.title,
    seoDescription: about.seo.description,
  });
  console.log("  ✓ aboutPage present (left untouched if it already existed)");

  /* Navigation: the About section goes live. */
  type NavItem = { _key?: string; label?: string; href?: string; available?: boolean };
  const navigation = await client.fetch<NavItem[] | null>(`*[_id == "siteSettings"][0].navigation`);
  if (!navigation) {
    console.warn("  ! siteSettings has no navigation array — skipped the About flip.");
  } else {
    const next = navigation.map((item) =>
      item.href === "/about" ? { ...item, available: true } : item,
    );
    if (!next.some((item) => item.href === "/about")) {
      next.splice(1, 0, { _key: "nav-about", label: "About", href: "/about", available: true });
    }
    await client.patch("siteSettings").set({ navigation: next }).commit();
    console.log("  ✓ siteSettings navigation: About is live");
  }

  console.log("Done. Edit the content in Studio → Home page / About page.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
