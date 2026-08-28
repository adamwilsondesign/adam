/**
 * In-memory Work exploration state, surviving route changes.
 *
 * The Work grid stays mounted beneath case-study overlays, so filters, order,
 * zoom and pan trivially survive opening and closing a case. This store covers
 * the other traversal — leaving for the homepage and coming back — by keeping
 * the last exploration snapshot for the life of the JS session. Nothing here
 * is shareable state by design: URLs carry only case-study slugs, and a hard
 * reload intentionally starts a fresh composition.
 */

import type { WorkTag, YearRange } from "@/lib/content/model";

export type WorkSnapshot = {
  /** The explicit All selection (false with no tags = the deliberate void). */
  all: boolean;
  tags: WorkTag[];
  years: YearRange;
  /** Display order of the visible client ids. */
  order: string[];
  /** Session seed for canonical newcomer ordering. */
  seed: number;
};

export type CanvasSnapshot = {
  cellSize: number;
  x: number;
  y: number;
};

let workSnapshot: WorkSnapshot | null = null;
let canvasSnapshot: CanvasSnapshot | null = null;

export function saveWorkSnapshot(snapshot: WorkSnapshot): void {
  workSnapshot = snapshot;
}

export function readWorkSnapshot(): WorkSnapshot | null {
  return workSnapshot;
}

export function saveCanvasSnapshot(snapshot: CanvasSnapshot): void {
  canvasSnapshot = snapshot;
}

export function readCanvasSnapshot(): CanvasSnapshot | null {
  return canvasSnapshot;
}
