"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";

import { CloseIcon } from "@/components/icons";
import { clientTags, clientYearSpan, formatYearRange, type WorkClient } from "@/lib/content/model";
import { useFocusTrap } from "@/lib/use-focus-trap";

import styles from "./MobileInfoCard.module.css";
import { LogoMark } from "./LogoMark";

export type InfoOverlayState = {
  client: WorkClient;
  /** Where the logo travelled from (viewport coordinates). */
  origin: { x: number; y: number; width: number; height: number };
};

type MobileInfoCardProps = {
  state: InfoOverlayState | null;
  onClose: () => void;
};

const EASE = [0.32, 0.08, 0.24, 1] as const;

/**
 * Mobile informational overlay: the tapped logo travels to the upper centre
 * of the screen, the canvas dims behind it, and a bottom card presents the
 * client's dates, tags and description. Dismissal returns the logo to its
 * cell and restores the untouched canvas beneath.
 */
export function MobileInfoCard({ state, onClose }: MobileInfoCardProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const [closing, setClosing] = useState(false);
  useFocusTrap(panelRef, state !== null, { onEscape: () => requestClose() });

  const requestClose = () => {
    if (closing) return;
    // The exit animation returns the logo to its (possibly moved) cell; the
    // owning state is cleared once the exit completes.
    setClosing(true);
  };

  const handleExitComplete = () => {
    if (closing) {
      setClosing(false);
      onClose();
    }
  };

  // Recompute the return target at close time — the cell may have moved if
  // the grid reflowed while the overlay was open.
  const returnRect = (client: WorkClient) => {
    const mask = document.querySelector(`[data-client-cell="${client.id}"] [data-logo-mask]`);
    const rect = mask?.getBoundingClientRect();
    return rect
      ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      : (state?.origin ?? { x: 0, y: 0, width: 0, height: 0 });
  };

  const presentation = (() => {
    if (typeof window === "undefined" || !state) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    const width = Math.min(window.innerWidth * 0.44, 190);
    const height = width * 0.62;
    return {
      x: (window.innerWidth - width) / 2,
      y: window.innerHeight * 0.16,
      width,
      height,
    };
  })();

  return (
    <AnimatePresence onExitComplete={handleExitComplete}>
      {state && !closing && (
        <div className={styles.root} key={state.client.id}>
          <motion.button
            type="button"
            aria-label="Close details"
            className={styles.scrim}
            onClick={requestClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.22, delay: 0.08 } }}
            transition={{ duration: 0.26 }}
          />

          <motion.div
            className={styles.floatingLogo}
            initial={
              reducedMotion ? { ...presentation, opacity: 0 } : { ...state.origin, opacity: 1 }
            }
            animate={{ ...presentation, opacity: 1 }}
            exit={
              reducedMotion
                ? { opacity: 0, transition: { duration: 0.16 } }
                : { ...returnRect(state.client), transition: { duration: 0.34, ease: EASE } }
            }
            transition={{ duration: reducedMotion ? 0.16 : 0.4, ease: EASE }}
            aria-hidden
          >
            <LogoMark logoUrl={state.client.logoUrl} />
          </motion.div>

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={`${state.client.name} — details`}
            className={styles.card}
            initial={reducedMotion ? { opacity: 0 } : { y: "104%" }}
            animate={reducedMotion ? { opacity: 1 } : { y: 0 }}
            exit={
              reducedMotion
                ? { opacity: 0, transition: { duration: 0.16 } }
                : { y: "104%", transition: { duration: 0.3, ease: EASE } }
            }
            transition={{ duration: 0.42, ease: EASE, delay: reducedMotion ? 0 : 0.08 }}
          >
            <div className={styles.cardHeader}>
              <h2 className={styles.name}>{state.client.name}</h2>
              <button
                type="button"
                className={styles.close}
                aria-label="Close details"
                onClick={requestClose}
              >
                <CloseIcon />
              </button>
            </div>
            <p className={styles.meta}>
              {formatYearRange(clientYearSpan(state.client))}
              <span className={styles.metaSep}> · </span>
              {clientTags(state.client).join(", ")}
            </p>
            <p className={styles.description}>{state.client.description}</p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
