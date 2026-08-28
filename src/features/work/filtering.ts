/**
 * Engagement-aware filtering for the Work grid.
 *
 * A client is visible when at least one of its engagements BOTH carries an
 * active tag (inclusive OR across tags) AND overlaps the selected year range
 * (inclusive on both ends). Tag and years must match the same engagement.
 *
 * Zero-result interactions are prevented here: tag toggles that would empty
 * the grid are rejected, and slider movements are returned to the nearest
 * valid position.
 */

import {
  WORK_TAGS,
  type Engagement,
  type WorkClient,
  type WorkTag,
  type YearRange,
} from "@/lib/content/model";

export type WorkFilter = {
  tags: WorkTag[];
  years: YearRange;
};

export function defaultFilter(range: YearRange): WorkFilter {
  return { tags: [...WORK_TAGS], years: { ...range } };
}

export function engagementMatches(engagement: Engagement, filter: WorkFilter): boolean {
  return (
    engagement.startYear <= filter.years.end &&
    engagement.endYear >= filter.years.start &&
    engagement.tags.some((tag) => filter.tags.includes(tag))
  );
}

export function clientMatches(client: WorkClient, filter: WorkFilter): boolean {
  return client.engagements.some((engagement) => engagementMatches(engagement, filter));
}

export function filterClients(clients: WorkClient[], filter: WorkFilter): WorkClient[] {
  return clients.filter((client) => clientMatches(client, filter));
}

export function countMatches(clients: WorkClient[], filter: WorkFilter): number {
  let count = 0;
  for (const client of clients) if (clientMatches(client, filter)) count += 1;
  return count;
}

export type TagToggleResult = {
  filter: WorkFilter;
  rejected: boolean;
};

/**
 * Toggles a tag, preserving the canonical tag order. A toggle that would
 * leave zero visible clients is rejected and the previous filter returned.
 */
export function toggleTag(
  clients: WorkClient[],
  filter: WorkFilter,
  tag: WorkTag,
): TagToggleResult {
  const active = filter.tags.includes(tag);
  const nextTags = active
    ? filter.tags.filter((t) => t !== tag)
    : WORK_TAGS.filter((t) => filter.tags.includes(t) || t === tag);
  const next: WorkFilter = { ...filter, tags: nextTags };
  if (nextTags.length === 0 || countMatches(clients, next) === 0) {
    return { filter, rejected: true };
  }
  return { filter: next, rejected: false };
}

export type YearChangeResult = {
  years: YearRange;
  adjusted: boolean;
};

/**
 * Applies a year-handle movement, returning the nearest valid range when the
 * requested one would produce zero results. `moved` names the handle the
 * user is dragging; only that end is walked back toward validity.
 */
export function clampYearRange(
  clients: WorkClient[],
  filter: WorkFilter,
  requested: YearRange,
  moved: "start" | "end",
  bounds: YearRange,
): YearChangeResult {
  const clampedRequest: YearRange = {
    start: Math.max(bounds.start, Math.min(requested.start, bounds.end)),
    end: Math.max(bounds.start, Math.min(requested.end, bounds.end)),
  };
  if (clampedRequest.start > clampedRequest.end) {
    if (moved === "start") clampedRequest.start = clampedRequest.end;
    else clampedRequest.end = clampedRequest.start;
  }

  const attempt = (years: YearRange) => countMatches(clients, { ...filter, years }) > 0;

  if (attempt(clampedRequest)) {
    const adjusted =
      clampedRequest.start !== requested.start || clampedRequest.end !== requested.end;
    return { years: clampedRequest, adjusted };
  }

  // Walk the moved handle back toward the widened range until results return.
  if (moved === "start") {
    for (let start = clampedRequest.start - 1; start >= bounds.start; start--) {
      const candidate = { start, end: clampedRequest.end };
      if (attempt(candidate)) return { years: candidate, adjusted: true };
    }
  } else {
    for (let end = clampedRequest.end + 1; end <= bounds.end; end++) {
      const candidate = { start: clampedRequest.start, end };
      if (attempt(candidate)) return { years: candidate, adjusted: true };
    }
  }

  // Nothing valid in that direction (e.g. the other handle pinned an empty
  // region) — keep the previous, known-valid range.
  return { years: { ...filter.years }, adjusted: true };
}
