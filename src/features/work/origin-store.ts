"use client";

/**
 * Hands the clicked logo's geometry from the Work grid to the case-study
 * overlay (which mounts in a different route slot), so the overlay can run
 * its shared-element entrance from the exact cell the user clicked.
 *
 * The overlay consumes the origin once; direct URL loads find nothing and
 * fall back to a plain fade-in. `readOrigin` (non-consuming) lets the grid
 * keep the source cell hidden while its case study is open.
 */

export type CaseOrigin = {
  slug: string;
  rect: { x: number; y: number; width: number; height: number };
  logoUrl: string;
};

let origin: CaseOrigin | null = null;

export function setCaseOrigin(next: CaseOrigin): void {
  origin = next;
}

export function consumeCaseOrigin(slug: string): CaseOrigin | null {
  if (origin?.slug !== slug) return null;
  const value = origin;
  return value;
}

export function clearCaseOrigin(): void {
  origin = null;
}

/**
 * The rect a closing overlay should travel back to: the live position of the
 * source cell's logo, queried at close time so grid reflows are respected.
 */
export function findCaseCellRect(slug: string): CaseOrigin["rect"] | null {
  const mask = document.querySelector(`[data-case-cell="${slug}"] [data-logo-mask]`);
  const rect = mask?.getBoundingClientRect();
  return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
}
