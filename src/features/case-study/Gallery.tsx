"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { track } from "@/lib/analytics";
import type { WorkMedia } from "@/lib/content/model";

import styles from "./Gallery.module.css";

type GalleryProps = {
  media: WorkMedia[];
  slug: string;
  /** Only the visible variant reports analytics and binds listeners. */
  active: boolean;
};

/**
 * The desktop case-study media strip: free horizontal scrolling with gentle
 * snap points, pointer dragging, trackpad support and wheel-to-horizontal
 * behaviour. Every item shares the same displayed height; widths follow the
 * declared square / 16:9 ratio, with no cropping and no autoplay.
 */
export function Gallery({ media, slug, active }: GalleryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atEnd, setAtEnd] = useState(media.length <= 1);
  const [atStart, setAtStart] = useState(true);
  const [current, setCurrent] = useState(0);
  const dragState = useRef<{ startX: number; startScroll: number; moved: boolean } | null>(null);
  const scrollFrame = useRef(0);

  useEffect(() => () => cancelAnimationFrame(scrollFrame.current), []);

  // Vertical wheel input scrolls the strip horizontally.
  useEffect(() => {
    if (!active) return;
    const node = scrollRef.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        node.scrollLeft += event.deltaY;
        event.preventDefault();
      }
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [active]);

  // Report each media item once as it becomes predominantly visible.
  useEffect(() => {
    if (!active) return;
    const node = scrollRef.current;
    if (!node) return;
    const seen = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = (entry.target as HTMLElement).dataset.index;
          if (entry.isIntersecting && index !== undefined && !seen.has(index)) {
            seen.add(index);
            track({ name: "case_study_media_viewed", slug, index: Number(index) });
          }
        }
      },
      { root: node, threshold: 0.6 },
    );
    node.querySelectorAll("[data-index]").forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [active, slug, media.length]);

  const onScroll = () => {
    cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = requestAnimationFrame(() => {
      const node = scrollRef.current;
      if (!node) return;
      setAtEnd(node.scrollLeft + node.clientWidth >= node.scrollWidth - 32);
      setAtStart(node.scrollLeft <= 32);
      // Progress: the item whose left edge sits nearest the viewport edge.
      let nearest = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      node.querySelectorAll<HTMLElement>("[data-index]").forEach((item) => {
        const distance = Math.abs(item.offsetLeft - node.scrollLeft);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = Number(item.dataset.index);
        }
      });
      setCurrent(nearest);
    });
  };

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    const node = scrollRef.current;
    if (!node) return;
    dragState.current = { startX: event.clientX, startScroll: node.scrollLeft, moved: false };
    node.setPointerCapture(event.pointerId);
    node.dataset.dragging = "true";
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragState.current;
    const node = scrollRef.current;
    if (!drag || !node) return;
    const delta = event.clientX - drag.startX;
    if (Math.abs(delta) > 4) drag.moved = true;
    node.scrollLeft = drag.startScroll - delta;
  };

  const onPointerUp = (event: React.PointerEvent) => {
    const node = scrollRef.current;
    if (!node || !dragState.current) return;
    node.releasePointerCapture(event.pointerId);
    delete node.dataset.dragging;
    dragState.current = null;
  };

  return (
    <div className={styles.wrap}>
      <div
        ref={scrollRef}
        className={styles.scroller}
        role="group"
        aria-label="Project media"
        tabIndex={0}
        onScroll={onScroll}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {media.map((item, index) => (
          <figure
            key={`${item.url}-${index}`}
            className={styles.item}
            data-index={index}
            data-aspect={item.aspect}
          >
            <Image
              src={item.url}
              alt={item.alt}
              width={item.width}
              height={item.height}
              className={styles.image}
              sizes="(max-width: 767px) 92vw, 62vw"
              priority={index === 0 && active}
              loading={index === 0 ? "eager" : "lazy"}
              placeholder={item.lqip ? "blur" : "empty"}
              blurDataURL={item.lqip ?? undefined}
              draggable={false}
              unoptimized={item.url.endsWith(".svg")}
            />
            {item.caption ? (
              <figcaption className={styles.caption}>{item.caption}</figcaption>
            ) : null}
          </figure>
        ))}
        <div className={styles.endSpacer} aria-hidden />
      </div>
      <div className={styles.startFade} data-hidden={atStart || undefined} aria-hidden />
      <div className={styles.endFade} data-hidden={atEnd || undefined} aria-hidden />
      {media.length > 1 ? (
        <p className={styles.progress} aria-live="off">
          {String(current + 1).padStart(2, "0")} / {String(media.length).padStart(2, "0")}
        </p>
      ) : null}
    </div>
  );
}
