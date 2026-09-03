"use client";

import { useEffect, useRef } from "react";

import { SKY_DISABLED } from "@/features/sky/sky-director";
import { seededRandom } from "@/features/sky/star-field";

import {
  MOUNTAIN_LAYERS,
  MOUNTAIN_LAYERS_MOBILE,
  ridgeHeights,
  type MountainLayer,
} from "./mountains";
import styles from "./AboutScene.module.css";

export type AboutScenePhase = "arriving" | "settled" | "leaving";

/**
 * The About environment's shared clock. The view owns the state machine
 * (content reveal, interaction unlock, exit navigation) and the scene renders
 * the same timeline, so copy and environment always agree.
 */
export const ABOUT_TIMINGS = {
  desktop: { arrival: 1700, reveal: 1050, unlock: 1300 },
  mobile: { arrival: 1200, reveal: 760, unlock: 950 },
  /** The reverse ascent; navigation completes just after it. */
  reverse: 780,
  /** Content fades out before the environment starts moving. */
  contentFade: 200,
  /** Reduced motion swaps the descent for a plain crossfade. */
  reducedFade: 350,
} as const;

type AboutSceneProps = {
  phase: AboutScenePhase;
  /** Descent length for this viewport (ABOUT_TIMINGS.desktop/mobile). */
  arrivalMs: number;
  /** Normalized scroll progress, 0 at the hero → 1 fully editorial. */
  scrollProgress: React.RefObject<number>;
  reducedMotion: boolean;
};

type CloudPuff = { x: number; y: number; rx: number; squash: number; alpha: number; drift: number };
type CloudLayer = { depth: number; tint: number; puffs: CloudPuff[] };
type SceneStar = { x: number; y: number; r: number; a: number; tw: number; ph: number };

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Hermite step between edges — the scene's scroll responses all use it. */
function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * The brief mist pass while the camera crosses the cloud deck: a soft veil
 * that peaks mid-descent and clears in roughly a quarter second. The scene
 * stays legible through it — never a whiteout.
 */
function mistAlpha(pose: number): number {
  const d = pose - 0.52;
  return 0.34 * Math.exp(-(d * d) / (2 * 0.085 * 0.085));
}

/**
 * The About page's fixed environment canvas: the descent through the cloud
 * deck, the settled valley (cloud ceiling above, nighttime range below), the
 * scroll-driven push into the valley, and the reverse ascent when leaving.
 *
 * Everything moves from one shared pose — arrival progress, scroll progress
 * and the pointer offset project every layer by its depth; no layer animates
 * independently. The middle band stays transparent so the site-wide clouds
 * and stars read through between ceiling and mountains.
 */
export function AboutScene({ phase, arrivalMs, scrollProgress, reducedMotion }: AboutSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let ridges: { layer: MountainLayer; heights: number[] }[] = [];

    /* Deterministic scene furniture: ceiling puffs and the editorial stars. */
    const random = seededRandom(0x51ab);
    const cloudLayers: CloudLayer[] = [0.25, 0.55, 0.9].map((depth, index) => ({
      depth,
      tint: index / 2,
      puffs: Array.from({ length: 9 }, () => ({
        x: random() * 1.3 - 0.15,
        y: random() * 0.2 - 0.04,
        rx: 0.1 + random() * 0.13,
        squash: 0.3 + random() * 0.15,
        alpha: 0.34 + random() * 0.3,
        drift: 0.6 + random() * 0.8,
      })),
    }));
    const stars: SceneStar[] = Array.from({ length: 70 }, () => ({
      x: random(),
      y: 0.04 + random() * 0.55,
      r: 0.5 + random() * 0.9,
      a: 0.22 + random() * 0.35,
      tw: 0.6 + random() * 1.6,
      ph: random() * Math.PI * 2,
    }));

    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

    let lastPhase: AboutScenePhase = phaseRef.current;
    let phaseStart: number | null = null;
    let leaveFrom = 1;
    let pose = lastPhase === "arriving" ? 0 : 1;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const mobile = width < 768;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const layers = mobile ? MOUNTAIN_LAYERS_MOBILE : MOUNTAIN_LAYERS;
      ridges = layers.map((layer) => ({ layer, heights: ridgeHeights(layer, mobile ? 96 : 168) }));
      draw(performance.now());
    };

    const draw = (now: number) => {
      const scroll = clamp01(scrollProgress.current ?? 0);

      /* One pose for everything: 0 = high above the deck, 1 = settled. */
      const currentPhase = phaseRef.current;
      if (currentPhase !== lastPhase) {
        if (currentPhase === "leaving") leaveFrom = pose;
        phaseStart = null;
        lastPhase = currentPhase;
      }
      let mist = 0;
      if (reducedMotion || SKY_DISABLED) {
        pose = currentPhase === "leaving" ? leaveFrom : 1;
      } else if (currentPhase === "arriving") {
        phaseStart ??= now;
        pose = easeInOutCubic(clamp01((now - phaseStart) / arrivalMs));
        mist = mistAlpha(pose);
      } else if (currentPhase === "leaving") {
        phaseStart ??= now;
        pose =
          leaveFrom * (1 - easeInOutCubic(clamp01((now - phaseStart) / ABOUT_TIMINGS.reverse)));
        mist = mistAlpha(pose) * 0.8;
      } else {
        pose = 1;
      }

      pointer.x += (pointer.tx - pointer.x) * 0.06;
      pointer.y += (pointer.ty - pointer.y) * 0.06;

      ctx.clearRect(0, 0, width, height);

      /* Cloud ceiling: settles into the top quarter, recedes upward on
         scroll. During arrival the deck starts across the middle of the view
         and sweeps up past the camera. */
      const recede = smoothstep(0.05, 0.75, scroll);
      const ceilingAlpha = (0.55 + 0.45 * pose) * (1 - recede * 0.9);
      const ceilingLift = -recede * 0.4 * height;
      if (ceilingAlpha > 0.01) {
        const bandBottom = ceilingLift + height * 0.34;
        if (bandBottom > 0) {
          const grad = ctx.createLinearGradient(0, ceilingLift, 0, bandBottom);
          grad.addColorStop(0, `rgba(7, 10, 13, ${0.92 * ceilingAlpha})`);
          grad.addColorStop(1, "rgba(7, 10, 13, 0)");
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, width, bandBottom);
        }
        for (const layer of cloudLayers) {
          const sweep = (1 - pose) * (0.55 + layer.depth * 0.85) * height;
          const parallaxX = pointer.x * (2 + 4 * layer.depth);
          const parallaxY = pointer.y * (1 + 2 * layer.depth);
          const shade = 16 - Math.round(layer.tint * 10);
          for (const puff of layer.puffs) {
            const drift = reducedMotion
              ? 0
              : (now / 1000) * 0.004 * puff.drift * (0.4 + layer.depth);
            const cx = (((((puff.x + drift) % 1.4) + 1.4) % 1.4) - 0.2) * width + parallaxX;
            const cy = puff.y * height + sweep + ceilingLift + parallaxY;
            const rx = puff.rx * width;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(1, puff.squash);
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
            g.addColorStop(
              0,
              `rgba(${shade}, ${shade + 5}, ${shade + 9}, ${puff.alpha * ceilingAlpha})`,
            );
            g.addColorStop(1, `rgba(${shade}, ${shade + 5}, ${shade + 9}, 0)`);
            ctx.fillStyle = g;
            ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
            ctx.restore();
          }
        }
      }

      /* The range: rises from below during arrival (near layers travel
         furthest), scales toward the camera with scroll (near layers enlarge
         and separate faster, opening the valley). */
      for (const { layer, heights } of ridges) {
        const bandPx = layer.band * height;
        const rise = (1 - pose) * (0.35 + 0.5 * layer.depth) * height;
        const zoom = 1 + scroll * (0.22 + 1.5 * Math.pow(layer.depth, 1.5));
        const drop = scroll * Math.pow(layer.depth, 1.4) * 0.6 * height;
        const parallaxX = pointer.x * (1.5 + 5.5 * layer.depth);
        const parallaxY = pointer.y * (1 + 2.5 * layer.depth);
        const offY = rise + drop + parallaxY;

        ctx.save();
        ctx.translate(width / 2 + parallaxX, height);
        ctx.scale(zoom, zoom);
        ctx.translate(-width / 2, -height);

        const n = heights.length;
        const ridgeY = (i: number) => height - bandPx * heights[i]! + offY;
        ctx.beginPath();
        ctx.moveTo(0, ridgeY(0));
        for (let i = 1; i < n; i++) ctx.lineTo((i / (n - 1)) * width, ridgeY(i));
        ctx.lineTo(width, height * 2);
        ctx.lineTo(0, height * 2);
        ctx.closePath();
        const fill = ctx.createLinearGradient(0, height - bandPx + offY, 0, height + offY);
        fill.addColorStop(0, layer.colorTop);
        fill.addColorStop(1, layer.colorBottom);
        ctx.fillStyle = fill;
        ctx.fill();

        /* Cold moonlit separation along the ridge, plus faint striations for
           texture inside the silhouette. */
        const rim = layer.rimAlpha * (0.35 + 0.65 * pose) * (1 - scroll * 0.6);
        if (rim > 0.01) {
          ctx.beginPath();
          ctx.moveTo(0, ridgeY(0));
          for (let i = 1; i < n; i++) ctx.lineTo((i / (n - 1)) * width, ridgeY(i));
          ctx.strokeStyle = `rgba(184, 205, 224, ${rim})`;
          ctx.lineWidth = 1 / zoom;
          ctx.stroke();
        }
        ctx.strokeStyle = "rgba(210, 226, 240, 0.03)";
        ctx.lineWidth = 0.8 / zoom;
        for (let k = 1; k <= 3; k++) {
          const shift = bandPx * 0.16 * k;
          ctx.beginPath();
          ctx.moveTo(0, ridgeY(0) + shift);
          for (let i = 1; i < n; i++) ctx.lineTo((i / (n - 1)) * width, ridgeY(i) + shift);
          ctx.stroke();
        }
        ctx.restore();
      }

      if (mist > 0.005) {
        /* Densest through the middle band the camera is crossing; the top
           and bottom stay readable so it reads as cloud, not a wash. */
        const veil = ctx.createLinearGradient(0, 0, 0, height);
        veil.addColorStop(0, `rgba(173, 186, 199, ${mist * 0.3})`);
        veil.addColorStop(0.34, `rgba(173, 186, 199, ${mist})`);
        veil.addColorStop(0.62, `rgba(173, 186, 199, ${mist * 0.85})`);
        veil.addColorStop(1, `rgba(173, 186, 199, ${mist * 0.22})`);
        ctx.fillStyle = veil;
        ctx.fillRect(0, 0, width, height);
      }

      /* Deep scroll: the environment resolves into the editorial dark ground
         with its own faint stars (the site sky is covered by the veil). */
      const editorial = smoothstep(0.5, 0.96, scroll);
      if (editorial > 0.003) {
        ctx.fillStyle = `rgba(2, 3, 5, ${editorial})`;
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = "#dfe6ee";
        for (const star of stars) {
          const twinkle = reducedMotion
            ? 1
            : 0.82 + 0.18 * Math.sin((now / 1000) * star.tw + star.ph);
          ctx.globalAlpha = star.a * editorial * twinkle;
          ctx.beginPath();
          ctx.arc(star.x * width, star.y * height, star.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      pointer.tx = (event.clientX / Math.max(1, width)) * 2 - 1;
      pointer.ty = (event.clientY / Math.max(1, height)) * 2 - 1;
    };

    resize();
    window.addEventListener("resize", resize);

    /* Hermetic builds render the settled environment once and stand down. */
    if (SKY_DISABLED) {
      return () => window.removeEventListener("resize", resize);
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    let raf = 0;
    const loop = (now: number) => {
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", resize);
    };
  }, [arrivalMs, reducedMotion, scrollProgress]);

  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden data-about-scene />;
}
