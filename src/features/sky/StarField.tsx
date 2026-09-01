"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import {
  ambientStarsFor,
  ENTRANCE,
  ENTRANCE_MOBILE,
  flightWindow,
  projectStarsFor,
  RETURN,
  type ProjectStar,
} from "./star-field";
import {
  measureStarTargets,
  registerFlightHandler,
  SKY_DISABLED,
  type TargetRect,
  type WorkTargets,
} from "./sky-director";
import styles from "./StarField.module.css";

/** Sky presence per route: home is full, everything else recedes. */
const WORK_PRESENCE = 0.32;
const POINTER_AMP_HOME = 14;
const POINTER_AMP_WORK = 6;
const VANISHING_POINT = { x: 0.5, y: 0.42 };

type Vec = { x: number; y: number };

type StarRuntime = {
  star: ProjectStar;
  /** Current rendered position (CSS px) and presentation. */
  px: number;
  py: number;
  alpha: number;
  radius: number;
  phase: "sky" | "toWork" | "resolved" | "toHome";
  /** Flight state (valid while phase is a flight or "resolved"). */
  start: Vec;
  rayEnd: Vec;
  control: Vec;
  target: TargetRect | null;
  delay: number;
  duration: number;
  /** Target element for the DOM crossfade, resolved at flight start. */
  el: HTMLElement | null;
};

const easeInCubic = (t: number) => t * t * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

function quadBezier(a: Vec, c: Vec, b: Vec, t: number): Vec {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  };
}

/**
 * The persistent night sky: a Canvas 2D star field above the clouds, mounted
 * once in the site layout. Forty seeded "project stars" correspond 1:1 with
 * the client list; on Work entry they accelerate through depth and resolve
 * into the measured logo cells (the DOM crossfade happens here, imperatively,
 * so React never renders per frame). Canvas 2D keeps the sky alive when
 * WebGL is unavailable — it is its own fallback.
 */
export function StarField({ clientIds }: { clientIds: string[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (SKY_DISABLED) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = reducedMotionQuery.matches;
    const onMotionChange = () => {
      reducedMotion = reducedMotionQuery.matches;
    };
    reducedMotionQuery.addEventListener("change", onMotionChange);

    // ---- Geometry ---------------------------------------------------------
    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(2, window.devicePixelRatio || 1);
    const isMobile = () => width < 768;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ambient = ambientStarsFor(isMobile() ? 55 : 110);
    };

    // ---- Star model -------------------------------------------------------
    const projectStars = projectStarsFor(clientIds);
    let ambient = ambientStarsFor(window.innerWidth < 768 ? 55 : 110);
    const runtimes = new Map<string, StarRuntime>(
      projectStars.map((star) => [
        star.clientId,
        {
          star,
          px: 0,
          py: 0,
          alpha: 1,
          radius: star.size,
          phase: "sky" as const,
          start: { x: 0, y: 0 },
          rayEnd: { x: 0, y: 0 },
          control: { x: 0, y: 0 },
          target: null,
          delay: 0,
          duration: 0,
          el: null,
        },
      ]),
    );

    // ---- Pointer parallax (lerped; deeper stars move less) ----------------
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const onPointerMove = (event: PointerEvent) => {
      pointer.tx = event.clientX / width - 0.5;
      pointer.ty = event.clientY / height - 0.5;
    };
    // Mirror touch like the clouds do, so both layers drift together.
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      pointer.tx = (width - touch.clientX) / width - 0.5;
      pointer.ty = (height - touch.clientY) / height - 0.5;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });

    // ---- Route presence (home bright, work dim) ---------------------------
    let presence = pathnameRef.current === "/" ? 1 : WORK_PRESENCE;
    const presenceTarget = () => (pathnameRef.current === "/" ? 1 : WORK_PRESENCE);

    // ---- Flight engine ----------------------------------------------------
    let flight: {
      kind: "toWork" | "toHome";
      startedAt: number;
      total: number;
      done: (() => void) | null;
      cleanupAt: number | null;
    } | null = null;

    const skyPosition = (star: ProjectStar, amp: number): Vec => {
      const depthFactor = 0.35 + 0.65 * star.depth;
      return {
        x: star.x * width + pointer.x * amp * depthFactor,
        y: star.y * height + pointer.y * amp * depthFactor,
      };
    };

    const prepareWorkFlight = (targets: WorkTargets, done: () => void) => {
      const timing = isMobile() ? ENTRANCE_MOBILE : ENTRANCE;
      const diag = Math.hypot(width, height);
      for (const runtime of runtimes.values()) {
        const { star } = runtime;
        const target = targets.get(star.clientId) ?? null;
        runtime.target = target;
        runtime.el = target
          ? document.querySelector<HTMLElement>(`[data-star-target="${CSS.escape(star.clientId)}"]`)
          : null;
        // Per-frame transform writes must not fight the stylesheet's hover
        // transition; inline none wins for the duration of the flight.
        if (runtime.el) runtime.el.style.transition = "none";
        if (!target) {
          // Filtered out this visit: recede into the ambient treatment.
          runtime.phase = "sky";
          continue;
        }
        const start = { x: runtime.px, y: runtime.py };
        const vp = { x: VANISHING_POINT.x * width, y: VANISHING_POINT.y * height };
        let dx = start.x - vp.x;
        let dy = start.y - vp.y;
        const len = Math.hypot(dx, dy) || 1;
        dx /= len;
        dy /= len;
        const rayLen = diag * (0.06 + 0.11 * star.depth);
        const rayEnd = { x: start.x + dx * rayLen, y: start.y + dy * rayLen };
        const center = {
          x: target.x + target.width / 2,
          y: target.y + target.height / 2,
        };
        const bend = Math.hypot(center.x - rayEnd.x, center.y - rayEnd.y) * 0.28;
        const schedule = flightWindow(star, timing);
        runtime.phase = "toWork";
        runtime.start = start;
        runtime.rayEnd = rayEnd;
        runtime.control = { x: rayEnd.x + dx * bend, y: rayEnd.y + dy * bend };
        runtime.delay = schedule.delay;
        runtime.duration = schedule.duration;
      }
      flight = {
        kind: "toWork",
        startedAt: performance.now(),
        total: timing.total,
        done,
        cleanupAt: null,
      };
    };

    const prepareHomeFlight = (targets: WorkTargets, domIsLive: boolean) => {
      const now = performance.now();
      for (const runtime of runtimes.values()) {
        const { star } = runtime;
        const target = targets.get(star.clientId) ?? null;
        if (!target) {
          runtime.phase = "sky";
          continue;
        }
        const center = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
        const schedule = flightWindow(star, RETURN);
        runtime.phase = "toHome";
        runtime.target = target;
        runtime.start = center;
        runtime.delay = schedule.delay + (domIsLive ? RETURN.contract : 40);
        runtime.duration = RETURN.travel;
        runtime.px = center.x;
        runtime.py = center.y;
        // Contract the DOM logo into the point before the canvas takes over.
        if (domIsLive) {
          const el = document.querySelector<HTMLElement>(
            `[data-star-target="${CSS.escape(star.clientId)}"]`,
          );
          if (el?.isConnected) {
            el.style.transition = `transform ${RETURN.contract}ms cubic-bezier(0.4, 0, 0.6, 1) ${schedule.delay}ms, opacity ${RETURN.contract}ms linear ${schedule.delay}ms`;
            el.style.transform = "scale(0.12)";
            el.style.opacity = "0";
          }
        }
      }
      flight = {
        kind: "toHome",
        startedAt: now,
        total: RETURN.total,
        done: null,
        cleanupAt: null,
      };
    };

    registerFlightHandler({
      flyToWork: (targets, done) => {
        if (reducedMotion) {
          // Short crossfade: the concept survives without spatial motion.
          for (const runtime of runtimes.values()) runtime.phase = "sky";
          const els = document.querySelectorAll<HTMLElement>("[data-star-target]");
          els.forEach((el) => {
            el.style.transition = "opacity 320ms linear";
            el.style.opacity = "1";
          });
          window.setTimeout(() => {
            done();
            window.setTimeout(() => {
              els.forEach((el) => {
                el.style.transition = "";
                el.style.opacity = "";
              });
            }, 150);
          }, 340);
          return;
        }
        prepareWorkFlight(targets, done);
      },
      flyToHome: (targets, options) => {
        if (reducedMotion) return;
        prepareHomeFlight(targets, options.domIsLive);
      },
    });

    // Browser Back from /work to /: the DOM is about to vanish — snapshot the
    // cells synchronously (React hasn't re-rendered yet) and reverse from
    // there. Forward navigation into /work stays a plain fade by design.
    const onPopState = () => {
      if (reducedMotion) return;
      const wasWork = pathnameRef.current.startsWith("/work");
      const nowHome = window.location.pathname === "/";
      if (wasWork && nowHome && (!flight || flight.kind !== "toHome")) {
        const targets = measureStarTargets();
        if (targets.size > 0) prepareHomeFlight(targets, false);
      }
    };
    window.addEventListener("popstate", onPopState);

    // ---- Render loop ------------------------------------------------------
    let frame = 0;
    let running = true;
    let frameParity = 0;

    const drawStar = (x: number, y: number, radius: number, alpha: number, glow: number) => {
      if (alpha <= 0.004) return;
      if (glow > 0.01) {
        const glowRadius = radius * (2.5 + glow * 4);
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
        gradient.addColorStop(0, `rgba(246, 247, 244, ${alpha})`);
        gradient.addColorStop(0.45, `rgba(238, 240, 236, ${alpha * 0.35 * glow})`);
        gradient.addColorStop(1, "rgba(238, 240, 236, 0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      ctx.fillStyle = `rgba(244, 245, 242, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    };

    const render = (now: number) => {
      if (!running) return;
      frame = requestAnimationFrame(render);
      frameParity ^= 1;
      // Idle sky renders at half rate; flights get every frame.
      if (!flight && frameParity === 0 && !reducedMotion) return;

      // Pointer + presence easing.
      if (!reducedMotion) {
        pointer.x += (pointer.tx - pointer.x) * 0.06;
        pointer.y += (pointer.ty - pointer.y) * 0.06;
      }
      presence += (presenceTarget() - presence) * 0.05;

      ctx.clearRect(0, 0, width, height);
      const seconds = now / 1000;
      const amp = presence > 0.7 ? POINTER_AMP_HOME : POINTER_AMP_WORK;

      // Ambient field.
      for (const star of ambient) {
        const depthFactor = 0.35 + 0.65 * star.depth;
        const x = star.x * width + (reducedMotion ? 0 : pointer.x * amp * depthFactor);
        const y = star.y * height + (reducedMotion ? 0 : pointer.y * amp * depthFactor);
        const twinkle =
          star.twinklePeriod > 0 && !reducedMotion
            ? 1 + 0.25 * Math.sin((seconds / star.twinklePeriod) * Math.PI * 2 + star.twinklePhase)
            : 1;
        drawStar(x, y, star.size, star.alpha * twinkle * (0.35 + 0.65 * presence), 0);
      }

      const elapsed = flight ? now - flight.startedAt : 0;

      // Project stars.
      let flying = 0;
      for (const runtime of runtimes.values()) {
        const { star } = runtime;
        if (runtime.phase === "sky") {
          const home = skyPosition(star, reducedMotion ? 0 : amp);
          runtime.px = home.x;
          runtime.py = home.y;
          const twinkle =
            star.twinklePeriod > 0 && !reducedMotion
              ? 1 +
                0.22 * Math.sin((seconds / star.twinklePeriod) * Math.PI * 2 + star.twinklePhase)
              : 1;
          // Project stars sit slightly brighter than ambient — points, not logos.
          const alpha = (0.55 + 0.2 * star.depth) * twinkle * (0.3 + 0.7 * presence);
          drawStar(runtime.px, runtime.py, star.size, alpha, 0);
          continue;
        }

        if (runtime.phase === "resolved") continue;

        if (runtime.phase === "toWork" && runtime.target) {
          const t = clamp01((elapsed - runtime.delay) / runtime.duration);
          if (t < 1) flying++;
          const timing = isMobile() ? ENTRANCE_MOBILE : ENTRANCE;
          const split = timing.depthPortion;
          const center = {
            x: runtime.target.x + runtime.target.width / 2,
            y: runtime.target.y + runtime.target.height / 2,
          };
          if (t <= 0) {
            // Waiting for its wave: intensify slightly in place.
            drawStar(runtime.px, runtime.py, star.size * 1.2, 0.85, 0.1);
            continue;
          }
          if (t < split) {
            const u = easeInCubic(t / split);
            const x = runtime.start.x + (runtime.rayEnd.x - runtime.start.x) * u;
            const y = runtime.start.y + (runtime.rayEnd.y - runtime.start.y) * u;
            runtime.px = x;
            runtime.py = y;
            const radius = star.size * (1 + u * 2.2);
            // Light streak while accelerating (desktop only, restrained).
            if (!isMobile() && u > 0.15) {
              const trail = 10 + u * 26;
              const dx = runtime.rayEnd.x - runtime.start.x;
              const dy = runtime.rayEnd.y - runtime.start.y;
              const len = Math.hypot(dx, dy) || 1;
              ctx.strokeStyle = `rgba(240, 242, 238, ${0.28 * u})`;
              ctx.lineWidth = radius * 0.9;
              ctx.lineCap = "round";
              ctx.beginPath();
              ctx.moveTo(x - (dx / len) * trail, y - (dy / len) * trail);
              ctx.lineTo(x, y);
              ctx.stroke();
            }
            drawStar(x, y, radius, 1, 0.25 * u);
            continue;
          }
          const v = easeOutCubic((t - split) / (1 - split));
          const pos = quadBezier(runtime.rayEnd, runtime.control, center, v);
          runtime.px = pos.x;
          runtime.py = pos.y;
          // The point swells into an indistinct glow, then hands off to the logo.
          const maxBlob = Math.min(runtime.target.width, runtime.target.height) * 0.34;
          const blob = star.size * 3 + (maxBlob - star.size * 3) * v;
          const crossfade = clamp01((v - 0.55) / 0.45);
          drawStar(pos.x, pos.y, blob, (1 - crossfade) * 0.95, 0.85);
          if (runtime.el?.isConnected) {
            runtime.el.style.opacity = String(crossfade);
            const scale =
              0.92 + 0.08 * easeOutCubic(crossfade) + 0.004 * Math.sin(crossfade * Math.PI);
            runtime.el.style.transform = `scale(${scale.toFixed(4)})`;
          }
          if (t >= 1) {
            runtime.phase = "resolved";
            if (runtime.el?.isConnected) {
              runtime.el.style.opacity = "1";
              runtime.el.style.transform = "scale(1)";
            }
          }
          continue;
        }

        if (runtime.phase === "toHome") {
          const t = clamp01((elapsed - runtime.delay) / runtime.duration);
          if (t < 1) flying++;
          const home = skyPosition(star, 0);
          if (t <= 0) {
            // The logo is still contracting; a growing point takes its place.
            const warm = clamp01(elapsed / RETURN.contract);
            drawStar(runtime.start.x, runtime.start.y, star.size * (0.6 + warm), warm * 0.9, 0.4);
            continue;
          }
          const u = easeInOutCubic(t);
          const x = runtime.start.x + (home.x - runtime.start.x) * u;
          const y = runtime.start.y + (home.y - runtime.start.y) * u;
          runtime.px = x;
          runtime.py = y;
          drawStar(x, y, star.size * (2.4 - 1.4 * u), 0.95 - 0.3 * u, 0.35 * (1 - u));
          if (t >= 1) runtime.phase = "sky";
          continue;
        }
      }

      // Flight bookkeeping.
      if (flight && elapsed > flight.total && flying === 0) {
        if (flight.kind === "toWork") {
          flight.done?.();
          flight.done = null;
          if (flight.cleanupAt === null) flight.cleanupAt = now + 350;
          if (now >= flight.cleanupAt) {
            for (const runtime of runtimes.values()) {
              if (runtime.el?.isConnected) {
                runtime.el.style.opacity = "";
                runtime.el.style.transform = "";
                runtime.el.style.transition = "";
              }
              runtime.el = null;
            }
            flight = null;
          }
        } else {
          flight = null;
        }
      }
    };
    frame = requestAnimationFrame(render);

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(frame);
      } else if (!running) {
        running = true;
        frame = requestAnimationFrame(render);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", resize);
    resize();

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      registerFlightHandler(null);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      reducedMotionQuery.removeEventListener("change", onMotionChange);
    };
  }, [clientIds]);

  if (SKY_DISABLED) return null;
  return <canvas ref={canvasRef} className={styles.sky} aria-hidden />;
}
