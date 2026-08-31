"use client";

import { useDrag } from "@use-gesture/react";
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { ArrowUpRightIcon } from "@/components/icons";
import { LogoMark } from "@/features/work/LogoMark";
import { type CaseOrigin } from "@/features/work/origin-store";
import { track } from "@/lib/analytics";
import type { CaseStudy } from "@/lib/content/model";
import { useFocusTrap } from "@/lib/use-focus-trap";

import { DUR, EASE_EXIT, EASE_OUT } from "@/lib/motion";

import {
  orderedCaseList,
  orderedCaseSiblings,
  resolveCaseList,
  resolveSiblings,
  type CaseSibling,
} from "./case-siblings";
import styles from "./MobileCaseSheet.module.css";
import { PortableTextBody } from "./PortableTextBody";

/** Native-feeling dismissal thresholds (distance px, velocity px/ms). */
const DISMISS_DISTANCE = 140;
const DISMISS_VELOCITY = 0.55;
/** Horizontal travel needed to swipe to the previous / next case study. */
const SWIPE_DISTANCE = 90;

type Phase = "intro" | "sheet" | "closing";

type MobileCaseSheetProps = {
  study: CaseStudy;
  origin: CaseOrigin | null;
  active: boolean;
  /** All case studies (index order); the filtered composition refines it. */
  siblings: CaseSibling[];
  onNavigateClose: () => void;
  onNavigateSibling: (slug: string) => void;
};

/**
 * The mobile case-study experience: the sheet rises directly over the grid —
 * one clean movement, no intermediate logo travel.
 */
export function MobileCaseSheet({
  study,
  origin,
  active,
  siblings,
  onNavigateClose,
  onNavigateSibling,
}: MobileCaseSheetProps) {
  const reducedMotion = useReducedMotion();
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("sheet");
  const sheetY = useMotionValue(0);
  const sheetX = useMotionValue(0);

  // Prev/next follow the filtered composition once the client session state
  // is readable; the server (and first client render) use the full index
  // order so hydration stays consistent.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const pair = useMemo(
    () =>
      mounted
        ? orderedCaseSiblings(siblings, study.slug)
        : resolveSiblings(siblings, null, study.slug),
    [mounted, siblings, study.slug],
  );
  const moreStudies = useMemo(() => {
    const list = mounted
      ? orderedCaseList(siblings, study.slug)
      : resolveCaseList(siblings, null, study.slug);
    return list.filter((sibling) => sibling.slug !== study.slug);
  }, [mounted, siblings, study.slug]);

  useFocusTrap(sheetRef, active && phase === "sheet", {
    initialFocus: "container",
    onEscape: () => requestClose(),
  });

  const requestClose = () => {
    if (phase === "closing") return;
    setPhase("closing");
  };

  // Horizontal swipe anywhere on the sheet progresses through the filtered
  // case studies: content follows the finger with resistance, and a decisive
  // swipe replaces the slug in place (Back still closes to the grid).
  useDrag(
    ({ first, last, movement: [mx], cancel, event }) => {
      if (phase !== "sheet" || !active) return;
      if (first) {
        const target = event.target as HTMLElement | null;
        if (target?.closest("[data-sheet-grip]")) {
          cancel();
          return;
        }
      }
      if (last) {
        const destination =
          mx < -SWIPE_DISTANCE && pair.next
            ? pair.next
            : mx > SWIPE_DISTANCE && pair.prev
              ? pair.prev
              : null;
        if (destination) {
          animate(sheetX, mx < 0 ? -72 : 72, { duration: 0.18, ease: EASE_EXIT });
          onNavigateSibling(destination.slug);
        } else {
          animate(sheetX, 0, { duration: 0.32, ease: EASE_OUT });
        }
        return;
      }
      // Follow with resistance, hard-capped so content stays legible.
      sheetX.set(Math.max(-110, Math.min(110, mx * 0.45)));
    },
    {
      target: sheetRef,
      axis: "x",
      pointer: { touch: true },
      enabled: active,
    },
  );

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

  // Closing: the sheet slides away, then navigation restores the canvas.
  useEffect(() => {
    if (phase !== "closing" || !active) return;
    const sheetDown = animate(sheetY, window.innerHeight * 1.05, {
      duration: reducedMotion ? 0.18 : 0.36,
      ease: EASE_EXIT,
    });
    void sheetDown.then(onNavigateClose);
    return () => {
      sheetDown.stop();
    };
  }, [phase, active, reducedMotion, sheetY, onNavigateClose]);

  return (
    <div className={styles.root}>
      <motion.div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="case-sheet-title"
        tabIndex={-1}
        className={styles.sheet}
        style={{ x: sheetX, y: sheetY }}
        initial={origin ? { y: "104%" } : false}
        animate={phase === "sheet" ? { y: 0 } : undefined}
        transition={{ duration: reducedMotion ? 0.2 : DUR.slow, ease: EASE_OUT }}
      >
        <div className={styles.handleArea} data-sheet-grip>
          <span className={styles.handle} aria-hidden />
        </div>

        <div ref={scrollRef} className={styles.scroller}>
          <header className={styles.header}>
            <span className={styles.sheetLogo}>
              <LogoMark logoUrl={study.logoUrl} />
            </span>
            <h1 id="case-sheet-title" className={styles.title}>
              {study.title}
            </h1>
            {study.subtitle ? <p className={styles.subtitle}>{study.subtitle}</p> : null}
            <div className={styles.meta}>
              <span className={styles.metaDate}>{study.displayDate}</span>
              {study.tags.map((tag) => (
                <span key={tag} className={styles.tagPill}>
                  {tag}
                </span>
              ))}
            </div>
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
                {item.kind === "video" ? (
                  <video
                    src={item.url}
                    className={styles.galleryVideo}
                    style={{ aspectRatio: item.aspect === "square" ? "1 / 1" : "16 / 9" }}
                    poster={item.posterUrl ?? undefined}
                    controls
                    playsInline
                    preload="metadata"
                    aria-label={item.alt}
                  />
                ) : (
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
                )}
                {item.caption ? (
                  <figcaption className={styles.caption}>{item.caption}</figcaption>
                ) : null}
              </figure>
            ))}
          </div>

          {moreStudies.length > 0 ? (
            <nav className={styles.siblingNav} aria-label="More case studies">
              <span className={styles.siblingEyebrow}>more case studies</span>
              <div className={styles.siblingRow}>
                {moreStudies.map((sibling) => (
                  <button
                    key={sibling.slug}
                    type="button"
                    className={styles.siblingLogo}
                    aria-label={`${sibling.clientName} — ${sibling.title}`}
                    onClick={() => onNavigateSibling(sibling.slug)}
                  >
                    <span className={styles.siblingMark}>
                      <LogoMark logoUrl={sibling.logoUrl} />
                    </span>
                  </button>
                ))}
              </div>
            </nav>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}
