"use client";

import { useEffect, useRef } from "react";

import { SKY_DISABLED, shiftClouds } from "@/features/sky/sky-director";
import { seededRandom } from "@/features/sky/star-field";
import { ATMOS, hexToRgb } from "@/lib/atmosphere";
import { cinematicEase } from "@/lib/motion";

import { MOUNTAIN_LAYERS, MOUNTAIN_LAYERS_MOBILE, type MountainLayer } from "./mountains";
import { renderTerrainLayer } from "./terrain";
import styles from "./AboutScene.module.css";

export type AboutScenePhase = "arriving" | "settled" | "leaving";

/**
 * The About environment's shared clock. The view owns the state machine
 * (content reveal, interaction unlock, exit navigation) and the scene renders
 * the same timeline, so copy and environment always agree.
 */
export const ABOUT_TIMINGS = {
  desktop: { arrival: 2200, reveal: 1400, unlock: 1750 },
  mobile: { arrival: 1600, reveal: 1000, unlock: 1280 },
  /** The reverse ascent (a true inverse of the descent); navigation
   *  completes just after it. */
  reverse: 1500,
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
type BakedLayer = {
  layer: MountainLayer;
  canvas: HTMLCanvasElement;
  drawWidth: number;
  drawHeight: number;
  baseColor: string;
};

/** How far the camera descends, in viewport heights, over the arrival. */
const CAM_TRAVEL = 1.5;

/* Oxidized-nocturne scene colors (see src/lib/atmosphere.ts). */
const SKY_DEEP = hexToRgb(ATMOS.deepBackground).join(", ");
const SKY_HORIZON = hexToRgb(ATMOS.sky).join(", ");
const SILVER = hexToRgb(ATMOS.lunarSilver).join(", ");
const MIST = hexToRgb(ATMOS.mutedSilver).join(", ");
const SCRIM = hexToRgb(ATMOS.deepBackground).join(", ");
/** Distant stars shift less than the cloud deck as the camera drops. */
const STAR_PARALLAX = 0.35;
/** Baked relief resolution relative to CSS pixels (upscaled when drawn). */
const BAKE_SCALE = 0.65;
/** Side margin baked into each layer so parallax and zoom never show edges. */
const BAKE_MARGIN = 1.3;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

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
  return 0.42 * Math.exp(-(d * d) / (2 * 0.1 * 0.1));
}

/**
 * The About page's fixed environment canvas.
 *
 * Arrival is a strictly vertical camera drop: the homepage's world — stars
 * above, the cloud deck low in the frame — rises past the viewport as the
 * camera descends through the deck, and the moonlit range appears from below.
 * The deck settles as the ceiling in the top quarter. Scroll then travels on
 * the Z axis: the range enlarges toward the camera (near layers fastest)
 * while the ceiling exits upward off the screen. Leaving reverses the drop.
 *
 * Mountains are real shaded relief (terrain.ts): heightfields lit by an
 * off-canvas moon to the upper right, baked once per resize and composited
 * with the shared camera. Nothing is stroked and no layer moves on its own.
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
    let baked: BakedLayer[] = [];

    /* Deterministic scene furniture. */
    const random = seededRandom(0x51ab);
    const cloudLayers: CloudLayer[] = [0.25, 0.55, 0.9].map((depth, index) => ({
      depth,
      tint: index / 2,
      puffs: Array.from({ length: 10 }, () => ({
        x: random() * 1.3 - 0.15,
        y: random() * 0.26 - 0.06,
        rx: 0.1 + random() * 0.13,
        squash: 0.3 + random() * 0.15,
        alpha: 0.34 + random() * 0.3,
        drift: 0.6 + random() * 0.8,
      })),
    }));
    /* The homepage sky: bright stars that sweep up and out during the drop. */
    const skyStars: SceneStar[] = Array.from({ length: 110 }, () => ({
      x: random(),
      y: random() * 1.35 - 0.3,
      r: 0.5 + random() * 1.1,
      a: 0.3 + random() * 0.55,
      tw: 0.6 + random() * 1.6,
      ph: random() * Math.PI * 2,
    }));
    /* Faint below-deck stars: rise into the settled middle band, and return
       over the editorial dark once the scroll veil covers the site sky. */
    const bandStars: SceneStar[] = Array.from({ length: 70 }, () => ({
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
    let cloudsShifted = false;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const mobile = width < 768;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      /* Bake the moonlit relief once per size; drawn scaled every frame. */
      const layers = mobile ? MOUNTAIN_LAYERS_MOBILE : MOUNTAIN_LAYERS;
      const drawWidth = Math.ceil(width * BAKE_MARGIN);
      baked = layers.map((layer) => {
        const drawHeight = Math.ceil(layer.band * height) + 2;
        const bw = Math.max(2, Math.round(drawWidth * BAKE_SCALE));
        const bh = Math.max(2, Math.round(drawHeight * BAKE_SCALE));
        const offscreen = document.createElement("canvas");
        const baseColor = renderTerrainLayer(offscreen, layer, bw, bh);
        return { layer, canvas: offscreen, drawWidth, drawHeight, baseColor };
      });
      draw(performance.now());
    };

    const draw = (now: number) => {
      const scroll = clamp01(scrollProgress.current ?? 0);

      /* One pose for everything: 0 = homepage sky, 1 = settled valley. */
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
        pose = cinematicEase(clamp01((now - phaseStart) / arrivalMs));
        mist = mistAlpha(pose);
      } else if (currentPhase === "leaving") {
        phaseStart ??= now;
        pose = leaveFrom * (1 - cinematicEase(clamp01((now - phaseStart) / ABOUT_TIMINGS.reverse)));
        mist = mistAlpha(pose) * 0.8;
      } else {
        pose = 1;
      }

      pointer.x += (pointer.tx - pointer.x) * 0.06;
      pointer.y += (pointer.ty - pointer.y) * 0.06;

      ctx.clearRect(0, 0, width, height);

      /* The live cloud layer is the deck being flown through: while the
         camera moves it grows and rises past the viewport, fading out as the
         camera passes below it — then returns, dimmed and untransformed,
         behind the settled scene. Purely pose-driven, so the reverse plays
         it backwards for free. */
      if (currentPhase === "arriving" || currentPhase === "leaving") {
        if (pose < 0.55) {
          const t = pose / 0.55;
          const rise = t * t * (3 - 2 * t);
          shiftClouds({
            y: -height * 0.6 * rise,
            scale: 1 + 1.05 * rise,
            opacity: 1 - smoothstep(0.34, 0.55, pose),
          });
        } else {
          shiftClouds({ y: 0, scale: 1, opacity: smoothstep(0.8, 0.98, pose) });
        }
        cloudsShifted = true;
      } else if (cloudsShifted) {
        shiftClouds(null);
        cloudsShifted = false;
      }

      /* During the drop the scene owns the whole sky (an opaque backdrop),
         so every element shares one vertical camera. It layers in as the
         camera starts moving — the live clouds carry the first beat — and
         dissolves as the camera settles, handing the middle band back to
         the live site sky. */
      const backdrop = smoothstep(0.06, 0.38, pose) * (1 - smoothstep(0.8, 0.995, pose));
      const camY = pose * CAM_TRAVEL * height;

      if (backdrop > 0.003) {
        const sky = ctx.createLinearGradient(0, 0, 0, height);
        sky.addColorStop(0, `rgba(${SKY_DEEP}, ${backdrop})`);
        sky.addColorStop(1, `rgba(${SKY_HORIZON}, ${backdrop})`);
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, width, height);
      }

      /* The moon itself stays off-canvas upper right; its glow brightens the
         sky there, drifting up with the world as the camera descends. */
      const glowAlpha = 0.06 + 0.1 * backdrop;
      const glowY = height * 0.14 - camY * STAR_PARALLAX;
      const glow = ctx.createRadialGradient(
        width * 0.92,
        glowY,
        0,
        width * 0.92,
        glowY,
        width * 0.5,
      );
      glow.addColorStop(0, `rgba(${SILVER}, ${glowAlpha})`);
      glow.addColorStop(1, `rgba(${SILVER}, 0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      if (backdrop > 0.003) {
        ctx.fillStyle = ATMOS.warmWhite;
        for (const star of skyStars) {
          const sy = star.y * height - camY * STAR_PARALLAX;
          if (sy < -4 || sy > height + 4) continue;
          const twinkle = reducedMotion
            ? 1
            : 0.82 + 0.18 * Math.sin((now / 1000) * star.tw + star.ph);
          ctx.globalAlpha = star.a * backdrop * twinkle;
          ctx.beginPath();
          ctx.arc(star.x * width, sy, star.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      /* Faint stars of the valley air: hidden below the frame at the start,
         they ride up into the band between ceiling and range, handing off to
         the site's own stars once the backdrop dissolves. */
      const bandStarAlpha = backdrop * smoothstep(0.55, 0.92, pose);
      if (bandStarAlpha > 0.003) {
        ctx.fillStyle = ATMOS.warmWhite;
        for (const star of bandStars) {
          const sy = star.y * height + (CAM_TRAVEL * height - camY);
          if (sy < -4 || sy > height + 4) continue;
          const twinkle = reducedMotion
            ? 1
            : 0.82 + 0.18 * Math.sin((now / 1000) * star.tw + star.ph);
          ctx.globalAlpha = star.a * bandStarAlpha * twinkle;
          ctx.beginPath();
          ctx.arc(star.x * width, sy, star.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      /* The cloud deck. At rest it is the ceiling across the top quarter;
         at pose 0 the same deck sits at the bottom of the frame (the
         homepage horizon), and the camera drops straight through it. On
         scroll it exits upward — the Z push leaves the clouds behind. */
      const recede = smoothstep(0.05, 0.75, scroll);
      const ceilingAlpha = (0.55 + 0.45 * pose) * (1 - recede * 0.7);
      const ceilingLift = -recede * 0.9 * height;
      if (ceilingAlpha > 0.01) {
        const bandBottom = ceilingLift + height * 0.34;
        if (bandBottom > 0) {
          const grad = ctx.createLinearGradient(0, ceilingLift, 0, bandBottom);
          grad.addColorStop(0, `rgba(7, 10, 13, ${0.92 * ceilingAlpha * (0.4 + 0.6 * pose)})`);
          grad.addColorStop(1, "rgba(7, 10, 13, 0)");
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, width, bandBottom);
        }
        for (const layer of cloudLayers) {
          /* Depth staggers the pass: near puffs sweep fastest, the middle
             slower, distant vapour barely moves — one camera, real parallax. */
          const sweep = (1 - pose) * (0.45 + 1.0 * layer.depth) * height;
          const parallaxX = pointer.x * (2 + 4 * layer.depth);
          const parallaxY = pointer.y * (1 + 2 * layer.depth);
          /* Warm graphite bodies, darker with distance. */
          const shade = 20 - Math.round(layer.tint * 8);
          for (const puff of layer.puffs) {
            const drift = reducedMotion
              ? 0
              : (now / 1000) * 0.004 * puff.drift * (0.4 + layer.depth);
            const nx = ((((puff.x + drift) % 1.4) + 1.4) % 1.4) - 0.2;
            const cx = nx * width + parallaxX;
            const cy = puff.y * height + sweep + ceilingLift + parallaxY;
            if (cy < -height * 0.3 || cy > height * 1.4) continue;
            const rx = puff.rx * width;
            /* During the drop the camera looks down on the deck's moonlit
               top, so the bank reads bright and unmistakable; passing below,
               it settles to its dark underside. The moon side stays hotter. */
            const above = clamp01(1 - pose);
            const boost = above * (24 + 28 * clamp01(nx));
            const lit = 1 + 0.5 * clamp01(nx) * 0.6;
            /* Warm graphite in shadow; the moonlit top boost is silver. */
            const r = Math.min(255, Math.round(shade * lit + boost * 0.95) + 5);
            const g = Math.min(255, Math.round((shade - 1) * lit + boost) + 5);
            const b = Math.min(255, Math.round((shade - 3) * lit + boost * 0.97) + 4);
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(1, puff.squash);
            const alpha = Math.min(1, puff.alpha * ceilingAlpha * (1 + 0.5 * above));
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
            gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);
            gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
            ctx.fillStyle = gradient;
            ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
            ctx.restore();
          }
        }
      }

      /* The range: moonlit relief revealed from below as the camera drops,
         then flown over on the Z axis by scroll — the range grows toward the
         camera and stays underfoot for the whole page; only the nearest
         layer eventually slides beneath the viewport. */
      const approach = 1 - (1 - scroll) * (1 - scroll);
      for (const item of baked) {
        const { layer } = item;
        /* The range emerges while the last cloud layer is still leaving:
           distant tips break the horizon just past mid-descent, the near
           wall seats last — no empty beat between clouds and mountains. */
        const rise = (1 - pose) * (0.25 + 0.35 * layer.depth) * height;
        const zoom = 1 + approach * (0.22 + 0.85 * Math.pow(layer.depth, 1.4));
        const drop = scroll * scroll * Math.pow(layer.depth, 4) * 0.4 * height;
        const parallaxX = pointer.x * (1.5 + 5.5 * layer.depth);
        const parallaxY = pointer.y * (1 + 2.5 * layer.depth);
        const offY = rise + drop + parallaxY;

        ctx.save();
        ctx.translate(width / 2 + parallaxX, height);
        ctx.scale(zoom, zoom);
        ctx.drawImage(
          item.canvas,
          -item.drawWidth / 2,
          -item.drawHeight + offY,
          item.drawWidth,
          item.drawHeight,
        );
        /* Ground plane below the shaded band (visible mid-travel). */
        ctx.fillStyle = item.baseColor;
        ctx.fillRect(-item.drawWidth / 2, offY - 1, item.drawWidth, height + 2);
        ctx.restore();
      }

      if (mist > 0.005) {
        /* Densest through the band the camera is crossing; the frame's top
           and bottom stay readable so it reads as cloud, not a wash. */
        const veil = ctx.createLinearGradient(0, 0, 0, height);
        veil.addColorStop(0, `rgba(${MIST}, ${mist * 0.3})`);
        veil.addColorStop(0.34, `rgba(${MIST}, ${mist})`);
        veil.addColorStop(0.62, `rgba(${MIST}, ${mist * 0.85})`);
        veil.addColorStop(1, `rgba(${MIST}, ${mist * 0.22})`);
        ctx.fillStyle = veil;
        ctx.fillRect(0, 0, width, height);
      }

      /* Deep scroll: a gentle scrim keeps long copy readable while the
         range stays underfoot — the flight over the mountains never ends. */
      const scrim = smoothstep(0.35, 0.9, scroll) * 0.42;
      if (scrim > 0.003) {
        ctx.fillStyle = `rgba(${SCRIM}, ${scrim})`;
        ctx.fillRect(0, 0, width, height);
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
      if (cloudsShifted) shiftClouds(null);
    };
  }, [arrivalMs, reducedMotion, scrollProgress]);

  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden data-about-scene />;
}
