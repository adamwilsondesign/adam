"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

import styles from "./CloudsBackground.module.css";

type CloudPalette = {
  backgroundColor: number;
  skyColor: number;
  cloudColor: number;
  cloudShadowColor: number;
  sunColor: number;
  sunGlareColor: number;
  sunlightColor: number;
};

/** Daylight sky tuned toward the site's mist-white canvas. */
const LIGHT: CloudPalette = {
  backgroundColor: 0xffffff,
  skyColor: 0x84a8c0,
  cloudColor: 0xc9d4e2,
  cloudShadowColor: 0x2c4a63,
  sunColor: 0xdd9a3f,
  sunGlareColor: 0xcf7a45,
  sunlightColor: 0xd98f42,
};

/** Dusk variant for the dark theme: deep sky, ember horizon. */
const DARK: CloudPalette = {
  backgroundColor: 0x000000,
  skyColor: 0x0a1118,
  cloudColor: 0x1f2833,
  cloudShadowColor: 0x000000,
  sunColor: 0x8a4d2a,
  sunGlareColor: 0x6e3a26,
  sunlightColor: 0x7c4a2e,
};

function isDarkTheme(): boolean {
  const explicit = document.documentElement.dataset.theme;
  if (explicit) return explicit === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * The homepage's interactive sky: Vanta's WebGL cloud field, mounted as a
 * background layer behind the index. Vanta tracks the pointer on `window`,
 * so content stacked above stays interactive while the sky drifts with the
 * cursor. Skipped entirely under prefers-reduced-motion, and torn down on
 * navigation so nothing renders behind other routes.
 */
export function CloudsBackground() {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion || !ref.current) return;
    const el = ref.current;

    let disposed = false;
    let effect: import("vanta/dist/vanta.clouds.min").VantaCloudsEffect | null = null;
    let observer: MutationObserver | null = null;
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => effect?.setOptions(isDarkTheme() ? DARK : LIGHT);

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
          touchControls: true,
          gyroControls: false,
          minHeight: 200,
          minWidth: 200,
          speed: 0.7,
          ...(isDarkTheme() ? DARK : LIGHT),
        });
      } catch {
        // No WebGL available — the plain themed background stands in.
        return;
      }

      observer = new MutationObserver(applyTheme);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });
      scheme.addEventListener("change", applyTheme);
    })();

    return () => {
      disposed = true;
      observer?.disconnect();
      scheme.removeEventListener("change", applyTheme);
      effect?.destroy();
      effect = null;
    };
  }, [reducedMotion]);

  return <div ref={ref} className={styles.clouds} aria-hidden />;
}
