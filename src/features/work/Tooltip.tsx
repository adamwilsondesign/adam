"use client";

import { AnimatePresence, motion } from "motion/react";

import { EASE_OUT } from "@/lib/motion";
import { useLayoutEffect, useRef, useState } from "react";

import { clientTags, clientYearSpan, formatYearRange, type WorkClient } from "@/lib/content/model";

import styles from "./Tooltip.module.css";

export type TooltipAnchor = {
  client: WorkClient;
  /** Viewport rect of the hovered logo. */
  rect: { x: number; y: number; width: number; height: number };
};

const VIEWPORT_PADDING = 12;
const GAP = 14;

type Position = { left: number; top: number };

/**
 * The informational tooltip for clients without a case study, anchored
 * beside the hovered logo and repositioned to avoid every viewport edge.
 */
export function WorkTooltip({ anchor }: { anchor: TooltipAnchor | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position | null>(null);

  useLayoutEffect(() => {
    if (!anchor || !ref.current) {
      setPosition(null);
      return;
    }
    const tip = ref.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const { rect } = anchor;

    const placements: Position[] = [
      { left: rect.x + rect.width + GAP, top: rect.y + rect.height / 2 - tip.height / 2 },
      { left: rect.x - GAP - tip.width, top: rect.y + rect.height / 2 - tip.height / 2 },
      { left: rect.x + rect.width / 2 - tip.width / 2, top: rect.y - GAP - tip.height },
      { left: rect.x + rect.width / 2 - tip.width / 2, top: rect.y + rect.height + GAP },
    ];

    const fits = (candidate: Position) =>
      candidate.left >= VIEWPORT_PADDING &&
      candidate.top >= VIEWPORT_PADDING &&
      candidate.left + tip.width <= viewportWidth - VIEWPORT_PADDING &&
      candidate.top + tip.height <= viewportHeight - VIEWPORT_PADDING;

    const chosen = placements.find(fits) ?? placements[0]!;
    setPosition({
      left: Math.min(
        Math.max(chosen.left, VIEWPORT_PADDING),
        viewportWidth - VIEWPORT_PADDING - tip.width,
      ),
      top: Math.min(
        Math.max(chosen.top, VIEWPORT_PADDING),
        viewportHeight - VIEWPORT_PADDING - tip.height,
      ),
    });
  }, [anchor]);

  const span = anchor ? clientYearSpan(anchor.client) : null;
  const tags = anchor ? clientTags(anchor.client) : [];

  return (
    <AnimatePresence>
      {anchor && (
        <motion.div
          key={anchor.client.id}
          ref={ref}
          id="work-tooltip"
          role="tooltip"
          className={styles.tooltip}
          style={{
            left: position?.left ?? -9999,
            top: position?.top ?? -9999,
            visibility: position ? "visible" : "hidden",
          }}
          initial={{ opacity: 0, y: 6, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.16 } }}
          transition={{ duration: 0.34, ease: EASE_OUT }}
        >
          <p className={styles.name}>{anchor.client.name}</p>
          <p className={styles.meta}>
            {formatYearRange(span)}
            {tags.length > 0 ? <span className={styles.metaSep}> · </span> : null}
            {tags.join(", ")}
          </p>
          <p className={styles.description}>{anchor.client.description}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
