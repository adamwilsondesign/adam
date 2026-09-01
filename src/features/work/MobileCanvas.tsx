"use client";

import { useGesture } from "@use-gesture/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { measureStarTargets, provideWorkTargets } from "@/features/sky/sky-director";
import { track } from "@/lib/analytics";
import type { WorkClient } from "@/lib/content/model";
import { EASE_INOUT } from "@/lib/motion";

import styles from "./MobileCanvas.module.css";
import { LogoMark } from "./LogoMark";
import { opticalLogoBox } from "./optical";
import { setCaseOrigin } from "./origin-store";
import { readCanvasSnapshot, saveCanvasSnapshot } from "./work-state-store";

const MIN_COLUMNS = 1;
const MAX_COLUMNS = 4;
const DEFAULT_COLUMNS = 3;
/** Pinch ratio that commits a column change (spread → fewer, larger). */
const COMMIT_IN = 1.3;
const COMMIT_OUT = 1 / COMMIT_IN;
/** Ignore taps this soon after a pinch, to stop accidental opens. */
const TAP_SUPPRESS_MS = 220;
/** Below this cell width, clients with a compact alternate mark use it. */
const COMPACT_BELOW = 112;

type MobileCanvasProps = {
  clients: WorkClient[];
  openSlug: string | null;
  /** Client shown in the info overlay (its cell hides while open). */
  infoClientId: string | null;
  onInfoOpen: (client: WorkClient, rect: DOMRect) => void;
  /** False the moment a logo activation begins — pinches freeze instantly. */
  gesturesEnabled: boolean;
  /** True while the star-to-logo entrance owns cell visibility. */
  starEntrance?: boolean;
  /** Fired once the star flight has resolved every logo. */
  onEntranceSettled?: () => void;
};

/**
 * The mobile Work canvas: a vertically scrolling logo grid. Scrolling is
 * native and vertical-only; pinching changes density between one and four
 * columns — spreading the fingers zooms in (fewer, larger logos), pinching
 * together zooms out (more, smaller ones).
 */
export function MobileCanvas({
  clients,
  openSlug,
  infoClientId,
  onInfoOpen,
  gesturesEnabled,
  starEntrance = false,
  onEntranceSettled,
}: MobileCanvasProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  const [columns, setColumns] = useState(() => {
    const saved = readCanvasSnapshot()?.columns;
    return saved ? Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS, saved)) : DEFAULT_COLUMNS;
  });
  const [cellWidth, setCellWidth] = useState<number | null>(null);
  const suppressTapUntil = useRef(0);
  /** Pinch baseline scale, re-based at every committed column change. */
  const pinchBase = useRef<number | null>(null);

  // Measure the grid track so compact-mark decisions track real cell size.
  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setCellWidth(width / columns);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [columns]);

  // Restore the saved exploration position once, then persist as it scrolls.
  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    const saved = readCanvasSnapshot();
    if (saved) node.scrollTop = saved.scrollY;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        saveCanvasSnapshot({ columns, scrollY: node.scrollTop });
      });
    };
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      node.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [columns]);

  // Star entrance: measure the (scroll-restored) logo boxes once and hand
  // them to the sky director. Offscreen cells still take part — their stars
  // fly toward positions past the fold and fade en route.
  const providedTargets = useRef(false);
  const settled = useRef(onEntranceSettled);
  useEffect(() => {
    settled.current = onEntranceSettled;
  }, [onEntranceSettled]);
  useEffect(() => {
    if (!starEntrance || providedTargets.current) return;
    providedTargets.current = true;
    if (clients.length === 0) {
      settled.current?.();
      return;
    }
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        provideWorkTargets(measureStarTargets(), () => settled.current?.());
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [starEntrance, clients.length]);

  useGesture(
    {
      onPinch: ({ first, last, movement: [scale], event }) => {
        event.preventDefault();
        suppressTapUntil.current = performance.now() + TAP_SUPPRESS_MS;
        if (first || pinchBase.current === null) {
          pinchBase.current = scale;
          return;
        }
        const ratio = scale / pinchBase.current;
        if (ratio > COMMIT_IN) {
          // Fingers spreading: zoom in — fewer, larger logos.
          setColumns((current) => Math.max(MIN_COLUMNS, current - 1));
          pinchBase.current = scale;
        } else if (ratio < COMMIT_OUT) {
          // Fingers closing: zoom out — more, smaller logos.
          setColumns((current) => Math.min(MAX_COLUMNS, current + 1));
          pinchBase.current = scale;
        }
        if (last) pinchBase.current = null;
      },
    },
    {
      target: scrollerRef,
      enabled: gesturesEnabled,
      eventOptions: { passive: false },
      pinch: { pointer: { touch: true } },
    },
  );

  const suppressAccidentalTap = (event: React.MouseEvent) => {
    if (performance.now() < suppressTapUntil.current) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return (
    <div
      ref={scrollerRef}
      className={styles.scroller}
      data-star-entrance={starEntrance || undefined}
      onClickCapture={suppressAccidentalTap}
    >
      <div className={styles.grid} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        <AnimatePresence initial={false}>
          {clients.map((client) => (
            <motion.div
              key={client.id}
              layout={!reducedMotion}
              className={styles.cellBox}
              initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: reducedMotion ? 1 : 0.88 }}
              transition={{ duration: reducedMotion ? 0.15 : 0.42, ease: EASE_INOUT }}
            >
              <MobileCell
                client={client}
                openSlug={openSlug}
                hidden={client.id === infoClientId}
                onInfoOpen={onInfoOpen}
                compact={(cellWidth ?? 999) < COMPACT_BELOW}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

type MobileCellProps = {
  client: WorkClient;
  openSlug: string | null;
  hidden: boolean;
  onInfoOpen: (client: WorkClient, rect: DOMRect) => void;
  /** True when cells are small enough to prefer compact alternate marks. */
  compact: boolean;
};

function MobileCell({ client, openSlug, hidden, onInfoOpen, compact }: MobileCellProps) {
  const ref = useRef<HTMLElement | null>(null);
  const caseStudy = client.caseStudy;
  const isOrigin = caseStudy !== null && caseStudy.slug === openSlug;
  const optical = opticalLogoBox(client.logoAspect, client.logoTreatment);
  const logoBoxStyle: React.CSSProperties = {
    width: `${optical.widthPct}%`,
    height: `${optical.heightPct}%`,
  };

  const markRect = (): DOMRect => {
    const mask = ref.current?.querySelector("[data-logo-mask]");
    return (mask ?? ref.current!).getBoundingClientRect();
  };

  if (caseStudy) {
    return (
      <Link
        ref={(node) => {
          ref.current = node;
        }}
        href={`/work/${caseStudy.slug}`}
        className={`${styles.cell} ${styles.cellCase}`}
        data-client-cell={client.id}
        data-case-cell={caseStudy.slug}
        aria-label={`${client.name} — open case study “${caseStudy.title}”`}
        aria-hidden={isOrigin || hidden || undefined}
        tabIndex={isOrigin || hidden ? -1 : undefined}
        style={isOrigin || hidden ? { opacity: 0, pointerEvents: "none" } : undefined}
        onClick={() => {
          const rect = markRect();
          setCaseOrigin({
            slug: caseStudy.slug,
            rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            logoUrl: client.logoUrl,
          });
          track({ name: "case_study_opened", slug: caseStudy.slug, source: "grid" });
        }}
      >
        <span className={styles.logoBox} data-star-target={client.id} style={logoBoxStyle}>
          <LogoMark logoUrl={client.logoUrl} treatment={client.logoTreatment} compact={compact} />
        </span>
      </Link>
    );
  }

  return (
    <button
      ref={(node) => {
        ref.current = node;
      }}
      type="button"
      className={styles.cell}
      data-client-cell={client.id}
      aria-label={`${client.name} — details`}
      aria-haspopup="dialog"
      style={hidden ? { opacity: 0, pointerEvents: "none" } : undefined}
      onClick={() => onInfoOpen(client, markRect())}
    >
      <span className={styles.logoBox} data-star-target={client.id} style={logoBoxStyle}>
        <LogoMark logoUrl={client.logoUrl} treatment={client.logoTreatment} compact={compact} />
      </span>
    </button>
  );
}
