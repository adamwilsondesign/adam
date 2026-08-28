/**
 * Optical logo normalization.
 *
 * Grid cells are equal, but logos are not: a wide wordmark rendered at the
 * same contain-fit as a compact symbol reads far smaller, and a dense square
 * mark reads far heavier. This module converts a logo's intrinsic aspect
 * ratio into a bounding box (as percentages of the cell) whose *perceived*
 * size is consistent: boxes are area-normalized, then clamped so wide marks
 * never touch the cell edges and tall marks keep headroom.
 *
 * Per-client overrides (`WorkClient.logoTreatment`) are exceptional — scale
 * multiplies the automatic size, padding shrinks the available cell, and
 * alignment shifts the box off-center. Future Sanity mapping is documented
 * in README.md ("Optical logo fields").
 */

import type { LogoTreatment } from "@/lib/content/model";

export type OpticalBox = {
  /** Box width as a percentage of the cell width. */
  widthPct: number;
  /** Box height as a percentage of the cell height. */
  heightPct: number;
  alignment: "center" | "start" | "end";
};

/** Fraction of the cell's area a mark should visually occupy. */
const TARGET_AREA = 0.17;
/** No mark may exceed these fractions of the cell, whatever its shape. */
const MAX_WIDTH = 0.78;
const MAX_HEIGHT = 0.58;
/** Guard rails for degenerate data. */
const MIN_ASPECT = 0.3;
const MAX_ASPECT = 9;

export function opticalLogoBox(
  aspect: number | null | undefined,
  treatment?: LogoTreatment | null,
): OpticalBox {
  const a = Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, aspect || 1));

  // Area-normalized box: width × height = TARGET_AREA, width / height = a
  // (in cell-fraction units, treating the cell as the unit square).
  let width = Math.sqrt(TARGET_AREA * a);
  let height = Math.sqrt(TARGET_AREA / a);

  const scale = clamp(treatment?.scale ?? 1, 0.5, 1.5);
  width *= scale;
  height *= scale;

  const padding = clamp(treatment?.padding ?? 0, 0, 0.2);
  const maxWidth = Math.max(0.1, MAX_WIDTH - padding * 2);
  const maxHeight = Math.max(0.1, MAX_HEIGHT - padding * 2);

  // Clamp while preserving the aspect of the box (the mask contain-fits
  // inside it, so the mark's own ratio is always preserved regardless).
  if (width > maxWidth) {
    height *= maxWidth / width;
    width = maxWidth;
  }
  if (height > maxHeight) {
    width *= maxHeight / height;
    height = maxHeight;
  }

  return {
    widthPct: round2(width * 100),
    heightPct: round2(height * 100),
    alignment: treatment?.alignment ?? "center",
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
