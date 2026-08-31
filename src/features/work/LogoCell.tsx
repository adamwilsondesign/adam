"use client";

import Link from "next/link";
import { useRef } from "react";

import { track } from "@/lib/analytics";
import type { WorkClient } from "@/lib/content/model";

import styles from "./LogoCell.module.css";
import { LogoMark } from "./LogoMark";
import { opticalLogoBox } from "./optical";
import { setCaseOrigin } from "./origin-store";

/** Tooltip intents raised by informational cells; DesktopGrid owns timing. */
export type TooltipIntents = {
  hoverStart: (client: WorkClient, rect: DOMRect) => void;
  hoverEnd: () => void;
  focusStart: (client: WorkClient, rect: DOMRect) => void;
  focusEnd: () => void;
  stickyToggle: (client: WorkClient, rect: DOMRect) => void;
};

type LogoCellProps = {
  client: WorkClient;
  /** Slug of the case study currently open above the grid, if any. */
  openSlug: string | null;
  /** True while this client's informational tooltip is open. */
  infoOpen: boolean;
  /** Roving tabindex: exactly one cell in the grid is tabbable. */
  tabIndex: number;
  gridIndex: number;
  onFocusIndex: (index: number) => void;
  onCursorLabel: (label: string | null) => void;
  tooltip: TooltipIntents;
};

/**
 * One desktop grid cell. Case-study clients are real links with a soft
 * glow radiating from behind the mark; informational clients open the
 * anchored tooltip on hover and focus, and pin it sticky on click. The two
 * behaviours are also distinguished by a contextual cursor label.
 */
export function LogoCell({
  client,
  openSlug,
  infoOpen,
  tabIndex,
  gridIndex,
  onFocusIndex,
  onCursorLabel,
  tooltip,
}: LogoCellProps) {
  const cellRef = useRef<HTMLElement | null>(null);

  const caseStudy = client.caseStudy;
  const isOrigin = caseStudy !== null && caseStudy.slug === openSlug;
  const optical = opticalLogoBox(client.logoAspect, client.logoTreatment);

  const markRect = (): DOMRect => {
    const mask = cellRef.current?.querySelector("[data-logo-mask]");
    return (mask ?? cellRef.current!).getBoundingClientRect();
  };

  const logoBoxStyle: React.CSSProperties = {
    width: `${optical.widthPct}%`,
    height: `${optical.heightPct}%`,
  };

  if (caseStudy) {
    return (
      <Link
        ref={(node) => {
          cellRef.current = node;
        }}
        href={`/work/${caseStudy.slug}`}
        className={styles.cell}
        data-case-cell={caseStudy.slug}
        data-grid-index={gridIndex}
        data-align={optical.alignment}
        aria-label={`${client.name} — open case study “${caseStudy.title}”`}
        aria-hidden={isOrigin || undefined}
        tabIndex={isOrigin ? -1 : tabIndex}
        data-origin={isOrigin || undefined}
        onPointerEnter={() => onCursorLabel("view project")}
        onPointerLeave={() => onCursorLabel(null)}
        onFocus={() => onFocusIndex(gridIndex)}
        onClick={() => {
          const rect = markRect();
          setCaseOrigin({
            slug: caseStudy.slug,
            rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            logoUrl: client.logoUrl,
          });
          onCursorLabel(null);
          track({ name: "case_study_opened", slug: caseStudy.slug, source: "grid" });
        }}
      >
        <span className={styles.logoBox} style={logoBoxStyle}>
          <LogoMark logoUrl={client.logoUrl} treatment={client.logoTreatment} />
        </span>
      </Link>
    );
  }

  return (
    <button
      ref={(node) => {
        cellRef.current = node;
      }}
      type="button"
      className={styles.cell}
      data-client-cell={client.id}
      data-grid-index={gridIndex}
      data-align={optical.alignment}
      aria-label={client.name}
      aria-expanded={infoOpen}
      aria-describedby={infoOpen ? "work-tooltip" : undefined}
      tabIndex={tabIndex}
      onPointerEnter={() => {
        onCursorLabel("details");
        tooltip.hoverStart(client, markRect());
      }}
      onPointerLeave={() => {
        onCursorLabel(null);
        tooltip.hoverEnd();
      }}
      onFocus={() => {
        onFocusIndex(gridIndex);
        tooltip.focusStart(client, markRect());
      }}
      onBlur={() => tooltip.focusEnd()}
      onClick={() => tooltip.stickyToggle(client, markRect())}
    >
      <span className={styles.logoBox} style={logoBoxStyle}>
        <LogoMark logoUrl={client.logoUrl} treatment={client.logoTreatment} />
      </span>
    </button>
  );
}
