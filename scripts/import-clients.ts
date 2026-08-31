/**
 * Imports the real client roster into the Sanity dataset, replacing the
 * placeholder content:
 *
 *   npx tsx scripts/import-clients.ts
 *
 * For each client this generates a monochrome SVG logo — the brand's actual
 * mark where the simple-icons set carries it (CC0), otherwise a clean Inter
 * SemiBold wordmark stand-in to swap for the real asset in Studio later —
 * uploads it as a file asset, and writes a `client-<slug>` document. The site
 * renders logos as alpha masks, so a single solid-fill SVG automatically
 * displays black on the light theme and white on the dark theme.
 *
 * It also points site settings at the real LinkedIn profile and, after a
 * fully successful import, deletes the seeded `placeholder-*` client
 * documents. Re-running is idempotent: documents are createOrReplace'd and
 * uploaded logos are reused by filename.
 *
 * Requirements (environment or .env.local): NEXT_PUBLIC_SANITY_PROJECT_ID,
 * SANITY_API_WRITE_TOKEN. Content edits made in Studio to these documents
 * WILL be overwritten by a re-run — this script is the source of truth only
 * until Studio takes over.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@sanity/client";
import fontkit, { type Font } from "fontkit";
import * as simpleIcons from "simple-icons";

import { WORK_TAGS, type WorkTag } from "../src/lib/content/model";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const LINKEDIN_URL = "https://www.linkedin.com/in/adam-kyle-wilson/";
const DESCRIPTION = "Project notes coming soon.";

type Logo = { icon: keyof typeof simpleIcons } | { wordmark: string };

type ClientSpec = {
  name: string;
  slug: string;
  startYear: number;
  endYear?: number;
  tags: WorkTag[];
  logo: Logo;
  /** Internal engagement note, e.g. a reminder that the year is provisional. */
  note?: string;
};

const CLIENTS: ClientSpec[] = [
  {
    name: "Disney",
    slug: "disney",
    startYear: 2010,
    tags: ["Hardware", "Enterprise", "Consumer", "App"],
    logo: { wordmark: "Disney" },
  },
  {
    name: "Google Glass",
    slug: "google-glass",
    startYear: 2010,
    tags: ["Hardware", "Consumer", "App"],
    logo: { icon: "siGoogle" },
  },
  {
    name: "Nike Fuelband",
    slug: "nike-fuelband",
    startYear: 2012,
    tags: ["Hardware", "Consumer", "App"],
    logo: { icon: "siNike" },
  },
  {
    name: "Mercedes F1",
    slug: "mercedes-f1",
    startYear: 2012,
    tags: ["Hardware", "R&D", "App"],
    logo: { wordmark: "Mercedes F1" },
  },
  {
    name: "Amazon",
    slug: "amazon",
    startYear: 2012,
    tags: ["Hardware", "Consumer", "App"],
    logo: { wordmark: "amazon" },
  },
  {
    name: "Bloomberg",
    slug: "bloomberg",
    startYear: 2011,
    tags: ["Hardware", "Enterprise", "Fintech/Crypto"],
    logo: { wordmark: "Bloomberg" },
  },
  {
    name: "NYSE",
    slug: "nyse",
    startYear: 2013,
    tags: ["Consumer", "App"],
    logo: { wordmark: "NYSE" },
  },
  { name: "NBA", slug: "nba", startYear: 2013, tags: ["Consumer", "App"], logo: { icon: "siNba" } },
  {
    name: "Under Armour",
    slug: "under-armour",
    startYear: 2017,
    tags: ["Hardware", "App"],
    logo: { icon: "siUnderarmour" },
  },
  {
    name: "Reddit",
    slug: "reddit",
    startYear: 2016,
    tags: ["Consumer", "App"],
    logo: { icon: "siReddit" },
  },
  {
    name: "GE",
    slug: "ge",
    startYear: 2015,
    tags: ["Enterprise", "R&D"],
    logo: { icon: "siGeneralelectric" },
  },
  {
    name: "Shell",
    slug: "shell",
    startYear: 2016,
    tags: ["Enterprise", "R&D"],
    logo: { icon: "siShell" },
  },
  {
    name: "Lululemon",
    slug: "lululemon",
    startYear: 2017,
    tags: ["Hardware", "Consumer", "App", "R&D"],
    logo: { wordmark: "lululemon" },
  },
  {
    name: "Uniqlo",
    slug: "uniqlo",
    startYear: 2016,
    tags: ["Hardware", "Consumer", "App", "R&D"],
    logo: { icon: "siUniqlo" },
  },
  {
    name: "Jungle Scout",
    slug: "jungle-scout",
    startYear: 2017,
    tags: ["Consumer", "App"],
    logo: { wordmark: "Jungle Scout" },
  },
  {
    name: "Verizon",
    slug: "verizon",
    startYear: 2016,
    tags: ["Enterprise", "Consumer", "R&D", "Hardware"],
    logo: { icon: "siVerizon" },
  },
  {
    name: "FNX",
    slug: "fnx",
    startYear: 2018,
    tags: ["Startup", "Enterprise", "App", "R&D"],
    logo: { wordmark: "FNX" },
    note: "TODO: confirm year (assumed 2018)",
  },
  {
    name: "Fortnite",
    slug: "fortnite",
    startYear: 2025,
    tags: ["Consumer"],
    logo: { icon: "siFortnite" },
  },
  {
    name: "Epic Games",
    slug: "epic-games",
    startYear: 2025,
    tags: ["Consumer"],
    logo: { icon: "siEpicgames" },
  },
  {
    name: "Red Bull",
    slug: "red-bull",
    startYear: 2019,
    tags: ["Consumer", "App", "AR"],
    logo: { icon: "siRedbull" },
  },
  {
    name: "The Olympics",
    slug: "the-olympics",
    startYear: 2020,
    tags: ["Consumer", "App", "AR"],
    logo: { wordmark: "The Olympics" },
  },
  {
    name: "The United Nations",
    slug: "the-united-nations",
    startYear: 2020,
    tags: ["Enterprise", "App"],
    logo: { icon: "siUnitednations" },
  },
  {
    name: "Telus",
    slug: "telus",
    startYear: 2022,
    tags: ["Consumer", "App", "AR"],
    logo: { wordmark: "TELUS" },
  },
  {
    name: "RTFKT",
    slug: "rtfkt",
    startYear: 2020,
    tags: ["Consumer", "App", "AR"],
    logo: { wordmark: "RTFKT" },
  },
  {
    name: "Paramount",
    slug: "paramount",
    startYear: 2024,
    tags: ["Consumer", "App"],
    logo: { wordmark: "Paramount" },
  },
  {
    name: "Universal Studios",
    slug: "universal-studios",
    startYear: 2024,
    tags: ["Consumer", "App"],
    logo: { wordmark: "Universal Studios" },
  },
  {
    name: "Wolf Games",
    slug: "wolf-games",
    startYear: 2025,
    tags: ["Consumer", "App", "R&D"],
    logo: { wordmark: "Wolf Games" },
  },
  {
    name: "Google Gemini",
    slug: "google-gemini",
    startYear: 2025,
    tags: ["Consumer", "App", "R&D"],
    logo: { icon: "siGooglegemini" },
  },
  {
    name: "Coinbase",
    slug: "coinbase",
    startYear: 2024,
    tags: ["Consumer", "App", "Fintech/Crypto"],
    logo: { icon: "siCoinbase" },
  },
  {
    name: "Polymarket",
    slug: "polymarket",
    startYear: 2025,
    tags: ["Consumer", "App"],
    logo: { wordmark: "Polymarket" },
  },
  {
    name: "PayPal",
    slug: "paypal",
    startYear: 2024,
    tags: ["Consumer", "App"],
    logo: { icon: "siPaypal" },
  },
  {
    name: "Hinge",
    slug: "hinge",
    startYear: 2023,
    tags: ["Consumer", "App"],
    logo: { wordmark: "Hinge" },
  },
  { name: "AG1", slug: "ag1", startYear: 2026, tags: ["Consumer"], logo: { wordmark: "AG1" } },
  {
    name: "Skims",
    slug: "skims",
    startYear: 2026,
    tags: ["Consumer", "App"],
    logo: { wordmark: "SKIMS" },
  },
  {
    name: "Anthropic",
    slug: "anthropic",
    startYear: 2026,
    tags: ["Enterprise", "R&D"],
    logo: { icon: "siAnthropic" },
  },
  {
    name: "Shopify",
    slug: "shopify",
    startYear: 2026,
    tags: ["Enterprise", "Consumer"],
    logo: { icon: "siShopify" },
  },
  { name: "Ro", slug: "ro", startYear: 2025, tags: ["Consumer"], logo: { wordmark: "Ro" } },
  {
    name: "PlayStation",
    slug: "playstation",
    startYear: 2021,
    tags: ["Consumer", "App"],
    logo: { icon: "siPlaystation" },
  },
  {
    name: "Activision",
    slug: "activision",
    startYear: 2012,
    tags: ["Consumer", "App"],
    logo: { icon: "siActivision" },
  },
  {
    name: "PopMart",
    slug: "popmart",
    startYear: 2024,
    tags: ["Consumer", "App", "AR"],
    logo: { wordmark: "POP MART" },
  },
];

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

type BuiltLogo = { svg: string; aspect: number; kind: "brand mark" | "wordmark stand-in" };

function iconLogo(key: keyof typeof simpleIcons): BuiltLogo {
  const icon = simpleIcons[key] as { path?: string; title?: string } | undefined;
  if (!icon?.path) throw new Error(`simple-icons has no icon under key "${String(key)}".`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${icon.path}" fill="#000"/></svg>`;
  return { svg, aspect: 1, kind: "brand mark" };
}

function wordmarkBuilder(font: Font) {
  return function wordmarkLogo(text: string): BuiltLogo {
    const run = font.layout(text);
    let x = 0;
    const parts: string[] = [];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    run.glyphs.forEach((glyph, index) => {
      const position = run.positions[index]!;
      // Fonts are y-up; SVG is y-down — flip while placing each glyph.
      const placed = glyph.path
        .translate(x + position.xOffset, position.yOffset)
        .transform(1, 0, 0, -1, 0, 0);
      const box = placed.bbox;
      if (Number.isFinite(box.minX) && box.width > 0) {
        minX = Math.min(minX, box.minX);
        minY = Math.min(minY, box.minY);
        maxX = Math.max(maxX, box.maxX);
        maxY = Math.max(maxY, box.maxY);
        parts.push(placed.toSVG());
      }
      x += position.xAdvance;
    });
    if (!Number.isFinite(minX)) throw new Error(`Wordmark "${text}" produced no outlines.`);
    const pad = font.unitsPerEm * 0.03;
    const width = maxX - minX + pad * 2;
    const height = maxY - minY + pad * 2;
    const viewBox = `${(minX - pad).toFixed(1)} ${(minY - pad).toFixed(1)} ${width.toFixed(1)} ${height.toFixed(1)}`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><path d="${parts.join(" ")}" fill="#000"/></svg>`;
    return { svg, aspect: Number((width / height).toFixed(3)), kind: "wordmark stand-in" };
  };
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

  for (const spec of CLIENTS) {
    const unknown = spec.tags.filter((tag) => !(WORK_TAGS as readonly string[]).includes(tag));
    if (unknown.length > 0) {
      throw new Error(`Client "${spec.name}" uses unknown tags: ${unknown.join(", ")}`);
    }
  }

  // Build every logo up front so a generation problem fails before any write.
  const font = fontkit.openSync(
    path.join(root, "node_modules/inter-ui/web/Inter-SemiBold.woff2"),
  ) as Font;
  const wordmarkLogo = wordmarkBuilder(font);
  const logos = new Map<string, BuiltLogo>(
    CLIENTS.map((spec) => [
      spec.slug,
      "icon" in spec.logo ? iconLogo(spec.logo.icon) : wordmarkLogo(spec.logo.wordmark),
    ]),
  );

  const client = createClient({
    projectId,
    dataset,
    token,
    apiVersion: "2025-08-01",
    useCdn: false,
  });
  console.log(`Importing ${CLIENTS.length} clients into ${projectId}/${dataset}…`);

  for (const spec of CLIENTS) {
    const logo = logos.get(spec.slug)!;
    const filename = `brand--${spec.slug}.svg`;
    let assetId = await client.fetch<string | null>(
      `*[_type == "sanity.fileAsset" && originalFilename == $filename][0]._id`,
      { filename },
    );
    if (!assetId) {
      const asset = await client.assets.upload("file", Buffer.from(logo.svg, "utf8"), {
        filename,
        contentType: "image/svg+xml",
      });
      assetId = asset._id;
    }

    await client.createOrReplace({
      _id: `client-${spec.slug}`,
      _type: "client",
      name: spec.name,
      slug: { _type: "slug", current: spec.slug },
      logo: { _type: "file", asset: { _type: "reference", _ref: assetId } },
      logoAspect: logo.aspect,
      description: DESCRIPTION,
      hidden: false,
      engagements: [
        {
          _type: "engagement",
          _key: "engagement-0",
          startYear: spec.startYear,
          endYear: spec.endYear ?? spec.startYear,
          tags: spec.tags,
          ...(spec.note ? { label: spec.note } : {}),
        },
      ],
    });
    console.log(`  ✓ ${spec.name} (${logo.kind}, aspect ${logo.aspect})`);
  }

  await client.patch("siteSettings").set({ linkedinUrl: LINKEDIN_URL }).commit();
  console.log(`Site settings: linkedinUrl → ${LINKEDIN_URL}`);

  const placeholderQuery = `*[_type == "client" && string::startsWith(_id, "placeholder-")]`;
  const placeholderCount = await client.fetch<number>(`count(${placeholderQuery})`);
  await client.delete({ query: placeholderQuery });
  console.log(`Removed ${placeholderCount} placeholder clients.`);
  console.log(
    "Import complete. Wordmark stand-ins can be replaced with real SVG marks in Studio → Clients.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
