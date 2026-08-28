"use client";

import { useDrag } from "@use-gesture/react";
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { ArrowUpRightIcon, CloseIcon } from "@/components/icons";
import { LogoMark } from "@/features/work/LogoMark";
import { findCaseCellRect, type CaseOrigin } from "@/features/work/origin-store";
import { track } from "@/lib/analytics";
import type { CaseStudy } from "@/lib/content/model";
import { useFocusTrap } from "@/lib/use-focus-trap";

import { DUR, EASE_EXIT, EASE_INOUT, EASE_OUT } from "@/lib/motion";

import styles from "./MobileCaseSheet.module.css";
import { PortableTextBody } from "./PortableTextBody";

/** Cinematic intro: logo travel, then the hero pans through the mask.
 *  Tuned to ~1.3s total — long enough to read as intentional, short enough
 *  to never feel like a loading screen. */
const TRAVEL_MS = 420;
const PAN_MS = 900;
/** The sheet starts rising just before the mask pan completes. */
const SHEET_AT_MS = TRAVEL_MS + PAN_MS - 120;
/** Native-feeling dismissal thresholds (distance px, velocity px/ms). */
const DISMISS_DISTANCE = 140;
const DISMISS_VELOCITY = 0.55;

type Phase = "intro" | "sheet" | "closing";

type MobileCaseSheetProps = {
  study: CaseStudy;
  origin: CaseOrigin | null;
  active: boolean;
  onNavigateClose: () => void;
};

/**
 * The mobile case-study experience. Opening from the canvas moves the logo
 * to a centred presentation, fills its mask with the hero image (left edges
 * aligned), pans the image through the mask for about two seconds, then
 * raises the full-screen sheet. Reduced motion skips the pan entirely.
 */
export function MobileCaseSheet({ study, origin, active, onNavigateClose }: MobileCaseSheetProps) {
  const reducedMotion = useReducedMotion();
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasIntro = origin !== null && !reducedMotion;
  const [phase, setPhase] = useState<Phase>(hasIntro ? "intro" : "sheet");
  const startedRef = useRef(false);
  const sheetY = useMotionValue(0);

  useFocusTrap(sheetRef, active && phase === "sheet", {
    initialFocus: "container",
    onEscape: () => requestClose(),
  });

  useEffect(() => {
    if (!active || startedRef.current || !hasIntro) return;
    startedRef.current = true;
    const timer = window.setTimeout(() => setPhase("sheet"), SHEET_AT_MS);
    return () => window.clearTimeout(timer);
  }, [active, hasIntro]);

  const requestClose = () => {
    if (phase === "closing") return;
    setPhase("closing");
  };

  // Drag-to-dismiss from the deliberate top gesture region only (the drag
  // handle and close strip) — scrolling the content can never accidentally
  // dismiss the sheet.
  useDrag(
    ({ event, first, last, movement: [, my], velocity: [, vy], cancel }) => {
      if (phase !== "sheet" || !active) return;
      if (first) {
        const target = event.target as HTMLElement | null;
        if (!target?.closest("[data-sheet-grip]")) {
          cancel();
          return;
        }
      }
      if (my <= 0 && sheetY.get() === 0) return;
      if (last) {
        if (my > DISMISS_DISTANCE || (vy > DISMISS_VELOCITY && my > 48)) {
          requestClose();
        } else {
          animate(sheetY, 0, { duration: 0.38, ease: EASE_OUT });
        }
        return;
      }
      sheetY.set(Math.max(0, my));
    },
    {
      target: sheetRef,
      axis: "y",
      pointer: { touch: true },
      eventOptions: { passive: false },
      enabled: active,
    },
  );

  // Closing choreography: the sheet slides away, the floating logo returns
  // to its grid cell, then navigation restores the untouched canvas.
  const [logoReturn, setLogoReturn] = useState<CaseOrigin["rect"] | null>(null);
  useEffect(() => {
    if (phase !== "closing" || !active) return;
    const target = findCaseCellRect(study.slug);
    const sheetDown = animate(sheetY, window.innerHeight * 1.05, {
      duration: reducedMotion ? 0.18 : 0.36,
      ease: EASE_EXIT,
    });
    let timer = 0;
    void sheetDown.then(() => {
      if (origin && target && !reducedMotion) {
        setLogoReturn(target);
        timer = window.setTimeout(onNavigateClose, 430);
      } else {
        onNavigateClose();
      }
    });
    return () => {
      sheetDown.stop();
      window.clearTimeout(timer);
    };
  }, [phase, active, study.slug, origin, reducedMotion, sheetY, onNavigateClose]);

  const presentation = (() => {
    if (typeof window === "undefined") return { x: 0, y: 0, width: 0, height: 0 };
    const width = Math.min(window.innerWidth * 0.68, 300);
    const height = width * 0.54;
    return {
      x: (window.innerWidth - width) / 2,
      y: window.innerHeight * 0.2,
      width,
      height,
    };
  })();

  return (
    <div className={styles.root}>
      {hasIntro || logoReturn ? (
        <motion.div
          className={styles.introScrim}
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: logoReturn ? 0 : 1 }}
          transition={{ duration: 0.4, ease: EASE_OUT }}
        />
      ) : null}
      {hasIntro || logoReturn ? (
        <motion.div
          className={styles.floatingLogo}
          initial={hasIntro ? { ...origin.rect } : { ...presentation }}
          animate={logoReturn ? { ...logoReturn } : { ...presentation }}
          transition={{
            duration: logoReturn ? 0.4 : TRAVEL_MS / 1000,
            ease: EASE_INOUT,
          }}
          aria-hidden
        >
          <span
            className={styles.introMask}
            style={{
              maskImage: `url("${study.logoUrl}")`,
              WebkitMaskImage: `url("${study.logoUrl}")`,
            }}
          >
            {/* Left edge aligned with the logo's left edge, panning across. */}
            <motion.img
              src={study.hero.url}
              alt=""
              className={styles.introHero}
              initial={{ objectPosition: "0% 50%", opacity: 0 }}
              animate={{
                objectPosition: logoReturn ? "0% 50%" : "100% 50%",
                opacity: logoReturn ? 0 : 1,
              }}
              transition={{
                objectPosition: {
                  delay: logoReturn ? 0 : TRAVEL_MS / 1000,
                  duration: logoReturn ? 0.2 : PAN_MS / 1000,
                  ease: "easeInOut",
                },
                opacity: { duration: 0.2, delay: logoReturn ? 0 : TRAVEL_MS / 1000 - 0.15 },
              }}
              draggable={false}
            />
          </span>
        </motion.div>
      ) : null}

      <motion.div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="case-sheet-title"
        tabIndex={-1}
        className={styles.sheet}
        style={{ y: sheetY }}
        initial={origin ? { y: "104%" } : false}
        animate={phase === "sheet" ? { y: 0 } : undefined}
        transition={{ duration: reducedMotion ? 0.2 : DUR.slow, ease: EASE_OUT }}
      >
        <div className={styles.handleArea} data-sheet-grip>
          <span className={styles.handle} aria-hidden />
        </div>
        <button
          type="button"
          data-close
          className={styles.close}
          aria-label="Close case study"
          onClick={requestClose}
        >
          <CloseIcon />
        </button>

        <div ref={scrollRef} className={styles.scroller}>
          <header className={styles.header}>
            <span className={styles.sheetLogo}>
              <LogoMark logoUrl={study.logoUrl} />
            </span>
            <h1 id="case-sheet-title" className={styles.title}>
              {study.title}
            </h1>
            {study.subtitle ? <p className={styles.subtitle}>{study.subtitle}</p> : null}
            <p className={styles.meta}>
              <span>{study.clientName}</span>
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
              </a>
            ) : null}
          </header>

          <div className={styles.gallery}>
            {study.gallery.map((item, index) => (
              <figure key={`${item.url}-${index}`} className={styles.galleryItem}>
                <Image
                  src={item.url}
                  alt={item.alt}
                  width={item.width}
                  height={item.height}
                  className={styles.galleryImage}
                  sizes="94vw"
                  loading={index === 0 ? "eager" : "lazy"}
                  placeholder={item.lqip ? "blur" : "empty"}
                  blurDataURL={item.lqip ?? undefined}
                />
                {item.caption ? (
                  <figcaption className={styles.caption}>{item.caption}</figcaption>
                ) : null}
              </figure>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
