"use client";

import { motion, useReducedMotion, useSpring } from "motion/react";
import { useCallback, useRef } from "react";

import styles from "./LogoMark.module.css";

type LogoMarkProps = {
  logoUrl: string;
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
 * so it follows the theme. With a hero image supplied, the mask is filled by
 * the image instead — the case-study hover treatment.
 */
export function LogoMark({
  logoUrl,
  heroUrl,
  heroVisible = false,
  parallax = false,
}: LogoMarkProps) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const reducedMotion = useReducedMotion();
  const x = useSpring(0, { stiffness: 220, damping: 30 });
  const y = useSpring(0, { stiffness: 220, damping: 30 });

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

  return (
    <span
      ref={boxRef}
      data-logo-mask
      className={styles.mask}
      style={{
        maskImage: `url("${logoUrl}")`,
        WebkitMaskImage: `url("${logoUrl}")`,
      }}
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
          transition={{ duration: 0.22, ease: "easeOut" }}
        />
      ) : null}
    </span>
  );
}
