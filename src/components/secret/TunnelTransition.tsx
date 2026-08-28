"use client";

import { useReducedMotion } from "motion/react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

import styles from "./TunnelTransition.module.css";

/** How long the fall lasts before the secret page resolves. */
export const TUNNEL_MS = 4000;
const REDUCED_MS = 800;

/** Concentric rings rushing past; more rings read as faster falling. */
const RINGS = 9;

type TunnelTransitionProps = {
  onComplete: () => void;
};

/**
 * The fall through the door: a black & white tunnel of concentric rings
 * accelerating past the viewer for four seconds. It covers every piece of
 * interface (header included) and hands off to the secret page, whose black
 * ground it matches — the landing reads as the bottom of the drop.
 * Reduced motion replaces the fall with a short fade to black.
 */
export function TunnelTransition({ onComplete }: TunnelTransitionProps) {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const timer = window.setTimeout(onComplete, reducedMotion ? REDUCED_MS : TUNNEL_MS);
    return () => window.clearTimeout(timer);
  }, [onComplete, reducedMotion]);

  return createPortal(
    <div className={styles.root} role="presentation" data-reduced={reducedMotion || undefined}>
      {!reducedMotion && (
        <div className={styles.field} aria-hidden>
          {Array.from({ length: RINGS }, (_, index) => (
            <span
              key={index}
              className={styles.ring}
              style={{ animationDelay: `${(index / RINGS) * 1.1}s` }}
            />
          ))}
          <span className={styles.core} />
        </div>
      )}
      <p className="visually-hidden" role="status">
        Falling…
      </p>
    </div>,
    document.body,
  );
}
