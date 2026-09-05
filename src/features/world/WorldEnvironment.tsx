"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { SKY_DISABLED } from "@/features/sky/sky-director";
import { updateWorldFrame, worldState } from "./world-state";
import styles from "./WorldEnvironment.module.css";

/** Route changes update intent, never the renderer's lifetime. */
export function WorldEnvironment() {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stats = useRef<HTMLOutputElement>(null);
  const pathname = usePathname();
  const route = useRef(pathname);
  useEffect(() => {
    route.current = pathname;
  }, [pathname]);
  useEffect(() => {
    if (SKY_DISABLED || !canvas.current) return;
    let disposed = false;
    let teardown: (() => void) | undefined;
    const el = canvas.current;
    let fallbackFrame = 0;
    const fallback = () => {
      worldState.ready = false;
      if (disposed || fallbackFrame) return;
      const tick = (now: number) => {
        updateWorldFrame(now);
        fallbackFrame = requestAnimationFrame(tick);
      };
      fallbackFrame = requestAnimationFrame(tick);
    };
    import("./world-renderer")
      .then(async ({ createWorld }) => {
        if (disposed) return;
        try {
          teardown = await createWorld(
            el,
            () => route.current,
            stats.current,
            () => {
              fallback();
              root.current?.removeAttribute("data-ready");
              document.documentElement.removeAttribute("data-world-ready");
            },
          );
          if (disposed) {
            teardown();
            return;
          }
          worldState.ready = true;
          root.current?.setAttribute("data-ready", "");
          document.documentElement.setAttribute("data-world-ready", "");
        } catch {
          fallback();
          // The static landscape remains visible; content never depends on WebGL.
          root.current?.removeAttribute("data-ready");
        }
      })
      .catch(fallback);
    return () => {
      disposed = true;
      worldState.ready = false;
      cancelAnimationFrame(fallbackFrame);
      teardown?.();
      document.documentElement.removeAttribute("data-world-ready");
    };
  }, []);
  return (
    <>
      <div ref={root} className={styles.world} aria-hidden>
        <div className={styles.fallback} />
        <canvas ref={canvas} />
      </div>
      <output ref={stats} className={styles.stats} hidden aria-hidden />
    </>
  );
}
