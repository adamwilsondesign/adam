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
  /** Pinned open by a click; pinned cards hold still instead of dodging. */
  sticky?: boolean;
};

const VIEWPORT_PADDING = 12;
const GAP = 14;

type Position = { left: number; top: number };
type Side = "right" | "left" | "above" | "below";

/**
 * The informational tooltip for clients without a case study, anchored
 * beside the hovered or focused logo and repositioned edge-aware (right,
 * left, above, below — whichever fits). Hovering the card itself makes it
 * dodge to the horizontally opposite edge of the logo; pinned (clicked)
 * cards hold still.
 */
export function WorkTooltip({
  anchor,
  onDodge,
}: {
  anchor: TooltipAnchor | null;
  /** The card flipped sides under the cursor — reset the close timing. */
  onDodge?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position | null>(null);
  /** Requested horizontal side after a dodge, per client. */
  const [dodge, setDodge] = useState<{ id: string; side: "left" | "right" } | null>(null);
  const chosenSideRef = useRef<Side>("right");

  useLayoutEffect(() => {
    if (!anchor || !ref.current) {
      setPosition(null);
      return;
    }
    const tip = ref.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const { rect } = anchor;

    const placements: Record<Side, Position> = {
      right: { left: rect.x + rect.width + GAP, top: rect.y + rect.height / 2 - tip.height / 2 },
      left: { left: rect.x - GAP - tip.width, top: rect.y + rect.height / 2 - tip.height / 2 },
      above: { left: rect.x + rect.width / 2 - tip.width / 2, top: rect.y - GAP - tip.height },
      below: {
        left: rect.x + rect.width / 2 - tip.width / 2,
        top: rect.y + rect.height + GAP,
      },
    };

    const preferred: Side[] =
      dodge?.id === anchor.client.id && dodge.side === "left"
        ? ["left", "right", "above", "below"]
        : ["right", "left", "above", "below"];

    const fits = (candidate: Position) =>
      candidate.left >= VIEWPORT_PADDING &&
      candidate.top >= VIEWPORT_PADDING &&
      candidate.left + tip.width <= viewportWidth - VIEWPORT_PADDING &&
      candidate.top + tip.height <= viewportHeight - VIEWPORT_PADDING;

    const side = preferred.find((candidate) => fits(placements[candidate])) ?? preferred[0]!;
    chosenSideRef.current = side;
    const chosen = placements[side];
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
  }, [anchor, dodge]);

  /** Cursor reached the card: hop to the opposite side of the logo. */
  const handlePointerEnter = () => {
    if (!anchor || anchor.sticky) return;
    const next = chosenSideRef.current === "left" ? "right" : "left";
    setDodge({ id: anchor.client.id, side: next });
    onDodge?.();
  };

  const span = anchor ? clientYearSpan(anchor.client) : null;
  const tags = anchor ? clientTags(anchor.client) : [];

  return (
    // mode="wait": when the anchor re-targets to another client, the old card
    // fully exits before the new one mounts — there is only ever one element
    // carrying id="work-tooltip" (aria-describedby must stay unambiguous).
    <AnimatePresence mode="wait">
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
          exit={{ opacity: 0, transition: { duration: 0.14 } }}
          transition={{ duration: 0.2, ease: EASE_OUT }}
          onPointerEnter={handlePointerEnter}
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
