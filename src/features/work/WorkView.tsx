"use client";

import { motion, useReducedMotion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { track } from "@/lib/analytics";
import type { WorkClient, YearRange } from "@/lib/content/model";
import { DUR, EASE_EXIT, EASE_OUT } from "@/lib/motion";
import { setShellNavigationInterceptor } from "@/lib/shell-navigation";
import { MOBILE_WORK_QUERY, useMediaQuery } from "@/lib/use-media-query";

import { DesktopGrid } from "./DesktopGrid";
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
  const [info, setInfo] = useState<InfoOverlayState | null>(null);
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
  // entry transition: the logo field disperses before the route changes.
  useEffect(() => {
    setShellNavigationInterceptor((href) => {
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

  const dockEntrance = reducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2 } }
    : {
        initial: { opacity: 0, y: 18 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: DUR.slow, delay: 0.18, ease: EASE_OUT },
      };

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
    >
      {isMobile === null ? null : isMobile ? (
        <>
          <MobileCanvas
            clients={state.visibleClients}
            openSlug={openSlug}
            infoClientId={info?.client.id ?? null}
            onInfoOpen={openInfo}
          />
          <motion.div className={styles.dockLayer} {...dockEntrance}>
            <FilterDock state={state} variant="mobile" />
          </motion.div>
          <MobileInfoCard state={info} onClose={closeInfo} />
        </>
      ) : (
        <>
          <DesktopGrid clients={state.visibleClients} openSlug={openSlug} />
          <motion.div className={styles.dockLayer} {...dockEntrance}>
            <FilterDock state={state} variant="desktop" />
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
