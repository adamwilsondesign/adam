"use client";

import { useEffect, useRef } from "react";

import type { ExperienceEntry } from "@/lib/content/model";

import styles from "./ExperienceTimeline.module.css";

type ExperienceTimelineProps = {
  label: string;
  entries: ExperienceEntry[];
};

/** Track distance ahead of an entry, loosely proportional to the years since
 *  the previous role — longer tenures read as longer stretches of line. */
function gapBefore(entries: ExperienceEntry[], index: number): number {
  if (index === 0) return 0;
  const previous = Number.parseInt(entries[index - 1]!.year, 10);
  const current = Number.parseInt(entries[index]!.year, 10);
  if (!Number.isFinite(previous) || !Number.isFinite(current)) return 160;
  return Math.min(400, Math.max(120, (current - previous) * 52));
}

/**
 * The work-experience band: a single continuous line with large year markers,
 * oldest on the left, presented at the newest end. It pans by drag, by wheel
 * (vertical scrolling translated sideways), by keyboard arrows, and by native
 * touch scrolling, settling gently onto entries via proximity snapping. It
 * never moves on its own.
 */
export function ExperienceTimeline({ label, entries }: ExperienceTimelineProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);

  /* The timeline opens at the newest (right) end. Layout effect timing isn't
     needed — the container is display-stable — but run before paint anyway. */
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollLeft = viewport.scrollWidth;
  }, [entries]);

  /* Vertical wheel motion pans the band. React registers wheel passively, so
     the preventDefault (stopping the page scroll underneath) needs a manual
     non-passive listener. */
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      viewport.scrollLeft += event.deltaY;
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, []);

  /* Mouse drag pans; touch uses the native scroller. Snapping is suspended
     while dragging so the band tracks the pointer exactly. */
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    let dragging = false;
    let lastX = 0;
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      dragging = true;
      lastX = event.clientX;
      viewport.setPointerCapture(event.pointerId);
      viewport.dataset.dragging = "true";
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      viewport.scrollLeft -= event.clientX - lastX;
      lastX = event.clientX;
    };
    const endDrag = () => {
      dragging = false;
      delete viewport.dataset.dragging;
    };
    viewport.addEventListener("pointerdown", onPointerDown);
    viewport.addEventListener("pointermove", onPointerMove);
    viewport.addEventListener("pointerup", endDrag);
    viewport.addEventListener("pointercancel", endDrag);
    return () => {
      viewport.removeEventListener("pointerdown", onPointerDown);
      viewport.removeEventListener("pointermove", onPointerMove);
      viewport.removeEventListener("pointerup", endDrag);
      viewport.removeEventListener("pointercancel", endDrag);
    };
  }, []);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    event.preventDefault();
    const step = Math.max(180, viewport.clientWidth * 0.4);
    viewport.scrollBy({
      left: event.key === "ArrowLeft" ? -step : step,
      behavior: "smooth",
    });
  };

  return (
    <div className={styles.root}>
      <div
        ref={viewportRef}
        className={styles.viewport}
        role="list"
        aria-label={label}
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        <div className={styles.track}>
          <span className={styles.line} aria-hidden />
          {entries.map((entry, index) => (
            <div
              key={`${entry.year}-${entry.title}`}
              role="listitem"
              className={styles.entry}
              style={{ "--gap": `${gapBefore(entries, index)}px` } as React.CSSProperties}
            >
              <span className={styles.year}>{entry.year}</span>
              <span className={styles.marker} aria-hidden />
              <span className={styles.role}>{entry.title}</span>
              <span className={styles.employer}>{entry.employer}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
