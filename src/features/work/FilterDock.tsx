"use client";

import { motion, useAnimationControls, useReducedMotion } from "motion/react";
import { useEffect } from "react";

import { WORK_TAGS, type WorkTag } from "@/lib/content/model";

import styles from "./FilterDock.module.css";
import type { WorkState } from "./useWorkState";
import { YearRangeSlider } from "./YearRangeSlider";

type FilterDockProps = {
  state: WorkState;
  variant: "desktop" | "mobile";
};

/**
 * The persistent floating filter dock: eight tag pills and the double-ended
 * year slider. Desktop centres it as a floating panel; mobile pins it across
 * the bottom with safe-area padding, the canvas panning beneath it.
 */
export function FilterDock({ state, variant }: FilterDockProps) {
  return (
    <div className={variant === "desktop" ? styles.dockDesktop : styles.dockMobile}>
      <div className={styles.pillRow} role="group" aria-label="Filter by tag">
        {WORK_TAGS.map((tag) => (
          <TagPill
            key={tag}
            tag={tag}
            active={state.activeTags.includes(tag)}
            pulseKey={state.rejectionPulse?.tag === tag ? state.rejectionPulse.key : null}
            onToggle={state.onToggleTag}
          />
        ))}
      </div>
      <div className={styles.sliderRow}>
        <YearRangeSlider
          bounds={state.bounds}
          value={state.years}
          onChange={state.onYearsChange}
          onInteractionEnd={state.onYearsInteractionEnd}
        />
      </div>
      <div aria-live="polite" role="status" className="visually-hidden">
        {state.announcement}
      </div>
    </div>
  );
}

type TagPillProps = {
  tag: WorkTag;
  active: boolean;
  /** Changes every time a toggle of this tag is rejected. */
  pulseKey: number | null;
  onToggle: (tag: WorkTag) => void;
};

function TagPill({ tag, active, pulseKey, onToggle }: TagPillProps) {
  const controls = useAnimationControls();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (pulseKey === null) return;
    if (reducedMotion) return;
    controls.start({ x: [0, -4, 4, -2, 0], transition: { duration: 0.32 } });
  }, [pulseKey, controls, reducedMotion]);

  return (
    <motion.button
      type="button"
      className={styles.pill}
      data-active={active || undefined}
      aria-pressed={active}
      animate={controls}
      onClick={() => onToggle(tag)}
    >
      {tag}
    </motion.button>
  );
}
