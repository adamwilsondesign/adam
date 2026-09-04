"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

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
const TEXTURE_CAP = 480;
const TEXTURE_DPR = 1.5;

function routeFor(pathname: string): OrbRoute {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/work")) return "work";
  if (pathname.startsWith("/about")) return "about";
  return "other";
}

/**
 * Per-route projection of the fixed distant orb. Sizes are viewport-relative
 * (≈3–5vw desktop); mobile reduces prominence so it never competes with
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
        y: height * 0.23,
        diameter: 4.4 * vw * k,
        alpha: mobile ? 0.62 : 0.82,
      };
    case "work":
      // Withdrawn into the right gutter beside the logo field — present,
      // never competing with a client mark.
      return {
        x: width * 0.955,
        y: height * 0.45,
        diameter: 3 * vw * k,
        alpha: mobile ? 0.28 : 0.34,
      };
    case "about":
      // In the valley notch beneath the copy, near the vanishing point,
      // drifting marginally closer as the scroll travels toward the range.
      return {
        x: width * 0.5,
        y: height * 0.66,
        diameter: (5 + 1.6 * aboutScroll) * vw * k,
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

  const cx = box / 2;
  const cy = box / 2;
  const r = box / (2 * BOX_RATIO);
  const [sr, sg, sb] = hexToRgb(ATMOS.lunarSilver);
  const [shR, shG, shB] = hexToRgb(ATMOS.cloudShadow);
  const [clR, clG, clB] = hexToRgb(ATMOS.cloud);
  // The moon sits off-canvas upper right; the rim answers from there.
  const lx = cx + MOON_DIRECTION.x * r * 0.5;
  const ly = cy - MOON_DIRECTION.y * r * 0.5;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  /* Matte mineral body: barely lighter than the night around it. */
  const body = ctx.createRadialGradient(lx, ly, r * 0.1, cx, cy, r);
  body.addColorStop(0, "#101413");
  body.addColorStop(0.55, "#0a0d0c");
  body.addColorStop(1, "#050706");
  ctx.fillStyle = body;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  /* Soft terminator: shadow rolling in from the far side of the light. */
  const term = ctx.createRadialGradient(lx, ly, r * 0.35, lx, ly, r * 2);
  term.addColorStop(0, `rgba(${shR}, ${shG}, ${shB}, 0)`);
  term.addColorStop(0.55, `rgba(${shR}, ${shG}, ${shB}, 0.25)`);
  term.addColorStop(1, `rgba(${shR}, ${shG}, ${shB}, 0.78)`);
  ctx.fillStyle = term;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  /* Asymmetric silver rim: strongest toward the moon, dying away opposite. */
  const rim = ctx.createRadialGradient(lx, ly, r * 0.5, lx, ly, r * 1.52);
  rim.addColorStop(0.62, `rgba(${sr}, ${sg}, ${sb}, 0)`);
  rim.addColorStop(0.86, `rgba(${sr}, ${sg}, ${sb}, 0.5)`);
  rim.addColorStop(0.98, `rgba(${sr}, ${sg}, ${sb}, 0.1)`);
  rim.addColorStop(1, `rgba(${sr}, ${sg}, ${sb}, 0)`);
  ctx.fillStyle = rim;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  /* Restrained static grain, baked once — never animated. */
  const inset = Math.ceil(cx - r);
  const span = Math.ceil(r * 2);
  const image = ctx.getImageData(inset, inset, span, span);
  const data = image.data;
  for (let y = 0; y < span; y++) {
    for (let x = 0; x < span; x++) {
      const o = (y * span + x) * 4;
      if (data[o + 3] === 0) continue;
      const gain = 0.98 + 0.04 * hash2(0x0eb, x, y);
      data[o] = Math.min(255, data[o]! * gain);
      data[o + 1] = Math.min(255, data[o + 1]! * gain);
      data[o + 2] = Math.min(255, data[o + 2]! * gain);
    }
  }
  ctx.putImageData(image, inset, inset);

  /* Atmospheric edge loss: the silhouette thins into the sky. */
  ctx.globalCompositeOperation = "destination-out";
  const edge = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r);
  edge.addColorStop(0, "rgba(0, 0, 0, 0)");
  edge.addColorStop(0.85, "rgba(0, 0, 0, 0.12)");
  edge.addColorStop(1, "rgba(0, 0, 0, 0.55)");
  ctx.fillStyle = edge;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();

  /* A slow band of near atmosphere crossing the lower third — the orb sits
     behind weather, not pasted onto the sky. */
  const wisp = ctx.createRadialGradient(
    cx - r * 0.3,
    cy + r * 0.55,
    0,
    cx - r * 0.3,
    cy + r * 0.55,
    r * 1.5,
  );
  wisp.addColorStop(0, `rgba(${clR}, ${clG}, ${clB}, 0.5)`);
  wisp.addColorStop(1, `rgba(${clR}, ${clG}, ${clB}, 0)`);
  ctx.save();
  ctx.translate(cx - r * 0.3, cy + r * 0.55);
  ctx.scale(1.6, 0.38);
  ctx.translate(-(cx - r * 0.3), -(cy + r * 0.55));
  ctx.fillStyle = wisp;
  ctx.fillRect(0, 0, box, box);
  ctx.restore();
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
      canvas.style.width = `${box.toFixed(1)}px`;
      canvas.style.height = `${box.toFixed(1)}px`;
      canvas.style.transform = `translate3d(${(pose.x - box / 2).toFixed(1)}px, ${(pose.y - box / 2).toFixed(1)}px, 0)`;
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
    let parity = 0;
    const step = () => {
      if (!running) return;
      frame = requestAnimationFrame(step);
      parity ^= 1;
      if (parity === 0) return; // the orb needs no more than half rate
      const target = targetPose();
      if (reducedMotionQuery.matches) {
        Object.assign(current, target);
        apply(current);
        return;
      }
      // Critically-damped drift toward the route's projection — the orb only
      // ever moves because the shared camera does.
      const k = 0.075;
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
