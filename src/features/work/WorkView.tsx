"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { TunnelTransition } from "@/components/secret/TunnelTransition";
import {
  beginHomeFlight,
  consumeWorkEntrance,
  measureStarTargets,
} from "@/features/sky/sky-director";
import { track } from "@/lib/analytics";
import type { WorkClient, YearRange } from "@/lib/content/model";
import { DUR, EASE_EXIT, EASE_OUT } from "@/lib/motion";
import { setShellNavigationInterceptor } from "@/lib/shell-navigation";
import { MOBILE_WORK_QUERY, useMediaQuery } from "@/lib/use-media-query";

import { DesktopGrid } from "./DesktopGrid";
import { EmptyState } from "./EmptyState";
import { FilterDock } from "./FilterDock";
import { MobileCanvas } from "./MobileCanvas";
import { MobileInfoCard, type InfoOverlayState } from "./MobileInfoCard";
import { useWorkState } from "./useWorkState";
import styles from "./WorkView.module.css";

type WorkViewProps = {
  clients: WorkClient[];
  bounds: YearRange;
};

const EXIT_DURATION = 0.3;

/**
 * The Work state: one fixed viewport with the logo field between the header
 * and the floating filter dock. Desktop composes a single-viewport grid;
 * mobile a pannable, pinchable canvas. This component stays mounted while
 * case-study overlays are open, preserving the exact composition beneath.
 */
export function WorkView({ clients, bounds }: WorkViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useMediaQuery(MOBILE_WORK_QUERY);
  const reducedMotion = useReducedMotion();
  const state = useWorkState(clients, bounds);

  const [leaving, setLeaving] = useState(false);
  /** True while falling through the secret doorway. */
  const [falling, setFalling] = useState(false);
  /**
   * "stars": this mount arrived from the homepage Work link, so the project
   * stars fly into the grid and the cells crossfade in under the sky
   * director's control. A star entrance only occurs on soft navigation
   * (never hydration — a hard load has no pending flight), so resolving it
   * in the initializer cannot mismatch the server render.
   */
  const [entrance, setEntrance] = useState<"normal" | "stars">(() =>
    typeof window !== "undefined" && consumeWorkEntrance() ? "stars" : "normal",
  );
  // Never leave the interface hidden if the flight cannot complete.
  useEffect(() => {
    if (entrance !== "stars") return;
    const guard = window.setTimeout(() => setEntrance("normal"), 4200);
    return () => window.clearTimeout(guard);
  }, [entrance]);
  const [info, setInfo] = useState<InfoOverlayState | null>(null);
  /** Direction of the latest card step (drives the slide animation). */
  const [infoStep, setInfoStep] = useState<0 | 1 | -1>(0);
  const infoRef = useRef(info);
  useEffect(() => {
    infoRef.current = info;
  }, [info]);

  const openSlug = pathname.startsWith("/work/")
    ? decodeURIComponent(pathname.slice("/work/".length).replace(/\/$/, ""))
    : null;

  useEffect(() => {
    track({ name: "work_opened" });
    return () => track({ name: "work_closed" });
  }, []);

  // Shell navigation (back control, logo, menu) plays the reverse of the
  // entry transition: going home, the logos contract into points and retreat
  // to their sky positions; the star layer carries the retreat across the
  // route change.
  useEffect(() => {
    setShellNavigationInterceptor((href) => {
      if (href === "/" && !reducedMotion) {
        beginHomeFlight(measureStarTargets(), { domIsLive: true });
      }
      setLeaving(true);
      window.setTimeout(() => router.push(href), reducedMotion ? 0 : EXIT_DURATION * 1000);
      return true;
    });
    return () => setShellNavigationInterceptor(null);
  }, [router, reducedMotion]);

  // The mobile info overlay participates in history: opening pushes an
  // entry (same URL), so the device back gesture dismisses the card and
  // restores the untouched canvas.
  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const historyState = event.state as { awInfo?: string } | null;
      const id = historyState?.awInfo ?? null;
      if (id) {
        // Forward navigation back into an info entry — reopen the card.
        const client = clients.find((candidate) => candidate.id === id);
        if (client && infoRef.current?.client.id !== id) {
          const mask = document.querySelector(`[data-client-cell="${id}"] [data-logo-mask]`);
          const rect = mask?.getBoundingClientRect();
          setInfo({
            client,
            origin: rect
              ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
              : { x: window.innerWidth / 2, y: window.innerHeight / 2, width: 0, height: 0 },
          });
        }
        return;
      }
      if (infoRef.current) setInfo(null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [clients]);

  const openInfo = (client: WorkClient, rect: DOMRect) => {
    setInfoStep(0);
    setInfo({
      client,
      origin: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    });
    try {
      window.history.pushState({ awInfo: client.id }, "");
    } catch {
      // History can be unavailable in edge cases; the close button still works.
    }
    track({ name: "client_info_opened", clientId: client.id });
  };

  const closeInfo = () => {
    setInfo(null);
    const historyState = window.history.state as { awInfo?: string } | null;
    if (historyState?.awInfo) window.history.back();
  };

  /**
   * Swipe progression on the info card: steps through every filtered
   * project (wrap-around) in the current display order. The history entry
   * is replaced, not pushed — one back gesture always dismisses the card.
   */
  const stepInfo = (direction: 1 | -1) => {
    const current = infoRef.current;
    if (!current) return;
    const list = state.visibleClients;
    if (list.length < 2) return;
    const index = list.findIndex((candidate) => candidate.id === current.client.id);
    const neighbor = list[(index + direction + list.length) % list.length];
    if (!neighbor || neighbor.id === current.client.id) return;
    const mask = document.querySelector(`[data-client-cell="${neighbor.id}"] [data-logo-mask]`);
    const rect = mask?.getBoundingClientRect();
    setInfoStep(direction);
    setInfo({
      client: neighbor,
      origin: rect
        ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2, width: 0, height: 0 },
    });
    try {
      const historyState = (window.history.state ?? {}) as Record<string, unknown>;
      window.history.replaceState({ ...historyState, awInfo: neighbor.id }, "");
    } catch {
      // Non-fatal: the card still shows the neighbor.
    }
    track({ name: "client_info_opened", clientId: neighbor.id });
  };

  /**
   * A case-study CTA inside the card navigates away: dismiss the card and
   * strip the awInfo marker in place so Back from the sheet lands on the
   * canvas, not on a resurrected card.
   */
  const releaseInfoForNavigation = () => {
    setInfo(null);
    try {
      const historyState = window.history.state as { awInfo?: string } | null;
      if (historyState?.awInfo) {
        const rest = { ...historyState };
        delete rest.awInfo;
        window.history.replaceState(rest, "");
      }
    } catch {
      // Non-fatal.
    }
  };

  const dockEntrance = reducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2 } }
    : {
        initial: { opacity: 0, y: 18 },
        animate: { opacity: 1, y: 0 },
        // Under the star entrance the dock fades in as settling completes;
        // the entrance lock keeps it non-interactive until then.
        transition: {
          duration: entrance === "stars" ? 0.3 : DUR.slow,
          delay: entrance === "stars" ? 1.55 : 0.18,
          ease: EASE_OUT,
        },
      };

  // Once a logo activation begins (info overlay or case-study navigation),
  // the canvas freezes: no pan or pinch can disturb the departure state.
  const gesturesEnabled = info === null && openSlug === null;

  const skipToFilters = (event: React.MouseEvent) => {
    event.preventDefault();
    document.getElementById("work-filters")?.focus();
  };

  const enterDoor = () => {
    setFalling(true);
    track({ name: "secret_door_entered" });
  };

  const emptySelection = state.visibleClients.length === 0;

  return (
    <motion.div
      className={styles.root}
      initial={{ opacity: 0 }}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{
        duration: leaving ? EXIT_DURATION : 0.28,
        ease: leaving ? EASE_EXIT : EASE_OUT,
      }}
      data-leaving={leaving || undefined}
      // Scopes the mark-hiding rule and locks out all interaction (hover,
      // tooltips, filters, gestures) until the entrance has settled.
      data-star-entrance={entrance === "stars" || undefined}
    >
      <a className={styles.skipLink} href="#work-filters" onClick={skipToFilters}>
        Skip to filters
      </a>
      {isMobile === null ? null : isMobile ? (
        <>
          <MobileCanvas
            clients={state.visibleClients}
            openSlug={openSlug}
            infoClientId={info?.client.id ?? null}
            onInfoOpen={openInfo}
            gesturesEnabled={gesturesEnabled}
            starEntrance={entrance === "stars"}
            onEntranceOrder={state.onEntranceOrder}
            onEntranceSettled={() => setEntrance("normal")}
          />
          <motion.div className={styles.dockLayer} {...dockEntrance}>
            <FilterDock state={state} variant="mobile" />
          </motion.div>
          <MobileInfoCard
            state={info}
            direction={infoStep}
            canStep={state.visibleClients.length > 1}
            onStep={stepInfo}
            onClose={closeInfo}
            onReleaseForNavigation={releaseInfoForNavigation}
          />
        </>
      ) : (
        <>
          <DesktopGrid
            clients={state.visibleClients}
            openSlug={openSlug}
            starEntrance={entrance === "stars"}
            onEntranceOrder={state.onEntranceOrder}
            onEntranceSettled={() => setEntrance("normal")}
          />
          <motion.div className={styles.dockLayer} {...dockEntrance}>
            <FilterDock state={state} variant="desktop" />
          </motion.div>
        </>
      )}

      {/* The deliberate void: everything filtered away leaves a doorway. */}
      <AnimatePresence>
        {emptySelection && isMobile !== null ? <EmptyState onEnterDoor={enterDoor} /> : null}
      </AnimatePresence>
      {falling ? <TunnelTransition onComplete={() => router.push("/secret")} /> : null}
    </motion.div>
  );
}
