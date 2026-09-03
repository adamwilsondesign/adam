/**
 * Generates local placeholder cover artwork for the About page marquees:
 * public/placeholders/covers/{movies,books}/<slug>.svg
 *
 * Every cover is an original graphic design seeded from its title — no
 * remote or copyrighted artwork is fetched. The title is the artwork: set
 * in one of several typographic compositions over the site's night palette,
 * with the author (books) or year (movies) as a small credit line.
 *
 * Deterministic: rerunning produces identical files.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const MOVIES = [
  { title: "Back to the Future", year: 1985 },
  { title: "Stand by Me", year: 1986 },
  { title: "Jurassic Park", year: 1993 },
  { title: "The Matrix", year: 1999 },
  { title: "RoboCop", year: 1987 },
  { title: "The Lord of the Rings", year: 2001 },
  { title: "Indiana Jones and the Raiders of the Lost Ark", year: 1981 },
  { title: "Heat", year: 1995 },
  { title: "Fight Club", year: 1999 },
  { title: "The Dark Knight", year: 2008 },
];

const BOOKS = [
  { title: "Pet Sematary", author: "Stephen King" },
  { title: "Dungeon Crawler Carl", author: "Matt Dinniman" },
  { title: "Dune", author: "Frank Herbert" },
  { title: "On Writing", author: "Stephen King" },
  { title: "Keith Haring Journals", author: "Keith Haring" },
  { title: "The Lives of Brian", author: "Brian Johnson" },
  { title: "I Am Ozzy", author: "Ozzy Osbourne" },
  { title: "Ready Player One", author: "Ernest Cline" },
  { title: "Neuromancer", author: "William Gibson" },
  { title: "Kitchen Confidential", author: "Anthony Bourdain" },
];

const W = 400;
const H = 600;

/** Muted, cold night-adjacent duos: [field, accent]. */
const PALETTES = [
  ["#0b1218", "#7fa3a8"],
  ["#0d1114", "#a8987f"],
  ["#0a1015", "#8ba38c"],
  ["#101418", "#a0aab8"],
  ["#0c1013", "#b0885f"],
  ["#0b1414", "#6f9c94"],
  ["#12100e", "#c2a075"],
  ["#0e1216", "#9db3ab"],
];

function hash(input) {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const esc = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** Greedy word wrap targeting a rough characters-per-line budget. */
function wrap(title, perLine) {
  const words = title.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    if (line && (line + " " + word).length > perLine) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Helvetica Neue', Arial, sans-serif";

/** Background motifs — quiet geometry behind the type. */
function motif(kind, random, accent) {
  switch (kind) {
    case 0: {
      // Horizon: a low arc and a small moon disc.
      const cy = 380 + random() * 120;
      const mx = 60 + random() * 280;
      return `
        <path d="M -40 ${cy} Q ${W / 2} ${cy - 130 - random() * 60} ${W + 40} ${cy}"
          fill="none" stroke="${accent}" stroke-opacity="0.34" stroke-width="2"/>
        <circle cx="${mx.toFixed(0)}" cy="${(cy - 150 - random() * 80).toFixed(0)}" r="${(14 + random() * 10).toFixed(0)}"
          fill="${accent}" fill-opacity="0.5"/>`;
    }
    case 1: {
      // Concentric rings, off-canvas center.
      const cx = random() < 0.5 ? -30 : W + 30;
      const cy = 120 + random() * 320;
      let rings = "";
      for (let i = 1; i <= 5; i++) {
        rings += `<circle cx="${cx}" cy="${cy.toFixed(0)}" r="${i * (44 + random() * 8)}"
          fill="none" stroke="${accent}" stroke-opacity="${(0.3 - i * 0.045).toFixed(3)}" stroke-width="1.5"/>`;
      }
      return rings;
    }
    case 2: {
      // Diagonal ribbons.
      const tilt = (random() * 18 - 9).toFixed(1);
      let bars = "";
      for (let i = 0; i < 3; i++) {
        const y = 110 + i * (110 + random() * 40);
        bars += `<rect x="-60" y="${y.toFixed(0)}" width="${W + 120}" height="${(16 + random() * 20).toFixed(0)}"
          fill="${accent}" fill-opacity="${(0.16 + i * 0.05).toFixed(2)}"
          transform="rotate(${tilt} ${W / 2} ${y.toFixed(0)})"/>`;
      }
      return bars;
    }
    default: {
      // Scattered points (a quiet field of stars).
      const r = rng(Math.floor(random() * 1e9));
      let dots = "";
      for (let i = 0; i < 26; i++) {
        dots += `<circle cx="${(r() * W).toFixed(0)}" cy="${(r() * H).toFixed(0)}" r="${(0.8 + r() * 1.6).toFixed(1)}"
          fill="${accent}" fill-opacity="${(0.25 + r() * 0.4).toFixed(2)}"/>`;
      }
      return dots;
    }
  }
}

function cover({ title, credit }) {
  const seed = hash(title);
  const random = rng(seed);
  const [field, accent] = PALETTES[seed % PALETTES.length];
  const motifSvg = motif(seed % 4, random, accent);
  const layout = Math.floor(random() * 3);

  // Type scale from the longest word so nothing overflows.
  const longest = Math.max(...title.split(" ").map((w) => w.length));
  const perLine = Math.max(longest, title.length > 26 ? 14 : 10);
  const lines = wrap(title, perLine);
  const size = Math.min(64, Math.max(26, Math.floor((W - 72) / (perLine * 0.52))));
  const lineHeight = size * 1.08;

  let titleSvg = "";
  if (layout === 0) {
    // Centred serif stack in the upper half.
    const y0 = 150;
    titleSvg = lines
      .map(
        (line, i) =>
          `<text x="${W / 2}" y="${(y0 + i * lineHeight).toFixed(0)}" text-anchor="middle"
            font-family="${SERIF}" font-size="${size}" fill="#f2f3f0">${esc(line)}</text>`,
      )
      .join("");
  } else if (layout === 1) {
    // Left-aligned near the base, editorial.
    const y0 = H - 96 - (lines.length - 1) * lineHeight;
    titleSvg = lines
      .map(
        (line, i) =>
          `<text x="44" y="${(y0 + i * lineHeight).toFixed(0)}"
            font-family="${SERIF}" font-size="${size}" fill="#f2f3f0">${esc(line)}</text>`,
      )
      .join("");
  } else {
    // Uppercase condensed sans, tracked out, centred vertically.
    const upper = wrap(title.toUpperCase(), perLine);
    const s = Math.min(size, 40);
    const y0 = H / 2 - ((upper.length - 1) * s * 1.25) / 2;
    titleSvg = upper
      .map(
        (line, i) =>
          `<text x="${W / 2}" y="${(y0 + i * s * 1.25).toFixed(0)}" text-anchor="middle"
            font-family="${SANS}" font-size="${s}" font-weight="600" letter-spacing="3"
            fill="#f2f3f0">${esc(line)}</text>`,
      )
      .join("");
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="field" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${field}"/>
      <stop offset="1" stop-color="#04070a"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#field)"/>
  ${motifSvg}
  ${titleSvg}
  <text x="${W / 2}" y="${H - 34}" text-anchor="middle" font-family="${SANS}"
    font-size="14" letter-spacing="2" fill="${accent}" fill-opacity="0.85">${esc(credit.toUpperCase())}</text>
  <rect x="10.5" y="10.5" width="${W - 21}" height="${H - 21}" fill="none"
    stroke="#f2f3f0" stroke-opacity="0.14"/>
</svg>
`;
}

const slugify = (title) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

for (const [kind, items] of [
  ["movies", MOVIES.map((m) => ({ ...m, credit: String(m.year) }))],
  ["books", BOOKS.map((b) => ({ ...b, credit: b.author }))],
]) {
  const dir = join(root, "public", "placeholders", "covers", kind);
  mkdirSync(dir, { recursive: true });
  for (const item of items) {
    const file = join(dir, `${slugify(item.title)}.svg`);
    writeFileSync(file, cover(item));
    console.log(`✓ ${kind}/${slugify(item.title)}.svg`);
  }
}
