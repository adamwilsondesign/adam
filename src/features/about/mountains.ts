/**
 * The About page's nighttime range: layer configuration.
 *
 * Five atmospheric layers (three on mobile) rise into the lower quarter of
 * the viewport, from distant haze to a near foreground, with a central
 * valley opening for the content. Each layer is a real heightfield rendered
 * in perspective and lit by an off-canvas moon — see terrain.ts. The scene
 * projects the baked layers through the shared camera (arrival, scroll,
 * pointer); layers never move on their own.
 */

export type MountainLayer = {
  id: string;
  /** 0 = deepest haze, 1 = nearest foreground. Drives parallax and scroll. */
  depth: number;
  /** Atmospheric wash toward the horizon color (1 = distant, 0 = near). */
  haze: number;
  /** Ridge band height as a fraction of the viewport at rest. */
  band: number;
  /** How deep the central valley cuts into this layer (0–1). */
  valley: number;
  /** Contour character. */
  roughness: number;
  seed: number;
};

/** Distant haze → two background ranges → midground → near foreground. */
export const MOUNTAIN_LAYERS: MountainLayer[] = [
  { id: "haze", depth: 0.08, haze: 0.86, band: 0.18, valley: 0.25, roughness: 0.35, seed: 0xa11 },
  { id: "far-a", depth: 0.24, haze: 0.66, band: 0.21, valley: 0.4, roughness: 0.5, seed: 0xb22 },
  { id: "far-b", depth: 0.42, haze: 0.46, band: 0.24, valley: 0.55, roughness: 0.62, seed: 0xc33 },
  { id: "mid", depth: 0.66, haze: 0.23, band: 0.27, valley: 0.72, roughness: 0.75, seed: 0xd44 },
  { id: "near", depth: 1, haze: 0.055, band: 0.3, valley: 0.88, roughness: 0.9, seed: 0xe55 },
];

/** Mobile keeps the silhouette in three layers: haze, background, foreground. */
export const MOUNTAIN_LAYERS_MOBILE: MountainLayer[] = [
  MOUNTAIN_LAYERS[0]!,
  MOUNTAIN_LAYERS[2]!,
  MOUNTAIN_LAYERS[4]!,
];
