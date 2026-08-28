"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { track } from "@/lib/analytics";
import type { WorkClient } from "@/lib/content/model";

import styles from "./DesktopGrid.module.css";
import { computeCellRects, computeGridLayout } from "./grid-layout";
import { LogoCell } from "./LogoCell";
import { WorkTooltip, type TooltipAnchor } from "./Tooltip";

const GAP = 16;
const EASE = [0.32, 0.08, 0.24, 1] as const;

type DesktopGridProps = {
  clients: WorkClient[];
  openSlug: string | null;
};

/**
 * The fixed-viewport desktop logo field. Every visible client fits inside
 * the safe area between header and dock; the row/column arrangement is
 * recomputed as filtering changes the count, and survivors glide into their
 * new cells while entries fade in and exits contract away.
 */
export function DesktopGrid({ clients, openSlug }: DesktopGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [tooltip, setTooltip] = useState<TooltipAnchor | null>(null);
  const reducedMotion = useReducedMotion();

  // Staggered delays apply only to the initial Work entrance.
  const [entering, setEntering] = useState(true);
  useEffect(() => {
    const timeout = window.setTimeout(() => setEntering(false), 900);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let frame = 0;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      });
    });
    observer.observe(container);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  const rects = useMemo(() => {
    if (!size) return [];
    const layout = computeGridLayout({
      count: clients.length,
      width: size.width,
      height: size.height,
      gap: GAP,
    });
    return computeCellRects(clients.length, layout, GAP);
  }, [clients.length, size]);

  // The tooltip only shows while its client is still part of the composition.
  const activeTooltip =
    tooltip && clients.some((client) => client.id === tooltip.client.id) ? tooltip : null;

  useEffect(() => {
    if (!tooltip) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTooltip(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tooltip]);

  return (
    <div ref={containerRef} className={styles.field}>
      <ul className={styles.list} aria-label="Clients">
        <AnimatePresence initial={false}>
          {size &&
            clients.map((client, index) => {
              const rect = rects[index];
              if (!rect) return null;
              const entranceDelay = entering ? Math.min(index * 0.02, 0.4) : 0;
              return (
                <motion.li
                  key={client.id}
                  className={styles.item}
                  initial={{
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                    opacity: 0,
                    scale: reducedMotion ? 1 : 0.84,
                  }}
                  animate={{
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                    opacity: 1,
                    scale: 1,
                  }}
                  exit={{
                    opacity: 0,
                    scale: reducedMotion ? 1 : 0.84,
                    transition: { duration: reducedMotion ? 0.14 : 0.26, ease: "easeIn" },
                  }}
                  transition={{
                    duration: reducedMotion ? 0.18 : 0.52,
                    ease: EASE,
                    delay: entranceDelay,
                  }}
                >
                  <LogoCell
                    client={client}
                    openSlug={openSlug}
                    onInfoEnter={(hoveredClient, markRect) => {
                      setTooltip({
                        client: hoveredClient,
                        rect: {
                          x: markRect.x,
                          y: markRect.y,
                          width: markRect.width,
                          height: markRect.height,
                        },
                      });
                      track({ name: "client_info_opened", clientId: hoveredClient.id });
                    }}
                    onInfoLeave={() => setTooltip(null)}
                  />
                </motion.li>
              );
            })}
        </AnimatePresence>
      </ul>
      <WorkTooltip anchor={activeTooltip} />
    </div>
  );
}
