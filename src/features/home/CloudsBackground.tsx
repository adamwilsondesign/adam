"use client";

import { useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { registerCloudSurgeHandler } from "@/features/sky/sky-director";

import styles from "./CloudsBackground.module.css";

/**
 * The permanent night sky: deep green-black atmosphere, ember horizon.
 * This is the site's only palette — night is the art direction, not a theme.
 */
const NIGHT = {
  backgroundColor: 0x000000,
  skyColor: 0x0a1118,
  cloudColor: 0x1f2833,
  cloudShadowColor: 0x000000,
  sunColor: 0x8a4d2a,
  sunGlareColor: 0x6e3a26,
  sunlightColor: 0x7c4a2e,
};

/** The clouds' resting drift and how hard they rush during a star flight. */
const CLOUD_SPEED_REST = 0.7;
const CLOUD_SPEED_SURGE = 30;

/** Hermetic test builds exclude the WebGL sky — it is pure scenery, and its
 * software-rendered init skews animation timing under test. */
const SKY_DISABLED = process.env.NEXT_PUBLIC_DISABLE_SKY === "1";

/**
 * The site's interactive sky: Vanta's WebGL cloud field, mounted once in the
 * site layout as the global backdrop. It persists across route changes so
 * navigation reads as one continuous page. Vanta tracks the pointer on
 * `window`, so content stacked above stays interactive while the sky drifts
 * with the cursor. Away from the homepage the whole layer dims slightly
 * (~15–20%) to protect logo contrast, keeping the clouds clearly present.
 *
 * When WebGL is unavailable (or reduced motion is on), a static gradient
 * atmosphere stands in — never an empty background, and the failed context
 * is never retried.
 */
export function CloudsBackground() {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const pathname = usePathname();
  const [fallback, setFallback] = useState(false);

  const dimmed = pathname !== "/";

  useEffect(() => {
    if (SKY_DISABLED) return;
    if (reducedMotion || !ref.current) {
      setFallback(true);
      return;
    }
    const el = ref.current;

    let disposed = false;
    let effect: import("vanta/dist/vanta.clouds.min").VantaCloudsEffect | null = null;
    let cleanupTouch: (() => void) | null = null;
    let surgeFrame = 0;

    (async () => {
      const [THREE, { default: CLOUDS }] = await Promise.all([
        import("three"),
        import("vanta/dist/vanta.clouds.min"),
      ]);
      if (disposed) return;
      try {
        effect = CLOUDS({
          el,
          THREE,
          mouseControls: true,
          // Vanta's own touch tracking moves the sky against the finger;
          // we feed it mirrored coordinates instead (below).
          touchControls: false,
          gyroControls: false,
          minHeight: 200,
          minWidth: 200,
          speed: CLOUD_SPEED_REST,
          ...NIGHT,
        });
        if (!effect) throw new Error("no effect");
      } catch {
        // No WebGL available — the static night gradient stands in. Never
        // retry a failed context.
        setFallback(true);
        return;
      }

      const onTouchMove = (event: TouchEvent) => {
        const touch = event.touches[0];
        if (!touch || !effect) return;
        effect.onMouseMove(window.innerWidth - touch.clientX, window.innerHeight - touch.clientY);
      };
      window.addEventListener("touchmove", onTouchMove, { passive: true });
      cleanupTouch = () => window.removeEventListener("touchmove", onTouchMove);

      // While a star flight runs, the clouds rush: their evolution speed
      // ramps up hard, holds through the run and settles back to the drift.
      // Vanta accumulates shader time incrementally (t += speed · dt), so
      // speed changes are perfectly smooth — pure acceleration, no jump.
      registerCloudSurgeHandler((durationMs, intensity) => {
        cancelAnimationFrame(surgeFrame);
        const startedAt = performance.now();
        const peak = CLOUD_SPEED_REST + (CLOUD_SPEED_SURGE - CLOUD_SPEED_REST) * intensity;
        const tick = (now: number) => {
          if (disposed || !effect) return;
          const t = Math.min(1, (now - startedAt) / durationMs);
          // Fast ramp in (~18%), cruise, gentle ease-out over the last 35%.
          const up = Math.min(1, t / 0.18);
          const down = t > 0.65 ? (t - 0.65) / 0.35 : 0;
          const envelope = (1 - Math.pow(1 - up, 3)) * (1 - down * down * (3 - 2 * down));
          effect.setOptions({ speed: CLOUD_SPEED_REST + (peak - CLOUD_SPEED_REST) * envelope });
          if (t < 1) surgeFrame = requestAnimationFrame(tick);
          else effect.setOptions({ speed: CLOUD_SPEED_REST });
        };
        surgeFrame = requestAnimationFrame(tick);
      });
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(surgeFrame);
      registerCloudSurgeHandler(null);
      cleanupTouch?.();
      effect?.destroy();
      effect = null;
    };
  }, [reducedMotion]);

  if (SKY_DISABLED) return <div className={styles.clouds} aria-hidden />;

  return (
    <div className={styles.clouds} data-dimmed={dimmed || undefined} aria-hidden>
      {fallback ? <div className={styles.fallback} /> : <div ref={ref} className={styles.scene} />}
      <div className={styles.veil} data-active={dimmed || undefined} />
    </div>
  );
}
