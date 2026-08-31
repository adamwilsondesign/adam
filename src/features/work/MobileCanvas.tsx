"use client";

import { useGesture } from "@use-gesture/react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { track } from "@/lib/analytics";
import type { WorkClient } from "@/lib/content/model";
import { EASE_INOUT, EASE_OUT } from "@/lib/motion";

import styles from "./MobileCanvas.module.css";
import { LogoMark } from "./LogoMark";
import { opticalLogoBox } from "./optical";
import { setCaseOrigin } from "./origin-store";
import { readCanvasSnapshot, saveCanvasSnapshot } from "./work-state-store";

const GAP = 10;
const MIN_CELL = 92;
const MAX_CELL = 210;
const INITIAL_CELL = 136;
/** How far the canvas may be dragged past its natural bounds. */
const BLEED = 44;
/** Commit a new column count when the live pinch scale drifts this far. */
const COMMIT_UP = 1.24;
const COMMIT_DOWN = 0.8;
/** Ignore taps this soon after a pan/pinch, to stop accidental opens. */
const TAP_SUPPRESS_MS = 180;

type MobileCanvasProps = {
  clients: WorkClient[];
  openSlug: string | null;
  /** Client shown in the info overlay (its cell hides while open). */
  infoClientId: string | null;
  onInfoOpen: (client: WorkClient, rect: DOMRect) => void;
  /** False the moment a logo activation begins — pan/pinch freeze instantly. */
  gesturesEnabled: boolean;
};

/** Below this cell size, clients with a compact alternate mark use it. */
const COMPACT_BELOW = 112;

function clampRange(viewport: number, content: number, bleed: number): [number, number] {
  if (content >= viewport) return [viewport - content - bleed, bleed];
  const centered = (viewport - content) / 2;
  return [centered - bleed, centered + bleed];
}

/**
 * The mobile Work canvas: a bounded two-dimensional logo field that pans in
 * every direction and changes density with pinch. Pinch-in enlarges logos
 * (fewer columns), pinch-out shows more columns; cells resize continuously
 * during the gesture (a live transform) and the column count commits at
 * density thresholds, reflowing smoothly around the gesture midpoint.
 */
export function MobileCanvas({
  clients,
  openSlug,
  infoClientId,
  onInfoOpen,
  gesturesEnabled,
}: MobileCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  const [cellSize, setCellSize] = useState(() => readCanvasSnapshot()?.cellSize ?? INITIAL_CELL);
  const [viewport, setViewport] = useState<{ width: number; height: number } | null>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const liveScale = useMotionValue(1);
  const suppressTapUntil = useRef(0);
  /** Pinch baseline, re-based at every threshold commit. */
  const pinchBase = useRef<{ x0: number; y0: number; cell0: number; ms0: number } | null>(null);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setViewport({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const columns = useMemo(() => {
    if (!viewport) return 3;
    return Math.max(2, Math.min(8, Math.round((viewport.width * 1.16) / cellSize)));
  }, [viewport, cellSize]);

  const rows = Math.ceil(clients.length / columns);
  const canvasWidth = columns * cellSize + (columns - 1) * GAP;
  const canvasHeight = rows * cellSize + (rows - 1) * GAP;

  const clampPan = useCallback(
    (px: number, py: number): [number, number] => {
      if (!viewport) return [px, py];
      const [minX, maxX] = clampRange(viewport.width, canvasWidth, BLEED);
      const [minY, maxY] = clampRange(viewport.height, canvasHeight, BLEED);
      return [Math.min(maxX, Math.max(minX, px)), Math.min(maxY, Math.max(minY, py))];
    },
    [viewport, canvasWidth, canvasHeight],
  );

  // Center the canvas on first measure (or restore the saved exploration
  // position) and re-clamp when the composition changes.
  const centeredRef = useRef(false);
  useEffect(() => {
    if (!viewport) return;
    if (!centeredRef.current) {
      centeredRef.current = true;
      const saved = readCanvasSnapshot();
      if (saved) {
        const [sx, sy] = clampPan(saved.x, saved.y);
        x.set(sx);
        y.set(sy);
      } else {
        x.set((viewport.width - canvasWidth) / 2);
        y.set((viewport.height - canvasHeight) / 2);
      }
      return;
    }
    const [cx, cy] = clampPan(x.get(), y.get());
    if (cx !== x.get()) animate(x, cx, { duration: 0.45, ease: EASE_OUT });
    if (cy !== y.get()) animate(y, cy, { duration: 0.45, ease: EASE_OUT });
  }, [viewport, canvasWidth, canvasHeight, clampPan, x, y]);

  /** Persist the exploration state so revisits restore it exactly. */
  const persistCanvas = useCallback((px: number, py: number, cell: number) => {
    saveCanvasSnapshot({ cellSize: cell, x: px, y: py });
  }, []);

  useGesture(
    {
      onDrag: ({
        pinching,
        cancel,
        offset: [ox, oy],
        last,
        velocity: [vx, vy],
        direction: [dx, dy],
        movement,
      }) => {
        if (pinching) {
          cancel();
          return;
        }
        if (Math.hypot(movement[0], movement[1]) > 6) {
          suppressTapUntil.current = performance.now() + TAP_SUPPRESS_MS;
        }
        if (last) {
          // Glide out with the release velocity, settling inside the bounds.
          const speed = Math.hypot(vx, vy);
          const [tx, ty] = clampPan(ox + dx * speed * 90, oy + dy * speed * 90);
          animate(x, tx, { duration: 0.55, ease: EASE_OUT });
          animate(y, ty, { duration: 0.55, ease: EASE_OUT });
          persistCanvas(tx, ty, cellSize);
          return;
        }
        x.set(ox);
        y.set(oy);
      },
      onPinch: ({ origin: [gox, goy], movement: [ms], first, last }) => {
        suppressTapUntil.current = performance.now() + TAP_SUPPRESS_MS;
        const viewportRect = viewportRef.current?.getBoundingClientRect();
        const originX = gox - (viewportRect?.left ?? 0);
        const originY = goy - (viewportRect?.top ?? 0);

        if (first || !pinchBase.current) {
          pinchBase.current = { x0: x.get(), y0: y.get(), cell0: cellSize, ms0: ms };
          return;
        }
        const base = pinchBase.current;

        // Spec: pinch inward enlarges logos, pinch outward adds columns —
        // the inverse of the raw gesture scale.
        const desiredCell = Math.min(MAX_CELL, Math.max(MIN_CELL, base.cell0 * (base.ms0 / ms)));
        const factor = desiredCell / base.cell0;

        // Live: scale around the gesture midpoint (transform-origin is 0 0,
        // so the translate compensates to anchor the midpoint).
        liveScale.set(factor);
        x.set(originX - (originX - base.x0) * factor);
        y.set(originY - (originY - base.y0) * factor);

        if (factor > COMMIT_UP || factor < COMMIT_DOWN || last) {
          // Commit: bake the visual scale into the cell size. The pan is
          // already midpoint-compensated; the column count recalculates and
          // logos reflow smoothly from here.
          liveScale.set(1);
          setCellSize(desiredCell);
          pinchBase.current = { x0: x.get(), y0: y.get(), cell0: desiredCell, ms0: ms };
        }

        if (last) {
          pinchBase.current = null;
          const [cx2, cy2] = clampPan(x.get(), y.get());
          if (cx2 !== x.get()) animate(x, cx2, { duration: 0.4, ease: EASE_OUT });
          if (cy2 !== y.get()) animate(y, cy2, { duration: 0.4, ease: EASE_OUT });
          persistCanvas(cx2, cy2, desiredCell);
        }
      },
    },
    {
      target: viewportRef,
      // Activation freeze: the first tap on a logo disables the gesture layer
      // so no pan or pinch can disturb the departure composition.
      enabled: gesturesEnabled,
      eventOptions: { passive: false },
      drag: {
        from: () => [x.get(), y.get()],
        bounds: () => {
          if (!viewport) return {};
          const [minX, maxX] = clampRange(viewport.width, canvasWidth, BLEED);
          const [minY, maxY] = clampRange(viewport.height, canvasHeight, BLEED);
          return { left: minX, right: maxX, top: minY, bottom: maxY };
        },
        rubberband: 0.18,
        pointer: { touch: true },
      },
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
    <div ref={viewportRef} className={styles.viewport}>
      <motion.div
        ref={canvasRef}
        className={styles.canvas}
        style={{
          x,
          y,
          scale: liveScale,
          width: canvasWidth,
          transformOrigin: "0 0",
          gridTemplateColumns: `repeat(${columns}, ${cellSize}px)`,
          gap: GAP,
        }}
        onClickCapture={suppressAccidentalTap}
      >
        <AnimatePresence initial={false}>
          {clients.map((client) => (
            <motion.div
              key={client.id}
              layout={!reducedMotion}
              className={styles.cellBox}
              style={{ width: cellSize, height: cellSize }}
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
                compact={cellSize < COMPACT_BELOW}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
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
        <span className={styles.logoBox} style={logoBoxStyle}>
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
      <span className={styles.logoBox} style={logoBoxStyle}>
        <LogoMark logoUrl={client.logoUrl} treatment={client.logoTreatment} compact={compact} />
      </span>
    </button>
  );
}
