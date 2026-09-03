"use client";

import { useEffect, useRef } from "react";

import type { CoverItem } from "@/lib/content/model";
import { useMediaQuery } from "@/lib/use-media-query";

import styles from "./CoverMarquee.module.css";

type CoverMarqueeProps = {
  label: string;
  items: CoverItem[];
  /** 1 drifts left (content moves toward the start), -1 drifts right. */
  direction: 1 | -1;
  reducedMotion: boolean;
};

/** Marquee drift in pixels per second — slow enough to read as ambient. */
const DRIFT_SPEED = 24;
const TILT_MAX_DEG = 7;

/**
 * A seamless auto-scrolling shelf of cover artwork. The track holds two
 * copies of the set and wraps by modulo, so the loop never jumps; it pauses
 * under the pointer, on focus, off-screen tabs and reduced motion, and can be
 * dragged directly. On fine pointers each cover carries the faux-3D tilt.
 */
export function CoverMarquee({ label, items, direction, reducedMotion }: CoverMarqueeProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const finePointer = useMediaQuery("(hover: hover) and (pointer: fine)") === true;
  const tiltEnabled = finePointer && !reducedMotion;

  useEffect(() => {
    const root = rootRef.current;
    const track = trackRef.current;
    if (!root || !track) return;

    let offset = 0;
    let half = 0;
    let paused = false;
    let dragging = false;
    let lastX = 0;
    let lastTime: number | null = null;
    let raf = 0;

    const measure = () => {
      half = track.scrollWidth / 2;
    };
    const apply = () => {
      if (half <= 0) return;
      offset = ((offset % half) + half) % half;
      track.style.transform = `translate3d(${-offset}px, 0, 0)`;
    };

    const step = (now: number) => {
      const dt = lastTime === null ? 0 : Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;
      if (!paused && !dragging && !document.hidden && !reducedMotion) {
        offset += direction * DRIFT_SPEED * dt;
        apply();
      }
      raf = requestAnimationFrame(step);
    };

    const onPointerEnter = (event: PointerEvent) => {
      if (event.pointerType === "mouse") paused = true;
    };
    const onPointerLeave = () => {
      paused = false;
    };
    const onFocusIn = () => {
      paused = true;
    };
    const onFocusOut = (event: FocusEvent) => {
      if (!root.contains(event.relatedTarget as Node | null)) paused = false;
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      dragging = true;
      lastX = event.clientX;
      root.setPointerCapture(event.pointerId);
      root.dataset.dragging = "true";
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      offset -= event.clientX - lastX;
      lastX = event.clientX;
      apply();
    };
    const endDrag = () => {
      dragging = false;
      delete root.dataset.dragging;
    };

    measure();
    apply();
    const observer = new ResizeObserver(() => {
      measure();
      apply();
    });
    observer.observe(track);

    root.addEventListener("pointerenter", onPointerEnter);
    root.addEventListener("pointerleave", onPointerLeave);
    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("focusout", onFocusOut);
    root.addEventListener("pointerdown", onPointerDown);
    root.addEventListener("pointermove", onPointerMove);
    root.addEventListener("pointerup", endDrag);
    root.addEventListener("pointercancel", endDrag);
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      root.removeEventListener("pointerenter", onPointerEnter);
      root.removeEventListener("pointerleave", onPointerLeave);
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("focusout", onFocusOut);
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerup", endDrag);
      root.removeEventListener("pointercancel", endDrag);
    };
  }, [direction, reducedMotion]);

  /* The Apple TV-style tilt: the cover leans toward the pointer (≤7°),
     lifts, and carries a pointer-following specular sheen. Suppressed while
     the marquee itself is being dragged. */
  const onTiltMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!tiltEnabled || event.pointerType !== "mouse") return;
    const item = event.currentTarget;
    if (rootRef.current?.dataset.dragging) {
      delete item.dataset.tilt;
      return;
    }
    const rect = item.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    item.dataset.tilt = "true";
    item.style.setProperty("--rx", `${((0.5 - py) * 2 * TILT_MAX_DEG).toFixed(2)}deg`);
    item.style.setProperty("--ry", `${((px - 0.5) * 2 * TILT_MAX_DEG).toFixed(2)}deg`);
    item.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
    item.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
  };
  const onTiltLeave = (event: React.PointerEvent<HTMLDivElement>) => {
    const item = event.currentTarget;
    delete item.dataset.tilt;
    item.style.removeProperty("--rx");
    item.style.removeProperty("--ry");
  };

  const renderSet = (hidden: boolean) => (
    <ul className={styles.set} role={hidden ? undefined : "list"} aria-hidden={hidden || undefined}>
      {items.map((item, index) => (
        <li
          key={`${item.title}-${index}`}
          className={styles.item}
          role={hidden ? undefined : "listitem"}
        >
          <div
            className={styles.cover}
            onPointerMove={tiltEnabled ? onTiltMove : undefined}
            onPointerLeave={tiltEnabled ? onTiltLeave : undefined}
          >
            {/* Local SVG placeholders and Sanity assets share one plain img
                path; next/image adds nothing for pre-sized cover art. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className={styles.art}
              src={item.coverUrl}
              alt={hidden ? "" : item.alt}
              width={400}
              height={600}
              loading="lazy"
              decoding="async"
              draggable={false}
            />
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <div ref={rootRef} className={styles.root} aria-label={label} data-marquee>
      <div ref={trackRef} className={styles.track}>
        {renderSet(false)}
        {renderSet(true)}
      </div>
    </div>
  );
}
