"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { track } from "@/lib/analytics";
import { isWorkTag, type WorkClient, type WorkTag, type YearRange } from "@/lib/content/model";

import {
  blockedTags,
  clampYearRange,
  defaultFilter,
  filterClients,
  isAllSelected,
  selectAll,
  toggleTag as applyTagToggle,
  type WorkFilter,
} from "./filtering";
import { newSeed, nextOrder, orderForSeed, shuffleWithSeed } from "./shuffle";
import { readWorkSnapshot, saveWorkSnapshot } from "./work-state-store";

const APPLY_DEBOUNCE_MS = 150;
const KEYBOARD_SETTLE_MS = 600;
const POINTER_SETTLE_MS = 200;

export type RejectionPulse = { tag: WorkTag; key: number };

export type WorkState = {
  bounds: YearRange;
  activeTags: WorkTag[];
  /** True while the explicit All chip is the selection. */
  allSelected: boolean;
  /** Tags whose toggle would currently empty the grid. */
  blockedTags: Set<WorkTag>;
  /** The validated, displayed year range (slider position). */
  years: YearRange;
  /** Clients passing the applied filter, in the current composition order. */
  visibleClients: WorkClient[];
  totalCount: number;
  announcement: string;
  rejectionPulse: RejectionPulse | null;
  onToggleTag: (tag: WorkTag) => void;
  onSelectAll: () => void;
  onShuffle: () => void;
  onYearsChange: (candidate: YearRange, moved: "start" | "end") => void;
  onYearsInteractionEnd: () => void;
};

type InitialState = {
  filter: WorkFilter;
  seed: number;
  order: string[];
};

function buildInitialState(clients: WorkClient[], bounds: YearRange): InitialState {
  const stored = readWorkSnapshot();
  if (stored) {
    const known = new Set(clients.map((client) => client.id));
    const tags = stored.tags.filter(isWorkTag);
    const years = {
      start: Math.max(bounds.start, Math.min(stored.years.start, bounds.end)),
      end: Math.max(bounds.start, Math.min(stored.years.end, bounds.end)),
    };
    const filter: WorkFilter = { tags, years };
    const visible = new Set(filterClients(clients, filter).map((client) => client.id));
    const order = stored.order.filter((id) => known.has(id) && visible.has(id));
    if (order.length === visible.size && filterClients(clients, filter).length > 0) {
      return { filter, seed: stored.seed, order };
    }
  }
  // Fresh entrance: randomized composition for the full (or default) set.
  const filter = defaultFilter(bounds);
  const seed = newSeed();
  return {
    filter,
    seed,
    order: shuffleWithSeed(
      filterClients(clients, filter).map((client) => client.id),
      seed,
    ),
  };
}

/**
 * All interactive Work state. Lives in the grid page component, which stays
 * mounted while case-study overlays are open — so every overlay dismissal
 * returns to the exact previous composition. Order continuity: the initial
 * entrance is randomized once; afterwards survivors keep their relative
 * positions (gaps collapse forward) and newcomers append in a deterministic
 * per-session order. The full composition only re-randomizes via Shuffle.
 */
export function useWorkState(clients: WorkClient[], bounds: YearRange): WorkState {
  const [initial] = useState<InitialState>(() => buildInitialState(clients, bounds));
  const [filter, setFilter] = useState<WorkFilter>(initial.filter);
  const [years, setYears] = useState<YearRange>({ ...initial.filter.years });
  const [displayOrder, setDisplayOrder] = useState<string[]>(initial.order);
  const [announcement, setAnnouncement] = useState("");
  const [rejectionPulse, setRejectionPulse] = useState<RejectionPulse | null>(null);

  const sessionSeed = initial.seed;
  const applyTimer = useRef<number | null>(null);
  const settleTimer = useRef<number | null>(null);
  const pendingYears = useRef<YearRange | null>(null);
  const filterRef = useRef(filter);
  const orderRef = useRef(displayOrder);
  useEffect(() => {
    filterRef.current = filter;
    orderRef.current = displayOrder;
  }, [filter, displayOrder]);

  /** Canonical per-session order used to place newcomers deterministically. */
  const canonicalOrder = useMemo(
    () =>
      orderForSeed(
        clients.map((client) => client.id),
        sessionSeed,
      ),
    [clients, sessionSeed],
  );

  useEffect(
    () => () => {
      if (applyTimer.current !== null) window.clearTimeout(applyTimer.current);
      if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
    },
    [],
  );

  const persist = useCallback(
    (nextFilter: WorkFilter, order: string[]) => {
      saveWorkSnapshot({
        tags: nextFilter.tags,
        years: nextFilter.years,
        order,
        seed: sessionSeed,
      });
    },
    [sessionSeed],
  );

  /** Applies a new filter and the continuity-preserving order in one commit. */
  const commitFilter = useCallback(
    (nextFilter: WorkFilter) => {
      const visibleIds = filterClients(clients, nextFilter).map((client) => client.id);
      const order = nextOrder(orderRef.current, visibleIds, canonicalOrder);
      orderRef.current = order;
      filterRef.current = nextFilter;
      setFilter(nextFilter);
      setDisplayOrder(order);
      persist(nextFilter, order);
      return visibleIds.length;
    },
    [clients, canonicalOrder, persist],
  );

  const onToggleTag = useCallback(
    (tag: WorkTag) => {
      const current = filterRef.current;
      const result = applyTagToggle(clients, current, tag);
      const wasActive = current.tags.includes(tag);
      track({ name: "work_tag_toggled", tag, active: !wasActive, rejected: result.rejected });
      if (result.rejected) {
        setRejectionPulse((previous) => ({ tag, key: (previous?.key ?? 0) + 1 }));
        setAnnouncement(
          `${wasActive ? "Removing" : "Selecting"} “${tag}” would show no work for the selected years, so the filter was kept.`,
        );
        return;
      }
      const count = commitFilter(result.filter);
      setAnnouncement(
        isAllSelected(result.filter)
          ? `All ${clients.length} clients shown.`
          : `${count} of ${clients.length} clients shown.`,
      );
    },
    [clients, commitFilter],
  );

  const onSelectAll = useCallback(() => {
    const current = filterRef.current;
    if (isAllSelected(current)) return;
    track({ name: "work_tags_cleared" });
    const count = commitFilter(selectAll(current));
    setAnnouncement(`All tags — ${count} of ${clients.length} clients shown.`);
  }, [clients.length, commitFilter]);

  const onShuffle = useCallback(() => {
    const shuffled = shuffleWithSeed(orderRef.current, newSeed());
    orderRef.current = shuffled;
    setDisplayOrder(shuffled);
    persist(filterRef.current, shuffled);
    track({ name: "work_shuffled" });
    setAnnouncement("Composition shuffled.");
  }, [persist]);

  const flushYears = useCallback(() => {
    if (applyTimer.current !== null) {
      window.clearTimeout(applyTimer.current);
      applyTimer.current = null;
    }
    const pending = pendingYears.current;
    if (!pending) return;
    pendingYears.current = null;
    commitFilter({ ...filterRef.current, years: pending });
  }, [commitFilter]);

  const lastAnnouncedYears = useRef<string>("");
  const settle = useCallback(() => {
    if (settleTimer.current !== null) {
      window.clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
    flushYears();
    const current = filterRef.current;
    const key = `${current.years.start}-${current.years.end}`;
    if (key !== lastAnnouncedYears.current) {
      lastAnnouncedYears.current = key;
      track({ name: "work_years_changed", start: current.years.start, end: current.years.end });
      const count = filterClients(clients, current).length;
      setAnnouncement(
        `${count} of ${clients.length} clients shown for ${current.years.start} to ${current.years.end}.`,
      );
    }
  }, [clients, flushYears]);

  const onYearsChange = useCallback(
    (candidate: YearRange, moved: "start" | "end") => {
      const current = filterRef.current;
      const result = clampYearRange(clients, current, candidate, moved, bounds);
      setYears(result.years);
      if (result.adjusted) {
        setAnnouncement(
          `Year range held at ${result.years.start}–${result.years.end} to keep results visible.`,
        );
      }
      // Results update continuously but debounced, never per pointer pixel.
      pendingYears.current = result.years;
      if (applyTimer.current !== null) window.clearTimeout(applyTimer.current);
      applyTimer.current = window.setTimeout(flushYears, APPLY_DEBOUNCE_MS);

      if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
      settleTimer.current = window.setTimeout(settle, KEYBOARD_SETTLE_MS);
    },
    [clients, bounds, flushYears, settle],
  );

  const onYearsInteractionEnd = useCallback(() => {
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(settle, POINTER_SETTLE_MS);
  }, [settle]);

  /**
   * Defensive projection: displayOrder is the intent, but live content
   * updates can change the client set under us — anything missing from the
   * order (or filtered out since) is reconciled here without re-rendering.
   */
  const visibleClients = useMemo(() => {
    const matching = filterClients(clients, filter);
    const byId = new Map(matching.map((client) => [client.id, client]));
    const ordered: WorkClient[] = [];
    for (const id of displayOrder) {
      const client = byId.get(id);
      if (client) {
        ordered.push(client);
        byId.delete(id);
      }
    }
    for (const client of matching) {
      if (byId.has(client.id)) ordered.push(client);
    }
    return ordered;
  }, [clients, filter, displayOrder]);

  const blocked = useMemo(() => blockedTags(clients, filter), [clients, filter]);

  return {
    bounds,
    activeTags: filter.tags,
    allSelected: isAllSelected(filter),
    blockedTags: blocked,
    years,
    visibleClients,
    totalCount: clients.length,
    announcement,
    rejectionPulse,
    onToggleTag,
    onSelectAll,
    onShuffle,
    onYearsChange,
    onYearsInteractionEnd,
  };
}
