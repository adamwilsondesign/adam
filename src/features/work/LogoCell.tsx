"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { preload } from "react-dom";

import { track } from "@/lib/analytics";
import type { WorkClient } from "@/lib/content/model";

import styles from "./LogoCell.module.css";
import { LogoMark } from "./LogoMark";
import { setCaseOrigin } from "./origin-store";

type LogoCellProps = {
  client: WorkClient;
  /** Slug of the case study currently open above the grid, if any. */
  openSlug: string | null;
  /** True while this client's informational tooltip is open. */
  infoOpen: boolean;
  onInfoToggle: (client: WorkClient, rect: DOMRect) => void;
  onInfoClose: () => void;
};

/**
 * One desktop grid cell. Case-study clients are real links whose logo mask
 * fills with the hero image on hover; informational clients are buttons that
 * toggle the anchored tooltip on click (hover only raises their opacity).
 */
export function LogoCell({ client, openSlug, infoOpen, onInfoToggle, onInfoClose }: LogoCellProps) {
  const cellRef = useRef<HTMLElement | null>(null);
  const [hovered, setHovered] = useState(false);

  const caseStudy = client.caseStudy;
  const isOrigin = caseStudy !== null && caseStudy.slug === openSlug;

  useEffect(() => {
    if (caseStudy) preload(caseStudy.heroUrl, { as: "image" });
  }, [caseStudy]);

  const markRect = (): DOMRect => {
    const mask = cellRef.current?.querySelector("[data-logo-mask]");
    return (mask ?? cellRef.current!).getBoundingClientRect();
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
        aria-label={`${client.name} — open case study “${caseStudy.title}”`}
        aria-hidden={isOrigin || undefined}
        tabIndex={isOrigin ? -1 : undefined}
        data-origin={isOrigin || undefined}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        onClick={() => {
          const rect = markRect();
          setCaseOrigin({
            slug: caseStudy.slug,
            rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            logoUrl: client.logoUrl,
            heroUrl: caseStudy.heroUrl,
          });
          // The overlay swallows pointerleave, so drop the hover fill now —
          // the cell must be plain monochrome when the overlay hands back.
          setHovered(false);
          track({ name: "case_study_opened", slug: caseStudy.slug, source: "grid" });
        }}
      >
        <span className={styles.logoBox}>
          <LogoMark
            logoUrl={client.logoUrl}
            heroUrl={caseStudy.heroUrl}
            heroVisible={hovered}
            parallax
          />
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
      aria-label={client.name}
      aria-expanded={infoOpen}
      aria-describedby={infoOpen ? "work-tooltip" : undefined}
      onClick={() => onInfoToggle(client, markRect())}
      onBlur={() => {
        if (infoOpen) onInfoClose();
      }}
    >
      <span className={styles.logoBox}>
        <LogoMark logoUrl={client.logoUrl} />
      </span>
    </button>
  );
}
