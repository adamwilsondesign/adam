/**
 * Sanity environment configuration.
 *
 * Only `NEXT_PUBLIC_*` values may reach the browser. The read token stays
 * server-side: it is consumed by `defineLive` and the draft-mode route and is
 * never imported from client components.
 */

export const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "";

export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";

export const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? "2025-08-01";

/**
 * True when a Sanity project is connected. The content facade
 * (src/lib/content) switches from the fixture adapter to the Content Lake
 * automatically based on this flag.
 */
export const isSanityConfigured = /^[a-z0-9-]+$/.test(projectId);

/**
 * Placeholder used so Sanity modules can be imported (never fetched) while no
 * project is configured, e.g. during fixture-driven development and tests.
 */
export const effectiveProjectId = isSanityConfigured ? projectId : "unconfigured";

/** Server-only read token; used for draft previews and live draft content. */
export function readToken(): string | undefined {
  return process.env.SANITY_API_READ_TOKEN || undefined;
}
