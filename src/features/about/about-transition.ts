"use client";

/**
 * Coordination for the homepage → About descent, mirroring the sky
 * director's work-entrance flag. The homepage marks an arrival pending when
 * the About link is activated; the About page consumes it on mount to decide
 * between the full descent and the settled environment (direct loads,
 * refreshes and stale history entries land settled).
 */

import { SKY_DISABLED } from "@/features/sky/sky-director";

/** A pending arrival expires if About doesn't mount promptly after the click. */
const PENDING_ARRIVAL_TTL = 2500;

let pendingArrivalAt: number | null = null;

/** The homepage About link was activated: the next About mount descends. */
export function beginAboutArrival(): void {
  if (SKY_DISABLED) return;
  pendingArrivalAt = performance.now();
}

/**
 * Should this About mount play the arrival descent? Reading is idempotent
 * (StrictMode double-invokes state initializers); the flag clears when the
 * scene actually claims the arrival.
 */
export function consumeAboutArrival(): boolean {
  if (SKY_DISABLED || pendingArrivalAt === null) return false;
  return performance.now() - pendingArrivalAt < PENDING_ARRIVAL_TTL;
}

/** The descent started (or was abandoned); later mounts land settled. */
export function claimAboutArrival(): void {
  pendingArrivalAt = null;
}
