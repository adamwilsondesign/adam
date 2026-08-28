"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { track } from "@/lib/analytics";
import type { WorkClient, WorkTag, YearRange } from "@/lib/content/model";

import {
  clampYearRange,
  defaultFilter,
  filterClients,
  toggleTag as applyTagToggle,
  type WorkFilter,
} from "./filtering";
import { newSeed, orderForSeed } from "./shuffle";

const APPLY_DEBOUNCE_MS = 150;
const KEYBOARD_SETTLE_MS = 600;
const POINTER_SETTLE_MS = 200;

export type RejectionPulse = { tag: WorkTag; key: number };

export type WorkState = {
  bounds: YearRange;
  activeTags: WorkTag[];
  /** The validated, displayed year range (slider position). */
  years: YearRange;
  /** Clients passing the applied filter, in the current shuffled order. */
  visibleClients: WorkClient[];
  totalCount: number;
  /** Increments only when the composition should reshuffle. */
  seed: number;
  announcement: string;
  rejectionPulse: RejectionPulse | null;
  onToggleTag: (tag: WorkTag) => void;
  onYearsChange: (candidate: YearRange, moved: "start" | "end") => void;
  onYearsInteractionEnd: () => void;
};

function signature(filter: WorkFilter): string {
  return `${filter.tags.join(",")}|${filter.years.start}-${filter.years.end}`;
}

/**
 * All interactive Work state. Lives in the grid page component, which stays
 * mounted while case-study overlays are open — so every overlay dismissal
 * returns to the exact previous composition.
 */
export function useWorkState(clients: WorkClient[], bounds: YearRange): WorkState {
  const [filter, setFilter] = useState<WorkFilter>(() => defaultFilter(bounds));
  const [years, setYears] = useState<YearRange>({ ...bounds });
  const [seed, setSeed] = useState<number>(() => newSeed());
  const [announcement, setAnnouncement] = useState("");
  const [rejectionPulse, setRejectionPulse] = useState<RejectionPulse | null>(null);

  const applyTimer = useRef<number | null>(null);
  const settleTimer = useRef<number | null>(null);
  const pendingYears = useRef<YearRange | null>(null);
  const lastShuffleSignature = useRef<string>(signature(defaultFilter(bounds)));
  const filterRef = useRef(filter);
  useEffect(() => {
    filterRef.current = filter;
  }, [filter]);

  useEffect(
    () => () => {
      if (applyTimer.current !== null) window.clearTimeout(applyTimer.current);
      if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
    },
    [],
  );

  const visibleClients = useMemo(() => {
    const matching = filterClients(clients, filter);
    const order = orderForSeed(
      clients.map((client) => client.id),
      seed,
    );
    return [...matching].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }, [clients, filter, seed]);

  const reshuffleIfChanged = useCallback((nextFilter: WorkFilter) => {
    const next = signature(nextFilter);
    if (next !== lastShuffleSignature.current) {
      lastShuffleSignature.current = next;
      setSeed(newSeed());
    }
  }, []);

  const onToggleTag = useCallback(
    (tag: WorkTag) => {
      const current = filterRef.current;
      const result = applyTagToggle(clients, current, tag);
      const wasActive = current.tags.includes(tag);
      track({ name: "work_tag_toggled", tag, active: !wasActive, rejected: result.rejected });
      if (result.rejected) {
        setRejectionPulse((previous) => ({ tag, key: (previous?.key ?? 0) + 1 }));
        setAnnouncement(
          `${wasActive ? "Removing" : "Changing"} “${tag}” would show no work for the selected years, so the filter was kept.`,
        );
        return;
      }
      setFilter(result.filter);
      reshuffleIfChanged(result.filter);
      const count = filterClients(clients, result.filter).length;
      setAnnouncement(`${count} of ${clients.length} clients shown.`);
    },
    [clients, reshuffleIfChanged],
  );

  const flushYears = useCallback(() => {
    if (applyTimer.current !== null) {
      window.clearTimeout(applyTimer.current);
      applyTimer.current = null;
    }
    const pending = pendingYears.current;
    if (!pending) return;
    pendingYears.current = null;
    setFilter((previous) => ({ ...previous, years: pending }));
  }, []);

  const settle = useCallback(() => {
    if (settleTimer.current !== null) {
      window.clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
    flushYears();
    setFilter((current) => {
      const next = signature(current);
      if (next !== lastShuffleSignature.current) {
        lastShuffleSignature.current = next;
        setSeed(newSeed());
        track({ name: "work_years_changed", start: current.years.start, end: current.years.end });
        const count = filterClients(clients, current).length;
        setAnnouncement(
          `${count} of ${clients.length} clients shown for ${current.years.start} to ${current.years.end}.`,
        );
      }
      return current;
    });
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

  return {
    bounds,
    activeTags: filter.tags,
    years,
    visibleClients,
    totalCount: clients.length,
    seed,
    announcement,
    rejectionPulse,
    onToggleTag,
    onYearsChange,
    onYearsInteractionEnd,
  };
}
