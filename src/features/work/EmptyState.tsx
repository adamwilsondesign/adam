"use client";

import { motion, useReducedMotion } from "motion/react";

import { DoorIllustration } from "@/components/illustrations/DoorIllustration";
import { EASE_OUT } from "@/lib/motion";

import styles from "./EmptyState.module.css";

type EmptyStateProps = {
  /** The doorway was entered — the caller plays the tunnel and navigates. */
  onEnterDoor: () => void;
};

/**
 * The deliberate zero-result state: every project filtered away leaves only
 * a doorway. It looks like a dead end; it isn't.
 */
export function EmptyState({ onEnterDoor }: EmptyStateProps) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      className={styles.root}
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.55, ease: EASE_OUT, delay: 0.1 }}
    >
      <button
        type="button"
        className={styles.door}
        aria-label="A door. Enter it."
        onClick={onEnterDoor}
      >
        <DoorIllustration />
      </button>
      <h2 className={styles.title}>nothing to see here</h2>
      <p className={styles.hint}>select all or a tag to bring the work back</p>
    </motion.div>
  );
}
