"use client";

import { motion, useAnimationControls, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { ArrowUpRightIcon, CloseIcon } from "@/components/icons";
import { LogoMark } from "@/features/work/LogoMark";
import { findCaseCellRect, type CaseOrigin } from "@/features/work/origin-store";
import { track } from "@/lib/analytics";
import type { CaseStudy } from "@/lib/content/model";
import { useFocusTrap } from "@/lib/use-focus-trap";

import { DUR, EASE_EXIT, EASE_INOUT, EASE_OUT } from "@/lib/motion";

import styles from "./DesktopCaseModal.module.css";
import { Gallery } from "./Gallery";
import { PortableTextBody } from "./PortableTextBody";

/** Written content cascades in one element at a time once the mark settles. */
const contentStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
} as const;

const contentItem = {
  hidden: { opacity: 0, y: 16, transition: { duration: 0.22, ease: EASE_EXIT } },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE_OUT } },
} as const;

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
 * the plain monochrome mark expands and travels into the left information
 * panel, the modal structure resolves around it, and the written content and
 * gallery enter last. Closing plays the same journey in reverse toward the
 * (still mounted) grid cell.
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
      .start({ x: 0, y: 0, scale: 1, transition: { duration: DUR.slow, ease: EASE_INOUT } })
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
        transition: { duration: 0.5, ease: EASE_INOUT },
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
        duration: phase === "closing" ? 0.36 : 0.32,
        ease: phase === "closing" ? EASE_EXIT : EASE_OUT,
        delay: phase === "closing" ? 0.2 : 0,
      }}
    >
      <div className={styles.frame}>
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
          <motion.div
            ref={logoBoxRef}
            className={styles.logoBox}
            animate={logoControls}
            aria-hidden
          >
            <LogoMark logoUrl={study.logoUrl} />
          </motion.div>

          <motion.div
            className={styles.content}
            variants={origin ? contentStagger : undefined}
            initial={origin ? "hidden" : false}
            animate={contentVisible ? "visible" : "hidden"}
          >
            <motion.h1 id="case-study-title" className={styles.title} variants={contentItem}>
              {study.title}
            </motion.h1>
            {study.subtitle ? (
              <motion.p className={styles.subtitle} variants={contentItem}>
                {study.subtitle}
              </motion.p>
            ) : null}
            <motion.div className={styles.meta} variants={contentItem}>
              <span className={styles.metaDate}>{study.displayDate}</span>
              {study.tags.map((tag) => (
                <span key={tag} className={styles.tagPill}>
                  {tag}
                </span>
              ))}
            </motion.div>
            <motion.div className={styles.body} variants={contentItem}>
              <PortableTextBody value={study.body} fallback={study.summary} />
            </motion.div>
            {study.externalUrl ? (
              <motion.a
                className={styles.external}
                variants={contentItem}
                href={study.externalUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() =>
                  track({
                    name: "external_link_followed",
                    slug: study.slug,
                    url: study.externalUrl!,
                  })
                }
              >
                Visit project
                <ArrowUpRightIcon />
                <span className="visually-hidden">(external site, opens in a new tab)</span>
              </motion.a>
            ) : null}
          </motion.div>
        </div>

        <motion.div
          className={styles.media}
          initial={origin ? { opacity: 0, x: 36 } : false}
          animate={contentVisible ? { opacity: 1, x: 0 } : { opacity: 0 }}
          transition={{ duration: 0.65, ease: EASE_OUT, delay: contentVisible ? 0.12 : 0 }}
        >
          <Gallery media={study.gallery} slug={study.slug} active={active && phase === "open"} />
        </motion.div>
      </div>
    </motion.div>
  );
}
