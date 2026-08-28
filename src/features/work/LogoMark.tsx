"use client";

import { motion, useReducedMotion, useSpring } from "motion/react";
import { useCallback, useRef } from "react";

import type { LogoTreatment } from "@/lib/content/model";

import styles from "./LogoMark.module.css";

type LogoMarkProps = {
  logoUrl: string;
  /** Optional per-theme / compact overrides; the mask handles theming when absent. */
  treatment?: LogoTreatment | null;
  /** Prefer the compact alternate mark (dense grids, small mobile cells). */
  compact?: boolean;
  /** Case-study hero image revealed through the logo's alpha mask. */
  heroUrl?: string | null;
  heroVisible?: boolean;
  /** Pointer parallax for the hero fill (desktop hover only). */
  parallax?: boolean;
};

/** Parallax travel as a fraction of the mark's box (spec: ~4–6%). */
const PARALLAX_TRAVEL = 0.05;

/**
 * A monochrome client logo rendered as a CSS alpha mask over currentColor,
 * so it follows the theme. Theme-specific asset overrides swap the mask URL
 * per theme; a compact override swaps in a denser mark for very small cells.
 * With a hero image supplied, the mask is filled by the image instead — the
 * case-study hover treatment.
 */
export function LogoMark({
  logoUrl,
  treatment,
  compact = false,
  heroUrl,
  heroVisible = false,
  parallax = false,
}: LogoMarkProps) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const reducedMotion = useReducedMotion();
  const x = useSpring(0, { stiffness: 160, damping: 26, mass: 0.5 });
  const y = useSpring(0, { stiffness: 160, damping: 26, mass: 0.5 });

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!parallax || reducedMotion || !heroUrl) return;
      const box = boxRef.current;
      if (!box) return;
      const rect = box.getBoundingClientRect();
      const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      x.set(-nx * rect.width * PARALLAX_TRAVEL);
      y.set(-ny * rect.height * PARALLAX_TRAVEL);
    },
    [parallax, reducedMotion, heroUrl, x, y],
  );

  const resetParallax = useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  const base = (compact && treatment?.compactUrl) || logoUrl;
  const lightUrl = treatment?.lightUrl ?? base;
  const darkUrl = treatment?.darkUrl ?? base;

  return (
    <span
      ref={boxRef}
      data-logo-mask
      className={styles.mask}
      style={
        {
          "--logo-mask": `url("${lightUrl}")`,
          "--logo-mask-dark": `url("${darkUrl}")`,
        } as React.CSSProperties
      }
      aria-hidden
      onPointerMove={handlePointerMove}
      onPointerLeave={resetParallax}
    >
      {heroUrl ? (
        <motion.img
          src={heroUrl}
          alt=""
          draggable={false}
          className={styles.fill}
          style={reducedMotion ? undefined : { x, y }}
          animate={{ opacity: heroVisible ? 1 : 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        />
      ) : null}
    </span>
  );
}
