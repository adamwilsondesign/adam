"use client";

import { motion, useAnimationControls, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { ArrowUpRightIcon, CloseIcon } from "@/components/icons";
import { LogoMark } from "@/features/work/LogoMark";
import { findCaseCellRect, type CaseOrigin } from "@/features/work/origin-store";
import { track } from "@/lib/analytics";
import type { CaseStudy } from "@/lib/content/model";
import { useFocusTrap } from "@/lib/use-focus-trap";

import styles from "./DesktopCaseModal.module.css";
import { Gallery } from "./Gallery";
import { PortableTextBody } from "./PortableTextBody";

const EASE = [0.32, 0.08, 0.24, 1] as const;

type Phase = "enter" | "open" | "closing";

type DesktopCaseModalProps = {
  study: CaseStudy;
  origin: CaseOrigin | null;
  /** False while the mobile variant is the visible one. */
  active: boolean;
  onNavigateClose: () => void;
};

/**
 * The desktop case-study modal. The clicked grid logo is its visual origin:
 * the image-filled mark expands and travels into the left information panel,
 * the modal structure resolves around it, the mark settles back to plain
 * monochrome, and the written content and gallery enter last. Closing plays
 * the same journey in reverse toward the (still mounted) grid cell.
 */
export function DesktopCaseModal({
  study,
  origin,
  active,
  onNavigateClose,
}: DesktopCaseModalProps) {
  const reducedMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const logoBoxRef = useRef<HTMLDivElement>(null);
  const logoControls = useAnimationControls();
  const travelPending = origin !== null && !reducedMotion;
  const [phase, setPhase] = useState<Phase>(travelPending ? "enter" : "open");
  const startedRef = useRef(false);

  useFocusTrap(rootRef, active && phase !== "closing", {
    initialFocus: "container",
    onEscape: () => requestClose(),
  });

  useEffect(() => {
    if (!active || startedRef.current) return;
    startedRef.current = true;
    if (!travelPending) return;
    const box = logoBoxRef.current;
    if (!box) {
      setPhase("open");
      return;
    }
    const final = box.getBoundingClientRect();
    if (final.width === 0) {
      setPhase("open");
      return;
    }
    const rect = origin.rect;
    logoControls.set({
      x: rect.x + rect.width / 2 - (final.x + final.width / 2),
      y: rect.y + rect.height / 2 - (final.y + final.height / 2),
      scale: Math.max(0.05, rect.width / final.width),
    });
    void logoControls
      .start({ x: 0, y: 0, scale: 1, transition: { duration: 0.55, ease: EASE } })
      .then(() => setPhase("open"));
  }, [active, travelPending, origin, logoControls]);

  const requestClose = () => {
    if (phase === "closing") return;
    setPhase("closing");
    const finish = () => onNavigateClose();
    const box = logoBoxRef.current;
    const target = findCaseCellRect(study.slug);
    if (reducedMotion || !box || !target) {
      window.setTimeout(finish, 200);
      return;
    }
    const final = box.getBoundingClientRect();
    void logoControls
      .start({
        x: target.x + target.width / 2 - (final.x + final.width / 2),
        y: target.y + target.height / 2 - (final.y + final.height / 2),
        scale: Math.max(0.05, target.width / final.width),
        transition: { duration: 0.44, ease: EASE },
      })
      .then(finish);
  };

  const contentVisible = phase === "open";

  return (
    <motion.div
      ref={rootRef}
      className={styles.root}
      role="dialog"
      aria-modal="true"
      aria-labelledby="case-study-title"
      tabIndex={-1}
      initial={origin ? { opacity: 0 } : false}
      animate={{ opacity: phase === "closing" ? 0 : 1 }}
      transition={{
        duration: phase === "closing" ? 0.32 : 0.26,
        ease: "easeOut",
        delay: phase === "closing" ? 0.16 : 0,
      }}
    >
      <button
        type="button"
        data-close
        className={styles.close}
        aria-label="Close case study"
        onClick={requestClose}
      >
        <CloseIcon />
        <span className={styles.closeLabel}>Close</span>
      </button>

      <div className={styles.panel}>
        <motion.div ref={logoBoxRef} className={styles.logoBox} animate={logoControls} aria-hidden>
          <LogoMark
            logoUrl={study.logoUrl}
            heroUrl={study.hero.url}
            heroVisible={phase === "enter"}
          />
        </motion.div>

        <motion.div
          className={styles.content}
          initial={origin ? { opacity: 0, y: 10 } : false}
          animate={contentVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.4, ease: EASE, delay: contentVisible ? 0.05 : 0 }}
        >
          <h1 id="case-study-title" className={styles.title}>
            {study.title}
          </h1>
          {study.subtitle ? <p className={styles.subtitle}>{study.subtitle}</p> : null}
          <p className={styles.meta}>
            <span className={styles.client}>{study.clientName}</span>
            <span className={styles.metaSep}> · </span>
            {study.displayDate}
            <span className={styles.metaSep}> · </span>
            {study.tags.join(", ")}
          </p>
          <div className={styles.body}>
            <PortableTextBody value={study.body} fallback={study.summary} />
          </div>
          {study.externalUrl ? (
            <a
              className={styles.external}
              href={study.externalUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() =>
                track({ name: "external_link_followed", slug: study.slug, url: study.externalUrl! })
              }
            >
              Visit project
              <ArrowUpRightIcon />
            </a>
          ) : null}
        </motion.div>
      </div>

      <motion.div
        className={styles.media}
        initial={origin ? { opacity: 0 } : false}
        animate={contentVisible ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.45, ease: EASE, delay: contentVisible ? 0.16 : 0 }}
      >
        <Gallery media={study.gallery} slug={study.slug} active={active && phase === "open"} />
      </motion.div>
    </motion.div>
  );
}
