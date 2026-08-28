"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

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

import { DUR, EASE_EXIT, EASE_INOUT, EASE_OUT } from "@/lib/motion";

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
  // Hydration-safe client check: the overlay portals to <body> so its
  // frosted scrim sits above the site header (the Work view's fixed root
  // would otherwise trap it beneath, and an animated ancestor would also
  // bound the backdrop blur's sampling region).
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
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

  if (!mounted) return null;

  return createPortal(
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
            exit={{ opacity: 0, transition: { duration: 0.28, delay: 0.1, ease: EASE_EXIT } }}
            transition={{ duration: 0.36, ease: EASE_OUT }}
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
                : {
                    ...returnRect(state.client),
                    transition: { duration: 0.42, ease: EASE_INOUT },
                  }
            }
            transition={{ duration: reducedMotion ? 0.16 : DUR.base, ease: EASE_INOUT }}
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
                : { y: "104%", transition: { duration: 0.34, ease: EASE_EXIT } }
            }
            transition={{ duration: 0.55, ease: EASE_OUT, delay: reducedMotion ? 0 : 0.06 }}
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
    </AnimatePresence>,
    document.body,
  );
}
