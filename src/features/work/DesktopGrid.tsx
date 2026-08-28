"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { track } from "@/lib/analytics";
import type { WorkClient } from "@/lib/content/model";

import { DUR, EASE_INOUT, EASE_OUT } from "@/lib/motion";

import styles from "./DesktopGrid.module.css";
import { computeCellRects, computeGridLayout } from "./grid-layout";
import { LogoCell } from "./LogoCell";
import { WorkTooltip, type TooltipAnchor } from "./Tooltip";

const GAP = 22;

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
  // The tooltip remembers which composition it was opened against, so any
  // recomposition (filter change, reshuffle) dismisses it automatically.
  const [tooltip, setTooltip] = useState<(TooltipAnchor & { forClients: WorkClient[] }) | null>(
    null,
  );
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

  // The tooltip only shows for the composition it was opened against.
  const activeTooltip = tooltip && tooltip.forClients === clients ? tooltip : null;

  useEffect(() => {
    if (!activeTooltip) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTooltip(null);
    };
    // A viewport resize reflows the grid, leaving the anchor rect stale.
    const onResize = () => setTooltip(null);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [activeTooltip]);

  const toggleTooltip = (client: WorkClient, markRect: DOMRect) => {
    if (activeTooltip?.client.id === client.id) {
      setTooltip(null);
      return;
    }
    setTooltip({
      client,
      rect: { x: markRect.x, y: markRect.y, width: markRect.width, height: markRect.height },
      forClients: clients,
    });
    track({ name: "client_info_opened", clientId: client.id });
  };

  return (
    <div ref={containerRef} className={styles.field}>
      <ul className={styles.list} aria-label="Clients">
        <AnimatePresence initial={false}>
          {size &&
            clients.map((client, index) => {
              const rect = rects[index];
              if (!rect) return null;
              const entranceDelay = entering ? Math.min(index * 0.022, 0.44) : 0;
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
                    scale: reducedMotion ? 1 : 0.88,
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
                    scale: reducedMotion ? 1 : 0.88,
                    transition: { duration: reducedMotion ? 0.14 : 0.3, ease: EASE_INOUT },
                  }}
                  transition={{
                    duration: reducedMotion ? 0.18 : DUR.grid,
                    ease: entering ? EASE_OUT : EASE_INOUT,
                    delay: entranceDelay,
                  }}
                >
                  <LogoCell
                    client={client}
                    openSlug={openSlug}
                    infoOpen={activeTooltip?.client.id === client.id}
                    onInfoToggle={toggleTooltip}
                    onInfoClose={() => setTooltip(null)}
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
