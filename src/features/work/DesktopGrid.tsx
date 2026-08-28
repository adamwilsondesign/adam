"use client";

import { AnimatePresence, motion, useMotionValue, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { track } from "@/lib/analytics";
import type { WorkClient } from "@/lib/content/model";

import { DUR, EASE_INOUT, EASE_OUT } from "@/lib/motion";

import styles from "./DesktopGrid.module.css";
import { computeCellRects, computeGridLayout } from "./grid-layout";
import { LogoCell, type TooltipIntents } from "./LogoCell";
import { WorkTooltip, type TooltipAnchor } from "./Tooltip";

const GAP = 22;
/** Tooltip hover-intent delay and pointer-corridor grace. */
const TOOLTIP_OPEN_MS = 150;
const TOOLTIP_CLOSE_GRACE_MS = 140;

type DesktopGridProps = {
  clients: WorkClient[];
  openSlug: string | null;
};

type TooltipState = TooltipAnchor & {
  forClients: WorkClient[];
  sticky: boolean;
};

/**
 * The fixed-viewport desktop logo field. Every visible client fits inside
 * the safe area between header and dock; the row/column arrangement is
 * recomputed as filtering changes the count, and survivors glide from their
 * current positions into their new cells while entries fade in and exits
 * contract away. New input retargets in-flight animations — nothing queues.
 *
 * Keyboard: the grid is one tab stop (roving tabindex); arrows move between
 * cells, Home/End jump to the first and last.
 */
export function DesktopGrid({ clients, openSlug }: DesktopGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const reducedMotion = useReducedMotion();

  // ---- Tooltip state machine -------------------------------------------
  // The tooltip remembers which composition it was opened against, so any
  // recomposition (filter change, shuffle) dismisses it automatically.
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (openTimer.current !== null) window.clearTimeout(openTimer.current);
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const openTooltip = useCallback(
    (client: WorkClient, rect: DOMRect, sticky: boolean) => {
      setTooltip({
        client,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        forClients: clients,
        sticky,
      });
    },
    [clients],
  );

  const tooltipIntents = useMemo<TooltipIntents>(() => {
    const scheduleOpen = (client: WorkClient, rect: DOMRect, delay: number) => {
      clearTimers();
      openTimer.current = window.setTimeout(() => openTooltip(client, rect, false), delay);
    };
    const scheduleClose = () => {
      if (openTimer.current !== null) window.clearTimeout(openTimer.current);
      openTimer.current = null;
      closeTimer.current = window.setTimeout(() => {
        setTooltip((current) => (current?.sticky ? current : null));
      }, TOOLTIP_CLOSE_GRACE_MS);
    };
    return {
      hoverStart: (client, rect) => scheduleOpen(client, rect, TOOLTIP_OPEN_MS),
      hoverEnd: scheduleClose,
      focusStart: (client, rect) => scheduleOpen(client, rect, 100),
      focusEnd: scheduleClose,
      stickyToggle: (client, rect) => {
        clearTimers();
        track({ name: "client_info_opened", clientId: client.id });
        setTooltip((current) =>
          current?.sticky && current.client.id === client.id
            ? null
            : {
                client,
                rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                forClients: clients,
                sticky: true,
              },
        );
      },
    };
  }, [clients, clearTimers, openTooltip]);

  /** The card dodged away from the cursor: hold it readable for a while,
   *  then let it close unless the logo (or card) is re-engaged. */
  const dodgeTooltip = useCallback(() => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      setTooltip((current) => (current?.sticky ? current : null));
    }, 1500);
  }, []);

  // The tooltip only shows for the composition it was opened against.
  const activeTooltip = tooltip && tooltip.forClients === clients ? tooltip : null;

  useEffect(() => {
    if (!activeTooltip) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTooltip(null);
    };
    // A viewport resize reflows the grid, leaving the anchor rect stale.
    const onResize = () => setTooltip(null);
    // A sticky tooltip dismisses on any press outside its trigger or itself.
    const onPointerDown = (event: PointerEvent) => {
      if (!activeTooltip.sticky) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest(`[data-client-cell="${activeTooltip.client.id}"]`)) return;
      if (target.closest("#work-tooltip")) return;
      setTooltip(null);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [activeTooltip]);

  // ---- Contextual cursor label (motion values; no re-render per move) ---
  const cursorX = useMotionValue(0);
  const cursorY = useMotionValue(0);
  const [cursorLabel, setCursorLabel] = useState<string | null>(null);

  const onFieldPointerMove = useCallback(
    (event: React.PointerEvent) => {
      cursorX.set(event.clientX + 14);
      cursorY.set(event.clientY + 18);
    },
    [cursorX, cursorY],
  );

  // ---- Entrance staggering (initial Work entrance only) -----------------
  const [entering, setEntering] = useState(true);
  useEffect(() => {
    const timeout = window.setTimeout(() => setEntering(false), 850);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let frame = 0;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      });
    });
    observer.observe(container);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  const { rects, columns } = useMemo(() => {
    if (!size) return { rects: [], columns: 1 };
    const layout = computeGridLayout({
      count: clients.length,
      width: size.width,
      height: size.height,
      gap: GAP,
    });
    return {
      rects: computeCellRects(clients.length, layout, GAP),
      columns: Math.max(1, layout.columns),
    };
  }, [clients.length, size]);

  // ---- Roving tabindex ---------------------------------------------------
  const [focusIndex, setFocusIndex] = useState(0);
  const effectiveFocus = Math.min(focusIndex, Math.max(0, clients.length - 1));

  const moveFocus = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(clients.length - 1, next));
      setFocusIndex(clamped);
      const cell = listRef.current?.querySelector<HTMLElement>(`[data-grid-index="${clamped}"]`);
      cell?.focus();
    },
    [clients.length],
  );

  const onGridKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      let next: number | null = null;
      switch (event.key) {
        case "ArrowRight":
          next = effectiveFocus + 1;
          break;
        case "ArrowLeft":
          next = effectiveFocus - 1;
          break;
        case "ArrowDown":
          next = effectiveFocus + columns;
          break;
        case "ArrowUp":
          next = effectiveFocus - columns;
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = clients.length - 1;
          break;
        default:
          return;
      }
      event.preventDefault();
      moveFocus(next);
    },
    [effectiveFocus, columns, clients.length, moveFocus],
  );

  return (
    <div ref={containerRef} className={styles.field} onPointerMove={onFieldPointerMove}>
      <ul ref={listRef} className={styles.list} aria-label="Clients" onKeyDown={onGridKeyDown}>
        <AnimatePresence initial={false}>
          {size &&
            clients.map((client, index) => {
              const rect = rects[index];
              if (!rect) return null;
              const entranceDelay = entering ? Math.min(index * 0.02, 0.36) : 0;
              return (
                <motion.li
                  key={client.id}
                  className={styles.item}
                  initial={{
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                    opacity: 0,
                    scale: reducedMotion ? 1 : 0.9,
                  }}
                  animate={{
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                    opacity: 1,
                    scale: 1,
                  }}
                  exit={{
                    opacity: 0,
                    scale: reducedMotion ? 1 : 0.9,
                    transition: { duration: reducedMotion ? 0.12 : 0.26, ease: EASE_INOUT },
                  }}
                  transition={{
                    duration: reducedMotion ? 0.16 : entering ? DUR.slow : DUR.grid,
                    ease: entering ? EASE_OUT : EASE_INOUT,
                    delay: entranceDelay,
                  }}
                >
                  <LogoCell
                    client={client}
                    openSlug={openSlug}
                    infoOpen={activeTooltip?.client.id === client.id}
                    tabIndex={index === effectiveFocus ? 0 : -1}
                    gridIndex={index}
                    onFocusIndex={setFocusIndex}
                    onCursorLabel={setCursorLabel}
                    tooltip={tooltipIntents}
                  />
                </motion.li>
              );
            })}
        </AnimatePresence>
      </ul>
      <WorkTooltip anchor={activeTooltip} onDodge={dodgeTooltip} />
      <AnimatePresence>
        {/* The "details" label yields once its tooltip is actually open. */}
        {cursorLabel && !(cursorLabel === "details" && activeTooltip) ? (
          <motion.span
            className={styles.cursorLabel}
            style={{ x: cursorX, y: cursorY }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: EASE_OUT }}
            aria-hidden
          >
            {cursorLabel}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
