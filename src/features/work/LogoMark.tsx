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
 * A monochrome client logo rendered as a CSS alpha mask over currentColor.
 * The night palette is permanent, so the dark-variant override (when a
 * client carries one) is the mask; a compact override swaps in a denser
 * mark for very small cells.
 */
export function LogoMark({ logoUrl, treatment, compact = false }: LogoMarkProps) {
  const base = (compact && treatment?.compactUrl) || logoUrl;
  const maskUrl = treatment?.darkUrl ?? base;

  return (
    <span
      data-logo-mask
      className={styles.mask}
      style={{ "--logo-mask": `url("${maskUrl}")` } as React.CSSProperties}
      aria-hidden
    />
  );
}
