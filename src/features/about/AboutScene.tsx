"use client";

import { useEffect, useRef } from "react";

import { SKY_DISABLED, setAboutPose, shiftClouds } from "@/features/sky/sky-director";
import { travelEase } from "@/features/world/world-state";
import { dampingFactor } from "@/lib/motion";
import { seededRandom } from "@/features/sky/star-field";

import { prepareTerrain, type PreparedTerrain } from "./terrain-cache";
import { createValleyMist } from "./valley-mist";
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

/** How far the camera descends, in viewport heights, over the arrival. */
const CAM_TRAVEL = 1.5;
/** Distant stars shift less than the cloud deck as the camera drops. */
const STAR_PARALLAX = 0.35;

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
    let terrain: PreparedTerrain | null = null;
    let terrainRequest: AbortController | null = null;
    let terrainReadyAt = 0;
    let disposed = false;

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
    let lastDrawAt = performance.now();
    let mistSeconds = 0;
    const valleyMist = createValleyMist();
    let visibleScroll = clamp01(scrollProgress.current ?? 0);
    let leaveScroll = visibleScroll;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Keep drawing the previous relief while a worker prepares this size.
      // Home prewarming normally makes the initial request an immediate cache hit.
      terrainRequest?.abort();
      const request = new AbortController();
      terrainRequest = request;
      void prepareTerrain(width, height, request.signal).then(
        (prepared) => {
          if (disposed || request.signal.aborted) {
            prepared.release();
            return;
          }
          const previous = terrain;
          terrain = prepared;
          if (!previous) terrainReadyAt = performance.now();
          previous?.release();
          // Hermetic and reduced-motion scenes must also receive the ready art.
          draw(performance.now());
        },
        () => undefined,
      );
      draw(performance.now());
    };

    const draw = (now: number) => {
      if (disposed || (!SKY_DISABLED && document.hidden)) return;
      const deltaMs = Math.min(50, Math.max(0, now - lastDrawAt));
      lastDrawAt = now;
      if (!reducedMotion) mistSeconds += deltaMs / 1000;

      /* One pose for everything: 0 = homepage sky, 1 = settled valley. */
      const currentPhase = phaseRef.current;
      if (currentPhase !== lastPhase) {
        if (currentPhase === "leaving") {
          leaveFrom = pose;
          leaveScroll = visibleScroll;
        }
        phaseStart = null;
        lastPhase = currentPhase;
      }
      let mist = 0;
      if (reducedMotion || SKY_DISABLED) {
        pose = currentPhase === "leaving" ? leaveFrom : 1;
      } else if (currentPhase === "arriving") {
        phaseStart ??= now;
        pose = travelEase(clamp01((now - phaseStart) / arrivalMs));
        mist = mistAlpha(pose);
      } else if (currentPhase === "leaving") {
        phaseStart ??= now;
        pose = leaveFrom * (1 - travelEase(clamp01((now - phaseStart) / ABOUT_TIMINGS.reverse)));
        mist = mistAlpha(pose) * 0.8;
      } else {
        pose = 1;
      }

      setAboutPose(pose);
      // Keep the terrain at its visible scroll pose when departure begins;
      // return that forward travel continuously as the camera ascends.
      if (currentPhase === "leaving") {
        visibleScroll = leaveScroll * (leaveFrom > 0 ? pose / leaveFrom : 0);
      } else {
        const target = clamp01(scrollProgress.current ?? 0);
        visibleScroll = reducedMotion
          ? target
          : visibleScroll + (target - visibleScroll) * dampingFactor(deltaMs, 18);
      }
      const scroll = visibleScroll;
      const follow = dampingFactor(deltaMs, 3.7);
      pointer.x += (pointer.tx - pointer.x) * follow;
      pointer.y += (pointer.ty - pointer.y) * follow;

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
        sky.addColorStop(0, `rgba(4, 6, 10, ${backdrop})`);
        sky.addColorStop(1, `rgba(10, 15, 20, ${backdrop})`);
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
      glow.addColorStop(0, `rgba(186, 205, 228, ${glowAlpha})`);
      glow.addColorStop(1, "rgba(186, 205, 228, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      if (backdrop > 0.003) {
        ctx.fillStyle = "#e6ecf4";
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
        ctx.fillStyle = "#dfe6ee";
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
          /* One coherent deck: minimal depth spread, purely vertical. */
          const sweep = (1 - pose) * (0.95 + 0.25 * layer.depth) * height;
          const parallaxX = pointer.x * (2 + 4 * layer.depth);
          const parallaxY = pointer.y * (1 + 2 * layer.depth);
          const shade = 16 - Math.round(layer.tint * 10);
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
            const above = 1 - pose;
            const boost = above * (26 + 30 * clamp01(nx));
            const lit = 1 + 0.5 * clamp01(nx) * 0.6;
            const r = Math.min(255, Math.round(shade * lit + boost) + 6);
            const g = Math.min(255, Math.round((shade + 5) * lit + boost * 1.05) + 6);
            const b = Math.min(255, Math.round((shade + 9) * lit + boost * 1.15) + 7);
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
      const terrainAlpha =
        reducedMotion || SKY_DISABLED ? 1 : smoothstep(0, 320, now - terrainReadyAt);
      for (const item of terrain?.layers ?? []) {
        const { layer } = item;
        const drawWidth = item.drawWidth * (width / terrain!.width);
        const drawHeight = item.drawHeight * (height / terrain!.height);
        const rise = (1 - pose) * (0.22 + 0.38 * layer.depth) * height;
        const zoom = 1 + approach * (0.22 + 0.85 * Math.pow(layer.depth, 1.4));
        const drop = scroll * scroll * Math.pow(layer.depth, 4) * 0.4 * height;
        const parallaxX = pointer.x * (1.5 + 5.5 * layer.depth);
        const parallaxY = pointer.y * (1 + 2.5 * layer.depth);
        const offY = rise + drop + parallaxY;

        ctx.save();
        ctx.globalAlpha = terrainAlpha;
        ctx.translate(width / 2 + parallaxX, height);
        ctx.scale(zoom, zoom);
        ctx.drawImage(item.image, -drawWidth / 2, -drawHeight + offY, drawWidth, drawHeight);
        /* Ground plane below the shaded band (visible mid-travel). */
        ctx.fillStyle = item.baseColor;
        ctx.fillRect(-drawWidth / 2, offY - 1, drawWidth, height + 2);
        ctx.restore();
        // Fog evolves between the rock bands; nearer silhouettes occlude the
        // distant wisps, and the nearest veil softly crosses the valley floor.
        const fogY = height - layer.band * height * 0.65 * zoom + offY * zoom;
        valleyMist.draw(
          ctx,
          width,
          height,
          fogY,
          layer.depth,
          mistSeconds,
          (0.2 - 0.09 * layer.depth) * smoothstep(0.52, 0.92, pose) * terrainAlpha,
        );
      }

      if (mist > 0.005) {
        /* Densest through the band the camera is crossing; the frame's top
           and bottom stay readable so it reads as cloud, not a wash. */
        const veil = ctx.createLinearGradient(0, 0, 0, height);
        veil.addColorStop(0, `rgba(173, 186, 199, ${mist * 0.3})`);
        veil.addColorStop(0.34, `rgba(173, 186, 199, ${mist})`);
        veil.addColorStop(0.62, `rgba(173, 186, 199, ${mist * 0.85})`);
        veil.addColorStop(1, `rgba(173, 186, 199, ${mist * 0.22})`);
        ctx.fillStyle = veil;
        ctx.fillRect(0, 0, width, height);
      }

      /* Deep scroll: a gentle scrim keeps long copy readable while the
         range stays underfoot — the flight over the mountains never ends. */
      const scrim = smoothstep(0.35, 0.9, scroll) * 0.42;
      if (scrim > 0.003) {
        ctx.fillStyle = `rgba(2, 3, 5, ${scrim})`;
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
      return () => {
        disposed = true;
        terrainRequest?.abort();
        terrain?.release();
        valleyMist.dispose();
        window.removeEventListener("resize", resize);
        setAboutPose(0);
      };
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    let raf = 0;
    const loop = (now: number) => {
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    let hiddenAt: number | null = null;
    const onVisibility = () => {
      const now = performance.now();
      if (document.hidden) hiddenAt = now;
      else if (hiddenAt !== null) {
        if (phaseStart !== null) phaseStart += now - hiddenAt;
        hiddenAt = null;
      }
      lastDrawAt = now;
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      terrainRequest?.abort();
      terrain?.release();
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", resize);
      valleyMist.dispose();
      if (cloudsShifted) shiftClouds(null);
      setAboutPose(0);
    };
  }, [arrivalMs, reducedMotion, scrollProgress]);

  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden data-about-scene />;
}
