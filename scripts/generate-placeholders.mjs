/**
 * Deterministic placeholder-content generator.
 *
 * Produces the fictional portfolio content used by the local fixture adapter
 * and by `npm run sanity:seed`:
 *
 *   public/placeholders/logos/<slug>.svg          40 varied monochrome logos
 *   public/placeholders/case-studies/<slug>/*.webp hero + gallery imagery
 *   public/placeholders/og/default.png            default social preview
 *   src/app/icon.svg, src/app/apple-icon.png      favicon / app icon
 *   content/fixtures/clients.json                 normalized client fixtures
 *   content/fixtures/site-settings.json           normalized site settings
 *
 * The generator is seeded, so re-running it produces identical output.
 * Run with: npm run placeholders
 */

import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOGO_DIR = path.join(root, "public/placeholders/logos");
const CASE_DIR = path.join(root, "public/placeholders/case-studies");
const OG_DIR = path.join(root, "public/placeholders/og");
const FIXTURE_DIR = path.join(root, "content/fixtures");

/* ------------------------------------------------------------------ */
/* Seeded RNG                                                          */
/* ------------------------------------------------------------------ */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    shuffle: (arr) => {
      const out = [...arr];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}

function hashString(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ------------------------------------------------------------------ */
/* Client roster                                                       */
/* ------------------------------------------------------------------ */

const TAGS = [
  "AI",
  "AR",
  "App",
  "Fintech/Crypto",
  "R&D",
  "Hardware",
  "Enterprise",
  "Startup",
  "Consumer",
];

/** name, logo archetype, case study flag. All names are fictional. */
const ROSTER = [
  ["Auralith", "lockup", true],
  ["Bracketry", "wordmark", false],
  ["Cairnstack", "compact", true],
  ["Delugio", "circular", false],
  ["Emberline", "wordmark", true],
  ["Fenwick & Sable", "wordmark", false],
  ["Glasswork Systems", "lockup", false],
  ["Halcyard", "tall", true],
  ["Ironquill", "compact", false],
  ["Junipeak", "circular", false],
  ["Kelvinet", "wordmark", false],
  ["Lumenfold", "circular", true],
  ["Mistgrove", "tall", false],
  ["Noctilume", "compact", false],
  ["Ozoni", "circular", false],
  ["Pinegate Labs", "lockup", false],
  ["Quarrel & Post", "wordmark", true],
  ["Ridgeline Twelve", "lockup", false],
  ["Saltfern", "tall", false],
  ["Tesselworks", "compact", false],
  ["Umbrelight", "compact", true],
  ["Veldtline", "wordmark", false],
  ["Wickerbyte", "lockup", false],
  ["Xylograph", "tall", true],
  ["Yonderplane", "wordmark", false],
  ["Zephyrite", "compact", false],
  ["Astral Ledger", "circular", false],
  ["Bellmarrow", "tall", false],
  ["Coppermine Optics", "lockup", false],
  ["Driftcast", "wordmark", false],
  ["Eastfold", "compact", false],
  ["Farrowtech", "wordmark", false],
  ["Gantryline", "tall", false],
  ["Hexbound", "compact", false],
  ["Interlace Guild", "lockup", false],
  ["Jettison Labs", "wordmark", false],
  ["Krillhaus", "circular", false],
  ["Loomward", "tall", false],
  ["Meridian Falsework", "wordmark", false],
  ["Nullhaven", "circular", false],
];

const DOMAINS = {
  AI: ["an applied-research assistant", "a model-evaluation platform", "an inference console"],
  AR: ["a spatial-computing toolkit", "a headset onboarding flow", "an AR field-guide"],
  Crypto: ["a custody dashboard", "a settlement network", "an on-chain analytics suite"],
  "R&D": ["an internal prototyping lab", "a research notebook", "an experimental instrument"],
  Hardware: ["a connected-device companion app", "a firmware update system", "a sensor console"],
  Enterprise: ["a procurement platform", "an operations control room", "a compliance workspace"],
  Startup: ["a zero-to-one product", "a launch-ready MVP", "a seed-stage platform"],
  Consumer: ["a subscription service", "a personal-finance app", "a travel companion"],
};

const VERBS = [
  "Product strategy and interface design for",
  "End-to-end design of",
  "Design systems and prototyping for",
  "Interaction design for",
  "Brand and product design for",
  "Design leadership across",
];

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/* ------------------------------------------------------------------ */
/* Logo generation                                                     */
/* ------------------------------------------------------------------ */

const svg = (viewBox, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="#000">${body}</svg>`;

const circle = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
const ring = (cx, cy, r, t) =>
  `<circle cx="${cx}" cy="${cy}" r="${r - t / 2}" fill="none" stroke="#000" stroke-width="${t}"/>`;
const rect = (x, y, w, h, rx = 0) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}"${rx ? ` rx="${rx}"` : ""}/>`;
const poly = (pts) => `<polygon points="${pts.map((p) => p.join(",")).join(" ")}"/>`;

/** Abstract glyph primitives at cap-height `h`, returning {width, body}. */
function glyph(rng, x, h) {
  const kind = rng.int(0, 8);
  const bar = Math.max(7, Math.round(h * 0.17));
  switch (kind) {
    case 0: // stem
      return { width: bar, body: rect(x, 0, bar, h, bar / 2) };
    case 1: {
      // ring "o"
      const r = h / 2;
      return { width: h, body: ring(x + r, r, r, bar) };
    }
    case 2: {
      // arch "n"
      const r = h * 0.36;
      const b = `${rect(x, 0, bar, h, bar / 2)}${rect(x + r * 2 - bar, r, bar, h - r, bar / 2)}<path d="M ${x + bar / 2} ${r} a ${r - bar / 2} ${r - bar / 2} 0 0 1 ${2 * r - bar} 0" fill="none" stroke="#000" stroke-width="${bar}"/>`;
      return { width: r * 2, body: b };
    }
    case 3: {
      // vee
      const w = h * 0.72;
      return {
        width: w,
        body: `<path d="M ${x + bar / 2} 0 L ${x + w / 2} ${h - bar / 2} L ${x + w - bar / 2} 0" fill="none" stroke="#000" stroke-width="${bar}" stroke-linecap="round" stroke-linejoin="round"/>`,
      };
    }
    case 4: {
      // block
      const w = h * 0.62;
      return { width: w, body: rect(x, 0, w, h, Math.min(10, w * 0.2)) };
    }
    case 5: {
      // slash
      const w = h * 0.55;
      return {
        width: w,
        body: poly([
          [x + w * 0.35, 0],
          [x + w, 0],
          [x + w * 0.65, h],
          [x, h],
        ]),
      };
    }
    case 6: {
      // dot + stem ("i")
      const r = bar * 0.85;
      return {
        width: r * 2,
        body: `${circle(x + r, r, r)}${rect(x + r - bar / 2, r * 2 + bar * 0.6, bar, h - r * 2 - bar * 0.6, bar / 2)}`,
      };
    }
    case 7: {
      // crossbar "t"
      const w = h * 0.6;
      return {
        width: w,
        body: `${rect(x + w / 2 - bar / 2, 0, bar, h, bar / 2)}${rect(x, h * 0.22, w, bar, bar / 2)}`,
      };
    }
    default: {
      // half-disc
      const r = h / 2;
      return {
        width: r,
        body: `<path d="M ${x} 0 a ${r} ${r} 0 0 1 0 ${h} Z"/>`,
      };
    }
  }
}

function wordmarkBody(rng, height, minWidth, maxWidth) {
  const gap = height * 0.28;
  let x = 0;
  const parts = [];
  const target = rng.int(minWidth, maxWidth);
  while (x < target) {
    const g = glyph(rng, x, height);
    parts.push(g.body);
    x += g.width + gap;
  }
  return { width: x - gap, body: parts.join("") };
}

function symbolBody(rng, s) {
  const motif = rng.int(0, 9);
  const c = s / 2;
  switch (motif) {
    case 6: {
      // diamond outline with inner accent
      const t = s * (0.08 + rng.next() * 0.04);
      const inset = t / Math.SQRT2;
      const pts = [
        [c, inset],
        [s - inset, c],
        [c, s - inset],
        [inset, c],
      ];
      const inner = rng.chance(0.6)
        ? circle(c, c, s * (0.1 + rng.next() * 0.06))
        : poly([
            [c, c - s * 0.14],
            [c + s * 0.14, c],
            [c, c + s * 0.14],
            [c - s * 0.14, c],
          ]);
      return `<polygon points="${pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="#000" stroke-width="${t}" stroke-linejoin="round"/>${inner}`;
    }
    case 7: {
      // plus / cross form, sometimes rotated 45°
      const arm = s * (0.26 + rng.next() * 0.08);
      const t = s * (0.2 + rng.next() * 0.08);
      const rot = rng.chance(0.4) ? ` transform="rotate(45 ${c} ${c})"` : "";
      const dot = rng.chance(0.5) ? circle(c, c, t * 0.28) : "";
      return `<g${rot}>${rect(c - t / 2, c - arm, t, arm * 2, t * 0.24)}${rect(c - arm, c - t / 2, arm * 2, t, t * 0.24)}</g>${dot}`;
    }
    case 8: {
      // stair-step blocks descending the diagonal
      const n = rng.pick([3, 4]);
      const unit = s / (n + 0.4);
      const rx = unit * (0.08 + rng.next() * 0.2);
      const parts = [];
      for (let i = 0; i < n; i++) {
        parts.push(rect(i * unit, i * unit, unit * 1.16, unit * 1.16, rx));
      }
      if (rng.chance(0.5)) parts.push(circle(s - unit * 0.5, unit * 0.5, unit * 0.42));
      return parts.join("");
    }
    case 9: {
      // wave bars: horizontal sine strokes with phase drift
      const rows = rng.pick([3, 4]);
      const t = s * (0.07 + rng.next() * 0.03);
      const amp = s * (0.06 + rng.next() * 0.05);
      const parts = [];
      for (let i = 0; i < rows; i++) {
        const y = s * 0.2 + (i * s * 0.6) / (rows - 1);
        const phase = i * s * 0.12;
        parts.push(
          `<path d="M ${s * 0.06} ${y} C ${s * 0.3 - phase * 0.2} ${y - amp}, ${s * 0.45} ${y + amp}, ${c} ${y} S ${s * 0.8} ${y - amp}, ${s * 0.94} ${y}" fill="none" stroke="#000" stroke-width="${t}" stroke-linecap="round"/>`,
        );
      }
      return parts.join("");
    }
    case 0: {
      // target: concentric rings + centre form, ring geometry varies
      const t = s * (0.07 + rng.next() * 0.05);
      const rings = rng.chance(0.5)
        ? `${ring(c, c, s * 0.5, t)}${ring(c, c, s * (0.26 + rng.next() * 0.06), t)}`
        : `${ring(c, c, s * 0.5, t)}${ring(c, c, s * 0.36, t * 0.8)}${ring(c, c, s * 0.22, t * 0.7)}`;
      const centre = rng.chance(0.55)
        ? circle(c, c, s * (0.07 + rng.next() * 0.05))
        : rect(c - s * 0.07, c - s * 0.07, s * 0.14, s * 0.14, 2);
      return `${rings}${centre}`;
    }
    case 1: {
      // quarters: 2x2 with one odd cell, corner rotates per client
      const q = s * (0.42 + rng.next() * 0.06);
      const o = s - q;
      const cells = [
        [0, 0],
        [o, 0],
        [0, o],
        [o, o],
      ];
      const oddIndex = rng.int(0, 3);
      const rx = s * (0.04 + rng.next() * 0.1);
      return cells
        .map(([cx, cy], i) =>
          i === oddIndex
            ? rng.chance(0.7)
              ? circle(cx + q / 2, cy + q / 2, q / 2)
              : poly([
                  [cx + q / 2, cy],
                  [cx + q, cy + q],
                  [cx, cy + q],
                ])
            : rect(cx, cy, q, q, rx),
        )
        .join("");
    }
    case 2: {
      // diagonal split square, split ratio varies
      const k = 0.5 + rng.next() * 0.24;
      const dot = rng.chance(0.7) ? circle(c, c, s * (0.08 + rng.next() * 0.05)) : "";
      return `${poly([
        [0, 0],
        [s * k, 0],
        [0, s * k],
      ])}${poly([
        [s, s * (1 - k)],
        [s, s],
        [s * (1 - k), s],
      ])}${dot}`;
    }
    case 3: {
      // stack of round bars, count and rhythm vary
      const count = rng.int(3, 5);
      const t = s * (0.6 / count);
      const widths = Array.from({ length: count }, () => s * (0.45 + rng.next() * 0.55));
      widths[rng.int(0, count - 1)] = s;
      const align = rng.pick(["center", "left", "right"]);
      return widths
        .map((w, i) => {
          const x = align === "center" ? (s - w) / 2 : align === "left" ? 0 : s - w;
          return rect(x, i * (t * 1.6), w, t, t / 2);
        })
        .join("");
    }
    case 4: {
      // orbit: satellite position and core vary
      const t = s * (0.07 + rng.next() * 0.03);
      const angle = rng.next() * Math.PI * 2;
      const orbitR = s * 0.42;
      const sx = c + Math.cos(angle) * orbitR;
      const sy = c + Math.sin(angle) * orbitR;
      return `${ring(c, c, orbitR, t)}${circle(sx, sy, s * (0.09 + rng.next() * 0.05))}${circle(c, c, s * (0.1 + rng.next() * 0.06))}`;
    }
    default: {
      // aperture ticks: count, reach and rotation vary
      const ticks = [];
      const n = rng.pick([5, 6, 7, 8, 9]);
      const offset = rng.next() * Math.PI;
      const r1 = s * (0.16 + rng.next() * 0.08);
      const r2 = s * 0.48;
      for (let i = 0; i < n; i++) {
        const a = offset + (i / n) * Math.PI * 2;
        ticks.push(
          `<line x1="${c + Math.cos(a) * r1}" y1="${c + Math.sin(a) * r1}" x2="${c + Math.cos(a) * r2}" y2="${c + Math.sin(a) * r2}" stroke="#000" stroke-width="${s * (0.07 + rng.next() * 0.04)}" stroke-linecap="round"/>`,
        );
      }
      return ticks.join("");
    }
  }
}

function makeLogo(name, archetype) {
  const rng = makeRng(hashString(name));
  switch (archetype) {
    case "wordmark": {
      const h = 64;
      const { width, body } = wordmarkBody(rng, h, 320, 520);
      return svg(`0 0 ${Math.ceil(width)} ${h}`, body);
    }
    case "compact": {
      return svg("0 0 96 96", symbolBody(rng, 96));
    }
    case "tall": {
      const w = 68;
      const parts = [];
      let y = 0;
      const blocks = rng.int(3, 5);
      const gap = 6 + rng.int(0, 8);
      for (let i = 0; i < blocks; i++) {
        const kind = rng.int(0, 4);
        const inset = rng.next() * 0.2;
        if (kind === 0) {
          const r = w * (0.24 + rng.next() * 0.12);
          parts.push(circle(w / 2, y + r, r));
          y += r * 2;
        } else if (kind === 1) {
          const h = w * (0.28 + rng.next() * 0.24);
          parts.push(rect((w * inset) / 2, y, w * (1 - inset), h, rng.chance(0.5) ? h / 2 : 5));
          y += h;
        } else if (kind === 2) {
          const h = w * (0.4 + rng.next() * 0.25);
          const flip = rng.chance(0.35);
          parts.push(
            flip
              ? poly([
                  [0, y],
                  [w, y],
                  [w / 2, y + h],
                ])
              : poly([
                  [w / 2, y],
                  [w, y + h],
                  [0, y + h],
                ]),
          );
          y += h;
        } else if (kind === 3) {
          const r = w * (0.22 + rng.next() * 0.1);
          parts.push(ring(w / 2, y + r, r, r * (0.4 + rng.next() * 0.25)));
          y += r * 2;
        } else {
          const h = w * 0.5;
          parts.push(
            poly([
              [w / 2, y],
              [w, y + h / 2],
              [w / 2, y + h],
              [0, y + h / 2],
            ]),
          );
          y += h;
        }
        y += gap;
      }
      return svg(`0 0 ${w} ${Math.ceil(y - gap)}`, parts.join(""));
    }
    case "circular": {
      const s = 104;
      const c = s / 2;
      const t = s * (0.07 + rng.next() * 0.04);
      const variant = rng.int(0, 2);
      if (variant === 0) {
        // classic double ring with centre form
        const inner = rng.chance(0.5)
          ? circle(c, c, s * 0.16)
          : rect(c - s * 0.14, c - s * 0.14, s * 0.28, s * 0.28, 4);
        const notch = rng.chance(0.6)
          ? `<line x1="${c}" y1="0" x2="${c}" y2="${t * 2.4}" stroke="#fff" stroke-width="${t * 1.4}"/>`
          : "";
        return svg(
          `0 0 ${s} ${s}`,
          `${ring(c, c, s * 0.5, t)}${ring(c, c, s * 0.34, t)}${inner}${notch}`,
        );
      }
      if (variant === 1) {
        // broken arc: single ring with a gap and a counterweight dot
        const gap = 40 + rng.int(0, 50);
        const startAngle = rng.next() * 360;
        const r = s * 0.5 - t / 2;
        const a0 = (startAngle * Math.PI) / 180;
        const a1 = ((startAngle + 360 - gap) * Math.PI) / 180;
        const large = 360 - gap > 180 ? 1 : 0;
        const arc = `<path d="M ${c + Math.cos(a0) * r} ${c + Math.sin(a0) * r} A ${r} ${r} 0 ${large} 1 ${c + Math.cos(a1) * r} ${c + Math.sin(a1) * r}" fill="none" stroke="#000" stroke-width="${t}" stroke-linecap="round"/>`;
        const mid = ((startAngle - gap / 2) * Math.PI) / 180;
        const dot = circle(c + Math.cos(mid) * r, c + Math.sin(mid) * r, t * 0.85);
        const core = rng.chance(0.6) ? circle(c, c, s * (0.12 + rng.next() * 0.06)) : "";
        return svg(`0 0 ${s} ${s}`, `${arc}${dot}${core}`);
      }
      // segmented dial: ring of short arcs
      const n = rng.pick([3, 4, 5]);
      const r = s * 0.5 - t / 2;
      const seg = 360 / n;
      const gapDeg = seg * (0.22 + rng.next() * 0.18);
      const offset = rng.next() * 360;
      const parts = [];
      for (let i = 0; i < n; i++) {
        const a0 = ((offset + i * seg) * Math.PI) / 180;
        const a1 = ((offset + i * seg + seg - gapDeg) * Math.PI) / 180;
        parts.push(
          `<path d="M ${c + Math.cos(a0) * r} ${c + Math.sin(a0) * r} A ${r} ${r} 0 0 1 ${c + Math.cos(a1) * r} ${c + Math.sin(a1) * r}" fill="none" stroke="#000" stroke-width="${t}" stroke-linecap="round"/>`,
        );
      }
      parts.push(circle(c, c, s * (0.11 + rng.next() * 0.07)));
      return svg(`0 0 ${s} ${s}`, parts.join(""));
    }
    default: {
      // lockup: symbol + short wordmark
      const s = 88;
      const wm = wordmarkBody(rng, 52, 170, 260);
      const gap = 26;
      const width = s + gap + wm.width;
      const body = `${symbolBody(rng, s)}<g transform="translate(${s + gap}, ${(s - 52) / 2})">${wm.body}</g>`;
      return svg(`0 0 ${Math.ceil(width)} ${s}`, body);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Case-study imagery                                                  */
/* ------------------------------------------------------------------ */

const PALETTES = [
  { bg: "#101014", a: "#5865f2", b: "#c9cdf5", ink: "#f5f5f7", dark: true },
  { bg: "#f4f1ea", a: "#1f4733", b: "#d9822b", ink: "#141414", dark: false },
  { bg: "#0d1f1a", a: "#37c98c", b: "#0a3a2c", ink: "#eafff5", dark: true },
  { bg: "#efe9f7", a: "#5b2d8e", b: "#c7a9ec", ink: "#221133", dark: false },
  { bg: "#161311", a: "#e0632f", b: "#7a4a2e", ink: "#f7efe8", dark: true },
  { bg: "#e8eef2", a: "#12557a", b: "#8fb9cf", ink: "#0d1c26", dark: false },
  { bg: "#111820", a: "#d9b64a", b: "#3c4d63", ink: "#f2ead0", dark: true },
  { bg: "#f2e8e4", a: "#a63d40", b: "#e3b5a4", ink: "#2b1214", dark: false },
];

function compositionBody(rng, W, H, p, kind) {
  switch (kind) {
    case 0: {
      // split fields + circle
      const split = W * (0.35 + rng.next() * 0.3);
      return (
        `${rect(0, 0, split, H)}`.replace("/>", ` fill="${p.a}"/>`) +
        `<circle cx="${split}" cy="${H * (0.3 + rng.next() * 0.4)}" r="${H * 0.22}" fill="${p.b}"/>`
      );
    }
    case 1: {
      // diagonal bands
      const bands = [];
      const n = rng.int(4, 7);
      for (let i = 0; i < n; i++) {
        const x = (i / n) * (W * 1.4) - W * 0.2;
        bands.push(
          `<rect x="${x}" y="${-H * 0.2}" width="${(W / n) * 0.5}" height="${H * 1.4}" fill="${i % 2 ? p.a : p.b}" transform="rotate(${rng.pick([-18, -12, 14])} ${W / 2} ${H / 2})"/>`,
        );
      }
      return bands.join("");
    }
    case 2: {
      // concentric rings
      const cx = W * (0.3 + rng.next() * 0.4);
      const cy = H * (0.35 + rng.next() * 0.3);
      const rings = [];
      for (let i = 5; i >= 1; i--) {
        rings.push(
          `<circle cx="${cx}" cy="${cy}" r="${(H * 0.42 * i) / 5}" fill="none" stroke="${i % 2 ? p.a : p.b}" stroke-width="${H * 0.035}"/>`,
        );
      }
      return rings.join("");
    }
    case 3: {
      // dot grid
      const dots = [];
      const step = W / rng.pick([10, 14]);
      for (let y = step / 2; y < H; y += step) {
        for (let x = step / 2; x < W; x += step) {
          const r = (step / 2) * (0.15 + 0.75 * Math.abs(Math.sin((x + y) / (W * 0.35))));
          dots.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${p.a}"/>`);
        }
      }
      return dots.join("");
    }
    case 4: {
      // large arcs
      const t = H * 0.09;
      return (
        `<path d="M ${-W * 0.1} ${H * 0.9} A ${W * 0.7} ${W * 0.7} 0 0 1 ${W * 1.05} ${H * 0.55}" fill="none" stroke="${p.a}" stroke-width="${t}"/>` +
        `<path d="M ${-W * 0.05} ${H * 1.15} A ${W * 0.7} ${W * 0.7} 0 0 1 ${W * 1.1} ${H * 0.8}" fill="none" stroke="${p.b}" stroke-width="${t}"/>` +
        `<circle cx="${W * 0.78}" cy="${H * 0.22}" r="${H * 0.07}" fill="${p.ink}"/>`
      );
    }
    default: {
      // blocks
      const blocks = [];
      let x = W * 0.08;
      const n = rng.int(3, 5);
      for (let i = 0; i < n; i++) {
        const w = W * (0.1 + rng.next() * 0.2);
        const h = H * (0.25 + rng.next() * 0.55);
        blocks.push(
          `<rect x="${x}" y="${H - h - H * 0.1}" width="${w}" height="${h}" fill="${i % 2 ? p.a : p.b}" rx="${W * 0.005}"/>`,
        );
        x += w + W * 0.05;
      }
      return blocks.join("");
    }
  }
}

async function renderImage(file, W, H, rng, palette) {
  const kind = rng.int(0, 5);
  const body = compositionBody(rng, W, H, palette, kind);
  const image = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${palette.bg}"/>${body}</svg>`;
  await sharp(Buffer.from(image)).webp({ quality: 80 }).toFile(file);
  return kind;
}

const COMPOSITION_WORDS = [
  "split colour fields with a floating disc",
  "diagonal bands",
  "concentric rings",
  "a rhythmic dot grid",
  "sweeping arcs",
  "stacked rectangular blocks",
];

/* ------------------------------------------------------------------ */
/* Case-study copy                                                     */
/* ------------------------------------------------------------------ */

const PROJECT_TITLES = [
  ["Field Console", "Realtime coordination for distributed crews"],
  ["Ledgerlight", "Making custody legible for operations teams"],
  ["Waypoint", "Spatial onboarding without the manual"],
  ["Signal Bench", "An evaluation workbench for applied research"],
  ["Northroom", "A control room that reads at a glance"],
  ["Loomline", "Weaving hardware telemetry into one thread"],
  ["Softmarket", "A calmer way to buy complicated things"],
  ["Kilnworks", "Prototyping tools for a materials lab"],
];

function portableParagraph(text, key) {
  return {
    _type: "block",
    _key: `${key}`,
    style: "normal",
    markDefs: [],
    children: [{ _type: "span", _key: `${key}s`, text, marks: [] }],
  };
}

function caseBody(clientName, title) {
  return [
    portableParagraph(
      `${title} began as a narrow brief and widened into the core product. Working directly with the ${clientName} team, the engagement covered interaction models, a component system, and the unglamorous edge cases that make an interface feel dependable.`,
      "p1",
    ),
    portableParagraph(
      `The final release shipped with a measurable drop in time-to-first-action and a design system the in-house team now extends without outside help. Placeholder copy — replace with the real case study narrative in Sanity Studio.`,
      "p2",
    ),
  ];
}

/* ------------------------------------------------------------------ */
/* Engagements                                                         */
/* ------------------------------------------------------------------ */

function buildEngagements(rng) {
  const count = rng.chance(0.35) ? 2 : rng.chance(0.12) ? 3 : 1;
  const engagements = [];
  let cursor = rng.int(2010, 2022);
  for (let i = 0; i < count; i++) {
    const start = Math.min(2026, cursor);
    const end = Math.min(2026, start + rng.int(0, 3));
    const tagCount = rng.int(1, 3);
    const tags = rng.shuffle(TAGS).slice(0, tagCount);
    engagements.push({ startYear: start, endYear: end, tags });
    cursor = end + rng.int(1, 3);
    if (cursor > 2026) break;
  }
  return engagements;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  await rm(LOGO_DIR, { recursive: true, force: true });
  await rm(CASE_DIR, { recursive: true, force: true });
  await mkdir(LOGO_DIR, { recursive: true });
  await mkdir(CASE_DIR, { recursive: true });
  await mkdir(OG_DIR, { recursive: true });
  await mkdir(FIXTURE_DIR, { recursive: true });

  const clients = [];
  const caseStudies = [];
  let studyIndex = 0;

  for (const [name, archetype, hasStudy] of ROSTER) {
    const slug = slugify(name);
    const logoSvg = makeLogo(name, archetype);
    await writeFile(path.join(LOGO_DIR, `${slug}.svg`), logoSvg);

    // Intrinsic aspect ratio, read back from the viewBox: this feeds the
    // optical normalization that keeps wordmarks and symbols in balance.
    const viewBox = logoSvg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    const logoAspect = viewBox
      ? Math.round((Number(viewBox[1]) / Number(viewBox[2])) * 1000) / 1000
      : 1;

    const engagements = buildEngagements(makeRng(hashString(`${name}:eng`)));
    const primaryTag = engagements[0].tags[0];
    const description = `${makeRng(hashString(`${name}:copy`)).pick(VERBS)} ${makeRng(hashString(`${name}:dom`)).pick(DOMAINS[primaryTag])}.`;

    let caseStudySummary = null;
    if (hasStudy) {
      const [title, subtitle] = PROJECT_TITLES[studyIndex];
      const palette = PALETTES[studyIndex % PALETTES.length];
      const caseSlug = slug;
      const dir = path.join(CASE_DIR, caseSlug);
      await mkdir(dir, { recursive: true });

      const imgRng = makeRng(hashString(`${name}:img`));
      const heroKind = await renderImage(
        path.join(dir, "hero.webp"),
        1920,
        1080,
        makeRng(hashString(`${name}:hero`)),
        palette,
      );

      const galleryPlan = imgRng
        .shuffle(["16:9", "square", "square", "16:9", "square"])
        .slice(0, imgRng.int(4, 5));
      const gallery = [];
      for (let i = 0; i < galleryPlan.length; i++) {
        const aspect = galleryPlan[i];
        const [w, h] = aspect === "square" ? [1440, 1440] : [1920, 1080];
        const file = `image-${String(i + 1).padStart(2, "0")}.webp`;
        const itemPalette = imgRng.chance(0.35)
          ? PALETTES[(studyIndex + 3 + i) % PALETTES.length]
          : palette;
        const kind = await renderImage(
          path.join(dir, file),
          w,
          h,
          makeRng(hashString(`${name}:gimg${i}`)),
          itemPalette,
        );
        gallery.push({
          url: `/placeholders/case-studies/${caseSlug}/${file}`,
          width: w,
          height: h,
          aspect,
          alt: `Placeholder ${title} interface study: ${COMPOSITION_WORDS[kind]} on a ${itemPalette.dark ? "dark" : "light"} field`,
          caption: i === 0 ? `${title} — placeholder frame ${i + 1}` : null,
          lqip: null,
        });
      }

      const yearSpan = engagements.reduce(
        (acc, e) => ({
          start: Math.min(acc.start, e.startYear),
          end: Math.max(acc.end, e.endYear),
        }),
        { start: Infinity, end: -Infinity },
      );
      const tags = TAGS.filter((t) => engagements.some((e) => e.tags.includes(t)));
      const summary = `${title} is a placeholder case study for ${name}: ${subtitle.toLowerCase()}.`;

      caseStudies.push({
        slug: caseSlug,
        clientId: `placeholder.client.${slug}`,
        clientName: name,
        logoUrl: `/placeholders/logos/${slug}.svg`,
        title,
        subtitle,
        displayDate:
          yearSpan.start === yearSpan.end
            ? `${yearSpan.start}`
            : `${yearSpan.start}–${yearSpan.end}`,
        tags,
        summary,
        body: caseBody(name, title),
        externalUrl: studyIndex % 3 === 0 ? null : `https://example.com/${caseSlug}`,
        hero: {
          url: `/placeholders/case-studies/${caseSlug}/hero.webp`,
          width: 1920,
          height: 1080,
          aspect: "16:9",
          alt: `Placeholder hero image for ${title}: ${COMPOSITION_WORDS[heroKind]} on a ${palette.dark ? "dark" : "light"} field`,
          caption: null,
          lqip: null,
        },
        gallery,
        seo: {
          title: `${title} — ${name}`,
          description: summary,
          ogImageUrl: null,
        },
      });

      caseStudySummary = {
        slug: caseSlug,
        title,
        heroUrl: `/placeholders/case-studies/${caseSlug}/hero.webp`,
      };
      studyIndex++;
    }

    clients.push({
      id: `placeholder.client.${slug}`,
      name,
      slug,
      logoUrl: `/placeholders/logos/${slug}.svg`,
      logoAspect,
      logoTreatment: null,
      description,
      engagements,
      caseStudy: caseStudySummary,
    });
  }

  /* Coverage checks so the fixture set exercises the whole filter UI. */
  for (const tag of TAGS) {
    const covered = clients.filter((c) => c.engagements.some((e) => e.tags.includes(tag))).length;
    if (covered < 4) throw new Error(`Tag ${tag} only covered by ${covered} clients`);
  }
  for (let year = 2010; year <= 2026; year++) {
    const covered = clients.some((c) =>
      c.engagements.some((e) => e.startYear <= year && e.endYear >= year),
    );
    if (!covered) throw new Error(`Year ${year} not covered by any engagement`);
  }
  if (caseStudies.length !== 8)
    throw new Error(`Expected 8 case studies, got ${caseStudies.length}`);

  await writeFile(
    path.join(FIXTURE_DIR, "clients.json"),
    JSON.stringify({ clients, caseStudies }, null, 2),
  );

  const settings = {
    title: "Adam Wilson",
    description:
      "Independent designer working on interfaces, interaction and product strategy across AI, hardware and consumer software.",
    logoUrl: null,
    // The site owner's real address (placeholder-guard would hide anything
    // invented). Editable later in Sanity site settings → Contact, or via
    // NEXT_PUBLIC_CONTACT_URL while running on fixtures.
    contactUrl: "mailto:adamwilson@lazertechnologies.com",
    // TODO(owner): replace with the real profile URL (or set it in Sanity /
    // NEXT_PUBLIC_LINKEDIN_URL).
    linkedinUrl: "https://www.linkedin.com/in/adam-kyle-wilson/",
    navigation: [
      { label: "Work", href: "/work", available: true },
      { label: "About", href: "/about", available: false },
      { label: "Side Quests", href: "/side-quests", available: false },
    ],
    workStartYear: 2010,
    workEndYear: 2026,
    seo: {
      title: "Adam Wilson — Design Portfolio",
      description:
        "Selected client work 2010–2026: interfaces, interaction and product strategy across AI, hardware and consumer software.",
      ogImageUrl: "/placeholders/og/default.png",
    },
  };
  await writeFile(path.join(FIXTURE_DIR, "site-settings.json"), JSON.stringify(settings, null, 2));

  /* Monogram (A + W strokes) reused for icon, apple icon and OG image. */
  const monogram = (stroke, sw) =>
    `<g fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M 14 86 L 40 14 L 66 86 M 24 62 L 56 62"/>` +
    `<path d="M 76 14 L 92 86 L 108 40 L 124 86 L 140 14"/>` +
    `</g>`;

  const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#000"/><g transform="translate(-27,0) scale(1)">${monogram("#fff", 9)}</g></svg>`;
  await writeFile(path.join(root, "src/app/icon.svg"), iconSvg);

  const appleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180"><rect width="180" height="180" fill="#000"/><g transform="translate(13,40)">${monogram("#fff", 10)}</g></svg>`;
  await sharp(Buffer.from(appleSvg)).png().toFile(path.join(root, "src/app/apple-icon.png"));

  const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#0a0a0a"/><g transform="translate(523,215) scale(2)">${monogram("#f5f5f2", 7)}</g><rect x="80" y="80" width="52" height="8" rx="4" fill="#f5f5f2"/><rect x="80" y="542" width="180" height="8" rx="4" fill="#4a4a4a"/><rect x="940" y="542" width="180" height="8" rx="4" fill="#4a4a4a"/></svg>`;
  await sharp(Buffer.from(ogSvg)).png().toFile(path.join(OG_DIR, "default.png"));

  console.log(
    `Generated ${clients.length} clients, ${caseStudies.length} case studies, logos, imagery, icons.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
