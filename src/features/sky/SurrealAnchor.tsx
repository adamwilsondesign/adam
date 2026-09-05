"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { dampingFactor } from "@/lib/motion";
import { ATMOS, hexToRgb, MOON_DIRECTION } from "@/lib/atmosphere";

import { getAboutScrollProgress, SKY_DISABLED } from "./sky-director";
import styles from "./SurrealAnchor.module.css";

/**
 * The one surreal constant: a distant eclipse-like orb, fixed in world
 * space, present on Home, Work and About. It is matte and imperfect — an
 * asymmetric silver rim keyed to the site's single moon direction, a soft
 * shadow terminator, restrained grain, edges lost to atmosphere — never a
 * glossy sphere. All apparent motion comes from the shared route camera:
 * the component eases between per-route projections and otherwise holds
 * perfectly still. Its texture is pre-rendered once per resize (Canvas 2D);
 * per-frame work is a style write.
 */

type OrbRoute = "home" | "work" | "about" | "other";

type OrbPose = { x: number; y: number; diameter: number; alpha: number };

/** The canvas box is wider than the orb: room for halo and the haze wisp. */
const BOX_RATIO = 1.6;
/** Texture cap in device pixels — the orb is soft by design. */
const TEXTURE_CAP = 720;
const TEXTURE_DPR = 1.5;

function routeFor(pathname: string): OrbRoute {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/work")) return "work";
  if (pathname.startsWith("/about")) return "about";
  return "other";
}

/**
 * Per-route projection of the fixed distant orb. Sizes are viewport-relative
 * (14–20vw desktop); mobile reduces prominence so it never competes with
 * controls or content.
 */
export function orbPoseFor(
  route: OrbRoute,
  width: number,
  height: number,
  aboutScroll: number,
): OrbPose {
  const vw = width / 100;
  const mobile = width < 768;
  const k = mobile ? 0.72 : 1;
  switch (route) {
    case "home":
      // Open sky, upper right — clear of the headline block, toward the
      // motivated light.
      return {
        x: width * 0.78,
        y: height * 0.27,
        diameter: 14 * vw * k,
        alpha: mobile ? 0.62 : 0.82,
      };
    case "work":
      // Withdrawn into the right gutter beside the logo field — present,
      // never competing with a client mark.
      return {
        x: width * 0.84,
        y: height * 0.25,
        diameter: 16 * vw * k,
        alpha: mobile ? 0.16 : 0.22,
      };
    case "about":
      // In the valley notch beneath the copy, near the vanishing point,
      // drifting marginally closer as the scroll travels toward the range.
      return {
        x: width * 0.78,
        y: height * 0.48,
        diameter: (17 + 3 * aboutScroll) * vw * k,
        alpha: mobile ? 0.66 : 0.8,
      };
    default:
      return { x: width * 0.5, y: height * 0.3, diameter: 3 * vw, alpha: 0 };
  }
}

/** Integer hash → [0,1) for the static surface grain. */
function hash2(seed: number, x: number, y: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Pre-renders the orb texture (body, terminator, rim, grain, haze wisp). */
function bakeOrb(canvas: HTMLCanvasElement, box: number): void {
  canvas.width = box;
  canvas.height = box;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, box, box);

  const pixels = ctx.createImageData(box, box);
  const light = hexToRgb(ATMOS.lunarSilver);
  const shadow = hexToRgb(ATMOS.cloudShadow);
  const radius = box / (2 * BOX_RATIO);
  // A lit hemisphere, rather than an outlined eclipse. Texture is baked
  // only on resize; ambient frames only transform the finished surface.
  for (let y = 0; y < box; y++) {
    for (let x = 0; x < box; x++) {
      const nx = (x - box / 2) / radius;
      const ny = (box / 2 - y) / radius;
      const angle = Math.atan2(ny, nx);
      const contour = 1 + 0.012 * Math.sin(angle * 3 + 0.8) + 0.006 * Math.cos(angle * 5);
      const d2 = (nx * nx + ny * ny) / (contour * contour);
      if (d2 >= 1) continue;
      const nz = Math.sqrt(1 - d2);
      const diffuse = Math.max(0, nx * MOON_DIRECTION.x * 0.7 + ny * 0.65 + nz * 0.42);
      const mineral = Math.sin(nx * 14 + Math.sin(ny * 8)) * Math.cos(ny * 11) * 0.015;
      const intensity = 0.055 + 0.7 * Math.pow(diffuse, 1.25) + mineral;
      const grain = (hash2(0x0eb, x, y) - 0.5) * 3;
      const offset = (y * box + x) * 4;
      for (let c = 0; c < 3; c++) {
        pixels.data[offset + c] = shadow[c]! + (light[c]! - shadow[c]!) * intensity + grain;
      }
      // The lower contour disappears in atmosphere while the moonward
      // silhouette remains crisp enough to communicate monumental scale.
      const edge = Math.min(1, (1 - d2) * radius * 0.6);
      const weather = 1 - 0.62 * Math.exp(-Math.pow((ny + 0.5) / 0.34, 2));
      pixels.data[offset + 3] = 255 * edge * weather;
    }
  }
  ctx.putImageData(pixels, 0, 0);
}

export function SurrealAnchor() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pathname = usePathname();
  const routeRef = useRef<OrbRoute>(routeFor(pathname));
  useEffect(() => {
    routeRef.current = routeFor(pathname);
  }, [pathname]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const apply = (pose: OrbPose) => {
      const box = pose.diameter * BOX_RATIO;
      canvas.style.transform = `translate3d(${(pose.x - box / 2).toFixed(2)}px, ${(pose.y - box / 2).toFixed(2)}px, 0) scale(${box / Math.max(1, canvas.width)})`;
      canvas.style.opacity = pose.alpha.toFixed(3);
    };

    const bake = () => {
      const dpr = Math.min(TEXTURE_DPR, window.devicePixelRatio || 1);
      // Bake at the largest size any route projects, then downscale in CSS.
      const largest = Math.max(
        orbPoseFor("home", window.innerWidth, window.innerHeight, 0).diameter,
        orbPoseFor("about", window.innerWidth, window.innerHeight, 1).diameter,
      );
      bakeOrb(canvas, Math.min(TEXTURE_CAP, Math.ceil(largest * BOX_RATIO * dpr)));
    };

    const targetPose = () =>
      orbPoseFor(routeRef.current, window.innerWidth, window.innerHeight, getAboutScrollProgress());

    bake();
    const current = targetPose();
    apply(current);

    const onResize = () => {
      bake();
      Object.assign(current, targetPose());
      apply(current);
    };
    window.addEventListener("resize", onResize);

    /* Hermetic builds (and only they) hold the orb perfectly still: snap to
       each route's projection with no animation loop. */
    if (SKY_DISABLED) {
      const snap = () => {
        Object.assign(current, targetPose());
        apply(current);
      };
      const interval = window.setInterval(snap, 300);
      return () => {
        window.clearInterval(interval);
        window.removeEventListener("resize", onResize);
      };
    }

    let frame = 0;
    let running = true;
    let lastFrameAt = performance.now();
    const step = (now: number) => {
      if (!running) return;
      frame = requestAnimationFrame(step);
      const deltaMs = Math.min(50, Math.max(0, now - lastFrameAt));
      lastFrameAt = now;
      const target = targetPose();
      if (reducedMotionQuery.matches) {
        Object.assign(current, target);
        apply(current);
        return;
      }
      // Frame-rate independent drift toward the route's projection — the orb only
      // ever moves because the shared camera does.
      const k = dampingFactor(deltaMs, 3.2);
      current.x += (target.x - current.x) * k;
      current.y += (target.y - current.y) * k;
      current.diameter += (target.diameter - current.diameter) * k;
      current.alpha += (target.alpha - current.alpha) * k;
      apply(current);
    };
    frame = requestAnimationFrame(step);

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(frame);
      } else if (!running) {
        running = true;
        frame = requestAnimationFrame(step);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.orb} aria-hidden data-surreal-orb />;
}
