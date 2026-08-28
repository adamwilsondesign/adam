"use client";

import { motion } from "motion/react";

import type { LogoTreatment } from "@/lib/content/model";

import styles from "./LogoMark.module.css";

type LogoMarkProps = {
  logoUrl: string;
  /** Optional per-theme / compact overrides; the mask handles theming when absent. */
  treatment?: LogoTreatment | null;
  /** Prefer the compact alternate mark (dense grids, small mobile cells). */
  compact?: boolean;
  /** Case-study hero image revealed through the logo's alpha mask — used by
   *  the overlay shared-element morphs, never by grid hover. */
  heroUrl?: string | null;
  heroVisible?: boolean;
};

/**
 * A monochrome client logo rendered as a CSS alpha mask over currentColor,
 * so it follows the theme. Theme-specific asset overrides swap the mask URL
 * per theme; a compact override swaps in a denser mark for very small cells.
 * With a hero image supplied, the mask can be filled by the image — the
 * case-study morph treatment.
 */
export function LogoMark({
  logoUrl,
  treatment,
  compact = false,
  heroUrl,
  heroVisible = false,
}: LogoMarkProps) {
  const base = (compact && treatment?.compactUrl) || logoUrl;
  const lightUrl = treatment?.lightUrl ?? base;
  const darkUrl = treatment?.darkUrl ?? base;

  return (
    <span
      data-logo-mask
      className={styles.mask}
      style={
        {
          "--logo-mask": `url("${lightUrl}")`,
          "--logo-mask-dark": `url("${darkUrl}")`,
        } as React.CSSProperties
      }
      aria-hidden
    >
      {heroUrl ? (
        <motion.img
          src={heroUrl}
          alt=""
          draggable={false}
          className={styles.fill}
          animate={{ opacity: heroVisible ? 1 : 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        />
      ) : null}
    </span>
  );
}
