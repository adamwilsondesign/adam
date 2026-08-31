/**
 * Sibling navigation between case studies.
 *
 * The next/previous sequence follows the filtered Work composition when one
 * exists in this session (the in-memory snapshot holds the visible client
 * ids in display order); otherwise it falls back to the full case-study
 * list in index order. Navigation wraps, so "next" always progresses.
 */

import { readWorkSnapshot } from "@/features/work/work-state-store";

export type CaseSibling = {
  slug: string;
  title: string;
  clientId: string;
  clientName: string;
  logoUrl: string;
  logoAspect: number;
};

export type SiblingPair = {
  prev: CaseSibling | null;
  next: CaseSibling | null;
};

/** Pure core: `order` is the visible-client id order, or null for no filter. */
export function resolveSiblings(
  all: CaseSibling[],
  order: readonly string[] | null,
  currentSlug: string,
): SiblingPair {
  let list = all;
  if (order && order.length > 0) {
    const position = new Map(order.map((id, index) => [id, index]));
    const filtered = all
      .filter((sibling) => position.has(sibling.clientId))
      .sort((a, b) => position.get(a.clientId)! - position.get(b.clientId)!);
    // Only adopt the filtered view when the current study is part of it —
    // a direct load outside the filter keeps the full sequence.
    if (filtered.some((sibling) => sibling.slug === currentSlug)) list = filtered;
  }
  const index = list.findIndex((sibling) => sibling.slug === currentSlug);
  if (index === -1 || list.length < 2) return { prev: null, next: null };
  return {
    prev: list[(index - 1 + list.length) % list.length] ?? null,
    next: list[(index + 1) % list.length] ?? null,
  };
}

/** Session-aware wrapper: orders by the current Work composition. */
export function orderedCaseSiblings(all: CaseSibling[], currentSlug: string): SiblingPair {
  return resolveSiblings(all, readWorkSnapshot()?.order ?? null, currentSlug);
}

/** The full case-study list in the session's composition order (pure core). */
export function resolveCaseList(
  all: CaseSibling[],
  order: readonly string[] | null,
  currentSlug: string,
): CaseSibling[] {
  if (!order || order.length === 0) return all;
  const position = new Map(order.map((id, index) => [id, index]));
  const filtered = all
    .filter((sibling) => position.has(sibling.clientId))
    .sort((a, b) => position.get(a.clientId)! - position.get(b.clientId)!);
  return filtered.some((sibling) => sibling.slug === currentSlug) ? filtered : all;
}

/** Session-aware wrapper for the full ordered list. */
export function orderedCaseList(all: CaseSibling[], currentSlug: string): CaseSibling[] {
  return resolveCaseList(all, readWorkSnapshot()?.order ?? null, currentSlug);
}
