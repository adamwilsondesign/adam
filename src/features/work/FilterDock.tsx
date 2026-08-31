"use client";

import { motion, useAnimationControls, useReducedMotion } from "motion/react";
import { useEffect } from "react";

import { ShuffleIcon } from "@/components/icons";
import { WORK_TAGS, type WorkTag } from "@/lib/content/model";

import styles from "./FilterDock.module.css";
import type { WorkState } from "./useWorkState";
import { YearRangeSlider } from "./YearRangeSlider";

type FilterDockProps = {
  state: WorkState;
  variant: "desktop" | "mobile";
};

/**
 * The persistent floating filter dock: the All chip, eight tag pills, the
 * result count, the double-ended year slider and a quiet shuffle control.
 * Desktop centres it as a floating instrument; mobile pins it across the
 * bottom with safe-area padding, the canvas panning beneath it.
 */
export function FilterDock({ state, variant }: FilterDockProps) {
  return (
    <>
      {variant === "mobile" ? (
        <button
          type="button"
          className={styles.shuffleFab}
          aria-label="Shuffle the composition"
          onClick={state.onShuffle}
        >
          <ShuffleIcon />
        </button>
      ) : null}
      <div
        id="work-filters"
        tabIndex={-1}
        className={variant === "desktop" ? styles.dockDesktop : styles.dockMobile}
      >
        <div className={styles.pillRow} role="group" aria-label="Filter by tag">
          <button
            type="button"
            className={`${styles.pill} ${styles.pillAll}`}
            data-active={state.allSelected || undefined}
            aria-pressed={state.allSelected}
            onClick={state.onToggleAll}
          >
            All
          </button>
          {WORK_TAGS.map((tag) => (
            <TagPill
              key={tag}
              tag={tag}
              active={state.activeTags.includes(tag)}
              blocked={state.blockedTags.has(tag) && !state.activeTags.includes(tag)}
              pulseKey={state.rejectionPulse?.tag === tag ? state.rejectionPulse.key : null}
              onToggle={state.onToggleTag}
            />
          ))}
        </div>
        <div className={styles.controlRow}>
          <span className={styles.count} aria-hidden>
            {String(state.visibleClients.length).padStart(2, "0")} /{" "}
            {String(state.totalCount).padStart(2, "0")}
          </span>
          <div className={styles.sliderRow}>
            <YearRangeSlider
              bounds={state.bounds}
              value={state.years}
              onChange={state.onYearsChange}
              onInteractionEnd={state.onYearsInteractionEnd}
            />
          </div>
          <button
            type="button"
            className={styles.shuffle}
            aria-label="Shuffle the composition"
            onClick={state.onShuffle}
          >
            <ShuffleIcon />
            <span className={styles.shuffleLabel}>shuffle</span>
          </button>
        </div>
        <div aria-live="polite" role="status" className="visually-hidden">
          {state.announcement}
        </div>
      </div>
    </>
  );
}

type TagPillProps = {
  tag: WorkTag;
  active: boolean;
  /** True when toggling this tag on would currently empty the grid. */
  blocked: boolean;
  /** Changes every time a toggle of this tag is rejected. */
  pulseKey: number | null;
  onToggle: (tag: WorkTag) => void;
};

function TagPill({ tag, active, blocked, pulseKey, onToggle }: TagPillProps) {
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
      data-blocked={blocked || undefined}
      aria-pressed={active}
      aria-disabled={blocked || undefined}
      animate={controls}
      onClick={() => onToggle(tag)}
    >
      {tag}
    </motion.button>
  );
}
