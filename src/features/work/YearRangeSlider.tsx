"use client";

import { useCallback, useRef } from "react";

import type { YearRange } from "@/lib/content/model";

import styles from "./YearRangeSlider.module.css";

type YearRangeSliderProps = {
  bounds: YearRange;
  value: YearRange;
  onChange: (candidate: YearRange, moved: "start" | "end") => void;
  onInteractionEnd: () => void;
};

/**
 * Double-ended year slider. Each handle is a `role="slider"` control with
 * full keyboard support; invalid positions are returned to the nearest valid
 * range by the owning state hook, so the handles can never empty the grid.
 */
export function YearRangeSlider({
  bounds,
  value,
  onChange,
  onInteractionEnd,
}: YearRangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<"start" | "end" | null>(null);

  const span = Math.max(1, bounds.end - bounds.start);
  const startPercent = ((value.start - bounds.start) / span) * 100;
  const endPercent = ((value.end - bounds.start) / span) * 100;

  const yearFromClientX = useCallback(
    (clientX: number): number => {
      const track = trackRef.current;
      if (!track) return bounds.start;
      const rect = track.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return Math.round(bounds.start + ratio * span);
    },
    [bounds.start, span],
  );

  const moveHandle = useCallback(
    (handle: "start" | "end", year: number) => {
      const candidate: YearRange =
        handle === "start" ? { start: year, end: value.end } : { start: value.start, end: year };
      onChange(candidate, handle);
    },
    [onChange, value.start, value.end],
  );

  const handlePointerDown = (handle: "start" | "end") => (event: React.PointerEvent) => {
    event.preventDefault();
    draggingRef.current = handle;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    (event.target as HTMLElement).focus();
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    const handle = draggingRef.current;
    if (!handle) return;
    moveHandle(handle, yearFromClientX(event.clientX));
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = null;
    (event.target as HTMLElement).releasePointerCapture(event.pointerId);
    onInteractionEnd();
  };

  const handleTrackPointerDown = (event: React.PointerEvent) => {
    // Jump the nearest handle to the pressed year, then keep dragging it.
    const year = yearFromClientX(event.clientX);
    const handle = Math.abs(year - value.start) <= Math.abs(year - value.end) ? "start" : "end";
    moveHandle(handle, year);
    draggingRef.current = handle;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const handleKeyDown = (handle: "start" | "end") => (event: React.KeyboardEvent) => {
    const current = handle === "start" ? value.start : value.end;
    let next: number | null = null;
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowDown":
        next = current - 1;
        break;
      case "ArrowRight":
      case "ArrowUp":
        next = current + 1;
        break;
      case "PageDown":
        next = current - 5;
        break;
      case "PageUp":
        next = current + 5;
        break;
      case "Home":
        next = bounds.start;
        break;
      case "End":
        next = bounds.end;
        break;
      default:
        return;
    }
    event.preventDefault();
    moveHandle(handle, Math.min(bounds.end, Math.max(bounds.start, next)));
  };

  return (
    <div className={styles.root}>
      <span className={styles.yearLabel} aria-hidden>
        {value.start}
      </span>
      <div
        ref={trackRef}
        className={styles.track}
        onPointerDown={handleTrackPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className={styles.rail} />
        <div
          className={styles.fill}
          style={{ left: `${startPercent}%`, width: `${endPercent - startPercent}%` }}
        />
        {(["start", "end"] as const).map((handle) => (
          <button
            key={handle}
            type="button"
            role="slider"
            className={styles.thumb}
            style={{ left: `${handle === "start" ? startPercent : endPercent}%` }}
            aria-label={handle === "start" ? "Start year" : "End year"}
            aria-valuemin={bounds.start}
            aria-valuemax={bounds.end}
            aria-valuenow={handle === "start" ? value.start : value.end}
            aria-valuetext={String(handle === "start" ? value.start : value.end)}
            onPointerDown={handlePointerDown(handle)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onKeyDown={handleKeyDown(handle)}
          />
        ))}
      </div>
      <span className={styles.yearLabel} aria-hidden>
        {value.end}
      </span>
    </div>
  );
}
