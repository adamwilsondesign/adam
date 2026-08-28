"use client";

import type { LogoTreatment } from "@/lib/content/model";

import styles from "./LogoMark.module.css";

type LogoMarkProps = {
  logoUrl: string;
  /** Optional per-theme / compact overrides; the mask handles theming when absent. */
  treatment?: LogoTreatment | null;
  /** Prefer the compact alternate mark (dense grids, small mobile cells). */
  compact?: boolean;
};

/**
 * A monochrome client logo rendered as a CSS alpha mask over currentColor,
 * so it follows the theme. Theme-specific asset overrides swap the mask URL
 * per theme; a compact override swaps in a denser mark for very small cells.
 */
export function LogoMark({ logoUrl, treatment, compact = false }: LogoMarkProps) {
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
    />
  );
}
