/**
 * Moonlit 3D terrain for the About range.
 *
 * Each mountain layer is a genuine heightfield rendered in perspective —
 * rows of terrain march from near to far behind a per-column horizon buffer
 * (the classic voxel-terrain projection), every column is lit by its surface
 * normal against a single directional moon sitting low off-canvas to the
 * upper right, and distance dissolves into the horizon haze. Lighting is
 * interpolated smoothly across columns and fades within each span, so faces
 * read as continuous rock rather than facets. The result is baked once per
 * resize and composited by the scene with the shared camera transforms.
 *
 * The projection pass (`terrainHeight`, `projectRow`) is pure math so it can
 * be unit-tested in Node; `renderTerrainLayer` rasterizes into a canvas.
 */

import type { MountainLayer } from "./mountains";

/** The moon's direction (x right, y up, z toward the viewer): low to the
 *  upper right, so faces catch strong side light while flat ground stays
 *  dark — the classic night-range read. */
const MOON = (() => {
  const v = [0.72, 0.3, -0.22];
  const len = Math.hypot(v[0]!, v[1]!, v[2]!);
  return { x: v[0]! / len, y: v[1]! / len, z: v[2]! / len };
})();

/** Night palette shared by every layer; per-layer haze does the depth cue.
 *  Kept deliberately dim — moonlight suggests, it never floodlights. */
const LIT: [number, number, number] = [124, 142, 163];
const SHADOW: [number, number, number] = [5, 8, 12];
const HORIZON: [number, number, number] = [24, 32, 42];

/** Terrain grid: rows recede into depth, columns run across the frame. */
const ROWS = 92;
const COLS = 260;
const D_NEAR = 1;
const D_FAR = 2.3;
/** Half-extent of the terrain in u, so panning/zoom never shows an edge. */
const U_SPAN = 1.6;
/** World depth of one layer slice, in noise units. */
const Z_THICKNESS = 1.9;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Integer-lattice hash → [0, 1). Deterministic and allocation-free. */
function hash2(seed: number, x: number, y: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smoothly interpolated 2D value noise on the integer lattice. */
function valueNoise2(seed: number, x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(seed, xi, yi);
  const b = hash2(seed, xi + 1, yi);
  const c = hash2(seed, xi, yi + 1);
  const d = hash2(seed, xi + 1, yi + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

/** Ridged fractal noise: sharp crests, softer basins — rock, not clouds. */
function ridgedFbm(seed: number, x: number, y: number, octaves: number): number {
  let sum = 0;
  let amp = 0.55;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    const n = valueNoise2(seed + o * 101, x * freq, y * freq);
    sum += (1 - Math.abs(2 * n - 1)) * amp;
    norm += amp;
    amp *= 0.48;
    freq *= 2.1;
  }
  return sum / norm;
}

/**
 * Terrain elevation at (u, v) for a layer: u runs across the frame
 * (±U_SPAN), v runs 0 (far edge) → 1 (near edge). Ridged noise raised to a
 * power keeps crests sharp; the central valley carves through, widening
 * toward the viewer; amplitude eases off toward the near edge so the slice
 * reads as range behind, foothills in front.
 */
export function terrainHeight(layer: MountainLayer, u: number, v: number): number {
  const zw = (1 - v) * Z_THICKNESS;
  const rough = 0.75 + 0.5 * layer.roughness;
  const ridged = ridgedFbm(layer.seed, u * 1.6 * rough, zw * 1.3, 4);
  const sharp = Math.pow(ridged, 1.22);
  const sigma = 0.18 * (1 + 0.9 * v);
  const carve = 1 - layer.valley * 0.92 * Math.exp(-(u * u) / (2 * sigma * sigma));
  const amp = 1 - 0.45 * v;
  return sharp * carve * amp;
}

export type ProjectedRow = {
  /** Screen x per column sample (monotonically increasing). */
  xs: Float32Array;
  /** Screen y of the terrain surface per column sample. */
  ys: Float32Array;
  /** Final light per column sample, 0 shadow → 1 moonlit. */
  lights: Float32Array;
  /** Atmospheric mix toward the horizon color for this row. */
  fog: number;
};

/**
 * Projects one depth row of a layer's heightfield into bitmap space
 * (width × height) and lights it: perspective foreshortening, Lambert
 * shading against the moon, night falloff toward the near valley floor.
 */
export function projectRow(
  layer: MountainLayer,
  v: number,
  width: number,
  height: number,
): ProjectedRow {
  const du = 0.032;
  const dv = 0.032;
  const distance = mix(D_FAR, D_NEAR, v);
  const persp = 1 / distance;
  const groundY = height * (0.286 + 0.734 * persp);
  /* Far layers carry the tall peaks; near layers stay foothills, so the
     stacked bands read as one range receding into haze. */
  const heightScale = height * persp * mix(1.42, 0.85, layer.depth);
  const xScale = (width / 2) * (0.55 + 0.5 * persp);
  const fog = layer.haze + (1 - layer.haze) * 0.6 * ((distance - D_NEAR) / (D_FAR - D_NEAR));
  const contrast = (0.55 + 0.45 * layer.depth) * (1 - 0.25 * (1 - persp)) * 0.82;

  const xs = new Float32Array(COLS + 1);
  const ys = new Float32Array(COLS + 1);
  const lights = new Float32Array(COLS + 1);

  for (let iu = 0; iu <= COLS; iu++) {
    const u = -U_SPAN + (2 * U_SPAN * iu) / COLS;
    const h = terrainHeight(layer, u, v);
    xs[iu] = width / 2 + (u / U_SPAN) * xScale;
    ys[iu] = groundY - h * heightScale;

    /* Surface normal from local slopes; Lambert against the moon. */
    const dhdu = (terrainHeight(layer, u + du, v) - terrainHeight(layer, u - du, v)) / (2 * du);
    const dhdv =
      (terrainHeight(layer, u, Math.min(1, v + dv)) -
        terrainHeight(layer, u, Math.max(0, v - dv))) /
      (2 * dv);
    const nx = -dhdu * 0.5;
    const ny = 1;
    const nz = (dhdv / Z_THICKNESS) * 0.9;
    const nl = Math.hypot(nx, ny, nz);
    const lambert = clamp01((nx * MOON.x + ny * MOON.y + nz * MOON.z) / nl);

    let light = Math.pow(lambert, 1.8) * contrast;
    /* High crests catch a little extra silver. */
    light += 0.09 * h * clamp01(lambert - 0.4);
    /* The valley floor nearest the camera falls into night shadow and
       settles to one quiet tone (its extrusion forms the layer base). */
    light *= mix(1, 0.4, v * v);
    const settle = clamp01((v - 0.7) / 0.3);
    lights[iu] = clamp01(mix(light, 0.035, settle * settle * 0.9));
  }

  return { xs, ys, lights, fog };
}

/**
 * Rasterizes a layer into `target` at width × height: rows near → far
 * behind a per-column horizon buffer, colors interpolated across columns
 * and faded within each span, finished with a soft rock grain.
 */
export function renderTerrainLayer(
  target: HTMLCanvasElement,
  layer: MountainLayer,
  width: number,
  height: number,
): string {
  target.width = width;
  target.height = height;
  const ctx = target.getContext("2d")!;
  const image = ctx.createImageData(width, height);
  const data = image.data;

  /* Highest painted pixel per column; rows behind only paint above it. */
  const horizon = new Int32Array(width).fill(height);

  for (let iv = ROWS - 1; iv >= 0; iv--) {
    const v = iv / (ROWS - 1);
    const row = projectRow(layer, v, width, height);
    const fog = row.fog;

    for (let iu = 0; iu < COLS; iu++) {
      const x0 = row.xs[iu]!;
      const x1 = row.xs[iu + 1]!;
      const from = Math.max(0, Math.ceil(x0));
      const to = Math.min(width - 1, Math.floor(x1));
      for (let x = from; x <= to; x++) {
        const t = x1 > x0 ? (x - x0) / (x1 - x0) : 0;
        const yTop = row.ys[iu]! + (row.ys[iu + 1]! - row.ys[iu]!) * t;
        const bottom = horizon[x]!;
        if (yTop >= bottom) continue;

        const light = row.lights[iu]! + (row.lights[iu + 1]! - row.lights[iu]!) * t;
        const r = mix(mix(SHADOW[0]!, LIT[0]!, light), HORIZON[0]!, fog);
        const g = mix(mix(SHADOW[1]!, LIT[1]!, light), HORIZON[1]!, fog);
        const b = mix(mix(SHADOW[2]!, LIT[2]!, light), HORIZON[2]!, fog);

        const yStart = Math.max(0, Math.floor(yTop));
        /* Anti-alias only the true skyline (first paint in a column, against
           the sky); interior crests stay opaque — a translucent pixel there
           would blend with nothing and speckle the faces. */
        const skyline = bottom === height;
        for (let y = yStart; y < bottom && y < height; y++) {
          /* Faces darken slightly away from their crest. */
          const fade = 1 - Math.min(1, (y - yTop) / (height * 0.6)) * 0.14;
          const o = (y * width + x) * 4;
          data[o] = r * fade;
          data[o + 1] = g * fade;
          data[o + 2] = b * fade;
          data[o + 3] =
            skyline && y === yStart ? Math.round(255 * clamp01(yStart + 1 - yTop)) : 255;
        }
        horizon[x] = yStart;
      }
    }
  }

  /* Soft rock grain: gentle multiplicative noise, alpha preserved — enough
     to keep large faces organic, quiet enough to never read as static. */
  const fs = 3.4 / height;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      if (data[o + 3] === 0) continue;
      const n = ridgedFbm(layer.seed ^ 0x9e37, x * fs, y * fs * 0.8, 2);
      const gain = 0.94 + 0.12 * n;
      data[o] = Math.min(255, data[o]! * gain);
      data[o + 1] = Math.min(255, data[o + 1]! * gain);
      data[o + 2] = Math.min(255, data[o + 2]! * gain);
    }
  }
  ctx.putImageData(image, 0, 0);

  const base = [0, 1, 2].map((i) => Math.round(mix(SHADOW[i]!, HORIZON[i]!, layer.haze) * 0.75));
  return `rgb(${base[0]}, ${base[1]}, ${base[2]})`;
}
