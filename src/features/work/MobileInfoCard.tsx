"use client";

import { useDrag } from "@use-gesture/react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { ArrowRightIcon, CloseIcon } from "@/components/icons";
import { clientTags, clientYearSpan, formatYearRange, type WorkClient } from "@/lib/content/model";
import { useFocusTrap } from "@/lib/use-focus-trap";

import styles from "./MobileInfoCard.module.css";
import { LogoMark } from "./LogoMark";
import { setCaseOrigin } from "./origin-store";

export type InfoOverlayState = {
  client: WorkClient;
  /** Where the logo travelled from (viewport coordinates). */
  origin: { x: number; y: number; width: number; height: number };
};

type MobileInfoCardProps = {
  state: InfoOverlayState | null;
  /** Direction of the latest swipe step (drives the slide animation). */
  direction: 0 | 1 | -1;
  /** False when the filter leaves a single project — nothing to step to. */
  canStep: boolean;
  onStep: (direction: 1 | -1) => void;
  onClose: () => void;
  /** Card CTA navigates to a case study: dismiss without touching history. */
  onReleaseForNavigation: () => void;
};

import { DUR, EASE_EXIT, EASE_INOUT, EASE_OUT } from "@/lib/motion";

/** Horizontal travel needed to step to the previous / next project. */
const STEP_DISTANCE = 70;

/** Directional slide for the per-client logo and card content. */
const slideVariants = {
  enter: (direction: number) => ({ x: direction * 44, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction * -44, opacity: 0 }),
};

const slideTransition = { duration: 0.3, ease: EASE_OUT };

/**
 * Mobile informational overlay: the tapped logo travels to the upper centre
 * of the screen, the canvas blurs behind it, and a bottom card presents the
 * client's dates, tags and description (plus a case-study link when one
 * exists). Swiping the card left or right steps through every project in
 * the current filtered composition, wrapping at the ends. Dismissal returns
 * the logo to its (possibly moved) cell and restores the untouched canvas.
 */
export function MobileInfoCard({
  state,
  direction,
  canStep,
  onStep,
  onClose,
  onReleaseForNavigation,
}: MobileInfoCardProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const [closing, setClosing] = useState(false);
  const dragX = useMotionValue(0);
  // Hydration-safe client check: the overlay portals to <body> so its
  // frosted scrim sits above the site header.
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

  // Swipe stepping: the card follows the finger with resistance; a decisive
  // release advances to the neighbouring project (swipe left = next).
  useDrag(
    ({ last, movement: [mx] }) => {
      if (!state || closing || !canStep) return;
      if (last) {
        if (mx < -STEP_DISTANCE) {
          onStep(1);
          animate(dragX, 0, { duration: 0.24, ease: EASE_OUT });
        } else if (mx > STEP_DISTANCE) {
          onStep(-1);
          animate(dragX, 0, { duration: 0.24, ease: EASE_OUT });
        } else {
          animate(dragX, 0, { duration: 0.3, ease: EASE_OUT });
        }
        return;
      }
      dragX.set(Math.max(-120, Math.min(120, mx * 0.6)));
    },
    {
      target: panelRef,
      axis: "x",
      pointer: { touch: true },
      enabled: state !== null && !closing,
    },
  );

  const slideDirection = reducedMotion ? 0 : direction;

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence onExitComplete={handleExitComplete}>
      {state && !closing && (
        <div className={styles.root} key="info-overlay">
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

          {/* Travel container: cell → presentation on open, back on close.
              Its `initial` is read once at mount (the opening client), so
              stepping never replays the travel — the keyed inner swaps
              logos with a directional slide instead. */}
          <motion.div
            ref={logoRef}
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
            <AnimatePresence mode="popLayout" custom={slideDirection} initial={false}>
              <motion.div
                key={state.client.id}
                className={styles.floatingLogoInner}
                custom={slideDirection}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={slideTransition}
              >
                <LogoMark logoUrl={state.client.logoUrl} treatment={state.client.logoTreatment} />
              </motion.div>
            </AnimatePresence>
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
            <button
              type="button"
              className={styles.close}
              aria-label="Close details"
              onClick={requestClose}
            >
              <CloseIcon />
            </button>

            <motion.div className={styles.cardSwipe} style={{ x: dragX }}>
              <AnimatePresence mode="popLayout" custom={slideDirection} initial={false}>
                <motion.div
                  key={state.client.id}
                  className={styles.cardContent}
                  custom={slideDirection}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={slideTransition}
                >
                  <h2 className={styles.name}>{state.client.name}</h2>
                  <p className={styles.meta}>
                    {formatYearRange(clientYearSpan(state.client))}
                    <span className={styles.metaSep}> · </span>
                    {clientTags(state.client).join(", ")}
                  </p>
                  <p className={styles.description}>{state.client.description}</p>
                  {state.client.caseStudy ? (
                    <Link
                      href={`/work/${state.client.caseStudy.slug}`}
                      className={styles.caseLink}
                      onClick={() => {
                        // The sheet's intro travels from the presented logo.
                        const rect = logoRef.current?.getBoundingClientRect();
                        setCaseOrigin({
                          slug: state.client.caseStudy!.slug,
                          rect: rect
                            ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
                            : presentation,
                          logoUrl: state.client.logoUrl,
                        });
                        onReleaseForNavigation();
                      }}
                    >
                      View case study
                      <ArrowRightIcon size={16} />
                    </Link>
                  ) : null}
                </motion.div>
              </AnimatePresence>
            </motion.div>

            {canStep ? (
              <p className={styles.swipeHint} aria-hidden>
                swipe for more
              </p>
            ) : null}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
