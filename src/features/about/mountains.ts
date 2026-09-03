/**
 * The About page's nighttime range: deterministic, organic ridge geometry.
 *
 * Five atmospheric layers (three on mobile) rise into the bottom quarter of
 * the viewport, from distant haze to a near-black foreground, with a central
 * valley opening for the content. All contours come from seeded, smoothly
 * interpolated value noise — irregular and organic, never triangles or
 * low-poly facets. Pure math: the renderer projects these heights through
 * the shared camera (arrival, scroll, pointer); layers never move on
 * their own.
 */

import { seededRandom } from "@/features/sky/star-field";

export type MountainLayer = {
  id: string;
  /** 0 = deepest haze, 1 = nearest foreground. Drives parallax and scroll. */
  depth: number;
  /** Fill at the ridge line and at the base (vertical gradient). */
  colorTop: string;
  colorBottom: string;
  /** The cold moonlit separation along the ridge. */
  rimAlpha: number;
  /** Ridge band height as a fraction of the viewport at rest. */
  band: number;
  /** How deep the central valley cuts into this layer (0–1 of its band). */
  valley: number;
  /** Contour character. */
  roughness: number;
  seed: number;
};

/** Distant haze → two background ranges → midground → near-black foreground. */
export const MOUNTAIN_LAYERS: MountainLayer[] = [
  {
    id: "haze",
    depth: 0.08,
    colorTop: "#131c22",
    colorBottom: "#0c1318",
    rimAlpha: 0.1,
    band: 0.16,
    valley: 0.25,
    roughness: 0.35,
    seed: 0xa11,
  },
  {
    id: "far-a",
    depth: 0.24,
    colorTop: "#0e161c",
    colorBottom: "#091015",
    rimAlpha: 0.16,
    band: 0.185,
    valley: 0.4,
    roughness: 0.5,
    seed: 0xb22,
  },
  {
    id: "far-b",
    depth: 0.42,
    colorTop: "#0a1116",
    colorBottom: "#070c10",
    rimAlpha: 0.2,
    band: 0.2,
    valley: 0.55,
    roughness: 0.62,
    seed: 0xc33,
  },
  {
    id: "mid",
    depth: 0.66,
    colorTop: "#070c10",
    colorBottom: "#04070a",
    rimAlpha: 0.24,
    band: 0.22,
    valley: 0.72,
    roughness: 0.75,
    seed: 0xd44,
  },
  {
    id: "near",
    depth: 1,
    colorTop: "#030507",
    colorBottom: "#010203",
    rimAlpha: 0.16,
    band: 0.24,
    valley: 0.88,
    roughness: 0.9,
    seed: 0xe55,
  },
];

/** Mobile keeps the silhouette in three layers: haze, background, foreground. */
export const MOUNTAIN_LAYERS_MOBILE: MountainLayer[] = [
  MOUNTAIN_LAYERS[0]!,
  MOUNTAIN_LAYERS[2]!,
  MOUNTAIN_LAYERS[4]!,
];

/** Smooth cosine interpolation between lattice values — rounded, organic. */
function smooth(a: number, b: number, t: number): number {
  const u = (1 - Math.cos(t * Math.PI)) / 2;
  return a * (1 - u) + b * u;
}

/** One octave of seeded 1D value noise sampled at x (period 1 = `cells`). */
function valueNoise(seed: number, cells: number, x: number): number {
  const random = seededRandom(seed);
  const lattice: number[] = [];
  for (let i = 0; i <= cells; i++) lattice.push(random());
  const scaled = Math.min(0.9999, Math.max(0, x)) * cells;
  const i = Math.floor(scaled);
  return smooth(lattice[i]!, lattice[i + 1]!, scaled - i);
}

/**
 * Ridge elevation profile for a layer: `samples` heights in [0, 1] across
 * x ∈ [0, 1], with the central valley opening carved in. Deterministic for
 * a given layer.
 */
export function ridgeHeights(layer: MountainLayer, samples: number): number[] {
  const heights: number[] = [];
  for (let s = 0; s < samples; s++) {
    const x = samples === 1 ? 0 : s / (samples - 1);
    // Three octaves of rounded noise; higher layers stay calmer.
    const n =
      valueNoise(layer.seed, 5, x) * 0.62 +
      valueNoise(layer.seed * 31 + 7, 11, x) * 0.28 * layer.roughness +
      valueNoise(layer.seed * 131 + 3, 23, x) * 0.1 * layer.roughness;
    // The valley: a smooth central dip, deeper for nearer layers.
    const d = x - 0.5;
    const dip = layer.valley * Math.exp(-(d * d) / (2 * 0.14 * 0.14));
    const h = (0.35 + 0.65 * n) * (1 - dip * 0.85);
    heights.push(Math.min(1, Math.max(0.04, h)));
  }
  return heights;
}
