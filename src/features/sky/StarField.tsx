"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import {
  ambientStarsFor,
  arrivalProgress,
  CAMERA,
  ENTRANCE_MOBILE_MS,
  ENTRANCE_MS,
  projectionFactor,
  projectPoint,
  projectStarsFor,
  RETURN_MS,
  VANISHING_POINT,
  type ProjectStar,
  type Vec,
} from "./star-field";
import { dampingFactor } from "@/lib/motion";
import { sphereCoverageAt } from "./sphere-occlusion";

import {
  beginHomeFlight,
  finishHomeFlight,
  getAnchorSilhouette,
  isWorkEntrancePending,
  measureStarTargets,
  registerFlightHandler,
  SKY_DISABLED,
  surgeClouds,
  type TargetRect,
  type WorkTargets,
} from "./sky-director";
import { cameraSegment, logoScale, worldState } from "@/features/world/world-state";
import styles from "./StarField.module.css";

/** Sky presence per route: home is full, everything else recedes. */
const WORK_PRESENCE = 0.32;
/** Lateral camera offset (px at depth 1) driven by the pointer. */
const POINTER_AMP_HOME = 22;
const POINTER_AMP_WORK = 9;

type StarRuntime = {
  star: ProjectStar;
  /** Assigned cell for the current/last flight, or null when unassigned. */
  cell: TargetRect | null;
  /** Camera progress (0–1) at which this star meets its cell. */
  arrival: number;
  /** Arrival instant on the eased flight clock (ms). */
  arrivalTime: number;
  /** True once the star has handed off to its logo (never drawn again). */
  resolved: boolean;
  /** Star flew but had no cell in the last entrance (stays a point). */
  unassigned: boolean;
  el: HTMLElement | null;
};

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** Persistent perspective star field. Its camera drives the recorded Work flight;
 * live clouds surge for the same journey and measured stars resolve into DOM logos. */
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

    // ---- The fixed field --------------------------------------------------
    const projectStars = projectStarsFor(clientIds);
    let ambient = ambientStarsFor(window.innerWidth < 768 ? 55 : 110);
    const runtimes = new Map<string, StarRuntime>(
      projectStars.map((star) => [
        star.clientId,
        {
          star,
          cell: null,
          arrival: 1,
          arrivalTime: 0,
          resolved: false,
          unassigned: false,
          el: null,
        },
      ]),
    );

    // ---- The camera -------------------------------------------------------
    // One global progress value. Flights ease it between 0 (home) and
    // CAMERA.travel (work); outside flights it relaxes toward the route's
    // resting position. The pointer contributes a lateral offset divided by
    // depth — whole layers shift together, never individual stars.
    let cameraZ = pathnameRef.current.startsWith("/work") ? CAMERA.travel : 0;
    let cameraVelocity = 0;
    const cameraTarget = () => (pathnameRef.current.startsWith("/work") ? CAMERA.travel : 0);
    let presence = pathnameRef.current === "/" ? 1 : WORK_PRESENCE;
    const presenceTarget = () => (pathnameRef.current === "/" ? 1 : WORK_PRESENCE);

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

    // ---- Flights ----------------------------------------------------------
    type Flight = {
      kind: "toWork" | "toHome";
      startedAt: number;
      camera: number;
      /** The single camera's position at a given flight time (clamped). */
      camAt: (elapsed: number) => number;
      crossfade: number;
      settle: number;
      done: (() => void) | null;
      settleEnd: number;
      cleanupAt: number | null;
    };
    let flight: Flight | null = null;

    const cellCenter = (cell: TargetRect): Vec => ({
      x: cell.x + cell.width / 2,
      y: cell.y + cell.height / 2,
    });

    const prepareWorkFlight = (targets: WorkTargets, done: () => void) => {
      const timing = isMobile() ? ENTRANCE_MOBILE_MS : ENTRANCE_MS;
      const viewport = { x: width, y: height };
      const fromCam = cameraZ;
      const fromVelocity = cameraVelocity;
      // Preserve live velocity when a route flight is interrupted. The
      // environmental camera consumes this same progress each frame.
      const camAt = (elapsed: number) =>
        cameraSegment(fromCam, CAMERA.travel, fromVelocity, timing.camera, elapsed);
      /** Flight time at which the forward run first passes camera z. */
      const timeForCamera = (z: number) => {
        let lo = 0;
        let hi: number = timing.camera;
        for (let i = 0; i < 24; i++) {
          const mid = (lo + hi) / 2;
          if (camAt(mid) < z) lo = mid;
          else hi = mid;
        }
        return (lo + hi) / 2;
      };

      surgeClouds(timing.camera + timing.settle, 1);
      const next: Flight = {
        kind: "toWork",
        startedAt: performance.now(),
        camera: timing.camera,
        camAt,
        crossfade: timing.crossfade,
        settle: timing.settle,
        done,
        settleEnd: timing.camera,
        cleanupAt: null,
      };
      for (const runtime of runtimes.values()) {
        const { star } = runtime;
        const cell = targets.get(star.clientId) ?? null;
        runtime.cell = cell;
        runtime.resolved = false;
        runtime.unassigned = cell === null;
        runtime.el = cell
          ? document.querySelector<HTMLElement>(`[data-star-target="${CSS.escape(star.clientId)}"]`)
          : null;
        // Per-frame style writes must not fight the stylesheet's hover
        // transition; inline none wins for the duration of the flight.
        if (runtime.el) runtime.el.style.transition = "none";
        if (!cell) continue;
        runtime.arrival = arrivalProgress(star, cellCenter(cell), viewport);
        runtime.arrivalTime = timeForCamera(runtime.arrival * CAMERA.travel);
        next.settleEnd = Math.max(next.settleEnd, runtime.arrivalTime + timing.settle);
      }
      flight = next;
    };

    const prepareHomeFlight = (targets: WorkTargets, domIsLive: boolean) => {
      const viewport = { x: width, y: height };
      for (const runtime of runtimes.values()) {
        const cell = targets.get(runtime.star.clientId) ?? null;
        runtime.cell = cell;
        runtime.resolved = cell !== null;
        runtime.unassigned = false;
        if (cell) {
          runtime.arrival = arrivalProgress(runtime.star, cellCenter(cell), viewport);
        }
        // The logos fade down in place as the camera starts pulling back —
        // no per-star motion, just a straight local contraction.
        if (cell && domIsLive) {
          const el = document.querySelector<HTMLElement>(
            `[data-star-target="${CSS.escape(runtime.star.clientId)}"]`,
          );
          if (el?.isConnected) {
            el.style.transition = `transform ${RETURN_MS.contract}ms ease-in, opacity ${RETURN_MS.contract}ms linear`;
            el.style.transform = "scale(0.3)";
            el.style.opacity = "0";
          }
        }
      }
      const fromCam = cameraZ;
      const fromVelocity = cameraVelocity;
      surgeClouds(RETURN_MS.camera, 0.45);
      flight = {
        kind: "toHome",
        startedAt: performance.now(),
        camera: RETURN_MS.camera,
        camAt: (elapsed) => cameraSegment(fromCam, 0, fromVelocity, RETURN_MS.camera, elapsed),
        crossfade: 150,
        settle: 0,
        done: null,
        settleEnd: RETURN_MS.camera,
        cleanupAt: null,
      };
    };

    registerFlightHandler({
      flyToWork: (targets, done) => {
        if (reducedMotion) {
          // Short crossfade: the concept survives without spatial motion.
          for (const runtime of runtimes.values()) {
            runtime.resolved = targets.has(runtime.star.clientId);
            runtime.unassigned = !runtime.resolved;
          }
          cameraZ = CAMERA.travel;
          const els = document.querySelectorAll<HTMLElement>("[data-star-target]");
          els.forEach((el) => {
            el.style.transition = "opacity 320ms linear, transform 320ms ease-out";
            el.style.transform = "scale(1)";
            el.style.opacity = "1";
          });
          window.setTimeout(() => {
            done();
            window.setTimeout(() => {
              els.forEach((el) => {
                el.style.transition = "";
                el.style.opacity = "";
                el.style.transform = "";
              });
            }, 150);
          }, 340);
          return;
        }
        prepareWorkFlight(targets, done);
      },
      flyToHome: (targets, options) => {
        if (reducedMotion) {
          for (const runtime of runtimes.values()) {
            runtime.resolved = false;
            runtime.unassigned = false;
          }
          cameraZ = 0;
          finishHomeFlight();
          return;
        }
        prepareHomeFlight(targets, options.domIsLive);
      },
    });

    // Browser Back from /work to /: the DOM is about to vanish — snapshot the
    // cells synchronously (React hasn't re-rendered yet) and reverse the
    // camera from there. Forward navigation into /work stays a plain fade.
    const onPopState = () => {
      if (reducedMotion) return;
      const wasWork = pathnameRef.current.startsWith("/work");
      const nowHome = window.location.pathname === "/";
      if (wasWork && nowHome && (!flight || flight.kind !== "toHome")) {
        const targets = measureStarTargets();
        beginHomeFlight(targets, { domIsLive: false });
      }
    };
    window.addEventListener("popstate", onPopState);

    // ---- Render loop ------------------------------------------------------
    let lastFrameAt = performance.now();
    let frame = 0;
    let running = !document.hidden;

    const drawPoint = (x: number, y: number, radius: number, alpha: number) => {
      const anchor = getAnchorSilhouette();
      if (anchor && anchor.radius > 0) {
        const coverage = anchor.projection
          ? sphereCoverageAt(x, y, anchor.projection)
          : clamp01((1 - Math.hypot(x - anchor.x, y - anchor.y) / anchor.radius) / 0.06);
        alpha *= 1 - coverage * clamp01(anchor.alpha);
      }
      if (alpha <= 0.004) return;
      if (x < -40 || x > width + 40 || y < -40 || y > height + 40) return;
      ctx.fillStyle = `rgba(244, 244, 244, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    };

    const render = (now: number) => {
      if (!running) return;
      frame = requestAnimationFrame(render);
      const previousFrameAt = lastFrameAt;
      const deltaMs = Math.min(50, Math.max(0, now - lastFrameAt));
      const cameraSettled = Math.abs(cameraZ - cameraTarget()) < 0.0005;
      if (!reducedMotion) {
        const follow = dampingFactor(deltaMs, 3.7);
        pointer.x += (pointer.tx - pointer.x) * follow;
        pointer.y += (pointer.ty - pointer.y) * follow;
      }
      presence += (presenceTarget() - presence) * dampingFactor(deltaMs, 3);

      // ---- One global cameraProgress drives everything. ----
      const previousCamera = cameraZ;
      const elapsed = flight ? now - flight.startedAt : 0;
      if (flight) {
        cameraZ = flight.camAt(elapsed);
      } else if (!cameraSettled && !isWorkEntrancePending()) {
        // No flight owns the camera: relax toward the route's resting
        // position — but never while an entrance is about to claim it.
        cameraZ += (cameraTarget() - cameraZ) * dampingFactor(deltaMs, 5);
        if (Math.abs(cameraZ - cameraTarget()) < 0.0005) cameraZ = cameraTarget();
      }
      cameraVelocity =
        deltaMs > 0 ? (cameraZ - previousCamera) / Math.max(1, now - previousFrameAt) : 0;
      const progress = cameraZ / CAMERA.travel;

      lastFrameAt = now;

      worldState.workTravel = cameraZ / CAMERA.travel;
      ctx.clearRect(0, 0, width, height);
      const seconds = now / 1000;
      const amp = (presence > 0.7 ? POINTER_AMP_HOME : POINTER_AMP_WORK) * (reducedMotion ? 0 : 1);
      const parallax = { x: pointer.x * amp, y: pointer.y * amp };
      const vp = { x: VANISHING_POINT.x * width, y: VANISHING_POINT.y * height };

      // Perspective treatment: points stay tiny — receded stars (factor < 1)
      // shrink and dim so the field reads as genuinely far away; approaching
      // stars barely grow at all. Depth is carried by motion, not dot size.
      const perspectiveRadius = (size: number, z: number) =>
        size * Math.min(1.25, Math.sqrt(Math.max(0.3, projectionFactor(z, cameraZ))));
      const depthDim = (z: number) => Math.min(1, 0.25 + 0.75 * projectionFactor(z, cameraZ));

      // Ambient field: fixed deep points, projected through the same camera.
      for (const star of ambient) {
        const pos = projectPoint(
          { x: star.x * width, y: star.y * height },
          star.z,
          cameraZ,
          vp,
          parallax,
        );
        const twinkle =
          star.twinklePeriod > 0 && !reducedMotion
            ? 1 + 0.25 * Math.sin((seconds / star.twinklePeriod) * Math.PI * 2 + star.twinklePhase)
            : 1;
        drawPoint(
          pos.x,
          pos.y,
          perspectiveRadius(star.size, star.z),
          star.alpha * twinkle * 0.48 * (0.35 + 0.65 * presence) * depthDim(star.z),
        );
      }

      // Project stars: fixed points too. Resolved ones are their logos now
      // and are never drawn; the rest project through the same camera.
      const inWorkRest = !flight && presence < 0.55;
      for (const runtime of runtimes.values()) {
        const { star } = runtime;
        if (runtime.resolved && (!flight || flight.kind !== "toHome")) continue;
        // At the Work resting state, only stars left unassigned by the last
        // entrance remain as points; a direct /work load shows none (their
        // logos are simply present, never both).
        if (inWorkRest && !runtime.unassigned) continue;

        const pos = projectPoint(
          { x: star.x * width, y: star.y * height },
          star.z,
          cameraZ,
          vp,
          parallax,
        );
        const twinkle =
          star.twinklePeriod > 0 && !reducedMotion && !flight
            ? 1 + 0.22 * Math.sin((seconds / star.twinklePeriod) * Math.PI * 2 + star.twinklePhase)
            : 1;
        const restAlpha =
          (0.55 + 0.2 * (1 - (star.z - CAMERA.zNear) / (CAMERA.zFar - CAMERA.zNear))) * twinkle;

        if (flight?.kind === "toWork" && runtime.cell) {
          const fadeStart = runtime.arrivalTime - flight.crossfade;
          const fade = clamp01((elapsed - fadeStart) / flight.crossfade);
          if (fade < 1) {
            // The point, slightly brightening as it approaches its cell.
            drawPoint(
              pos.x,
              pos.y,
              perspectiveRadius(star.size, star.z) + fade * 1.2,
              (1 - fade) * Math.max(restAlpha, 0.8) * depthDim(star.z),
            );
          }
          if (runtime.el?.isConnected) {
            // Crossfade + scale-up happens at the cell itself — the logo is
            // never dragged; the star's straight line simply meets it.
            const scale = logoScale(elapsed - fadeStart, flight.crossfade, flight.settle);
            runtime.el.style.opacity = fade.toFixed(3);
            runtime.el.style.transform = `scale(${scale.toFixed(4)})`;
          }
          if (elapsed >= runtime.arrivalTime + flight.settle) {
            runtime.resolved = true;
            if (runtime.el?.isConnected) {
              runtime.el.style.opacity = "1";
              runtime.el.style.transform = "scale(1)";
            }
          }
          continue;
        }

        if (flight?.kind === "toHome" && runtime.cell) {
          // The star re-emerges on its ray as the camera passes back below
          // its arrival progress; the logo has already faded in place.
          const reveal = clamp01((runtime.arrival - progress) * 8);
          if (reveal > 0) {
            runtime.resolved = false;
            drawPoint(
              pos.x,
              pos.y,
              perspectiveRadius(star.size, star.z) + (1 - reveal) * 1.2,
              reveal * restAlpha,
            );
          }
          continue;
        }

        // Resting sky (home) or unassigned point behind Work.
        const dim = runtime.unassigned && presence < 0.7 ? 0.5 : 1;
        drawPoint(
          pos.x,
          pos.y,
          perspectiveRadius(star.size, star.z),
          restAlpha * (0.3 + 0.7 * presence) * dim * depthDim(star.z),
        );
      }

      // Flight bookkeeping.
      if (flight) {
        if (flight.kind === "toWork" && elapsed >= flight.settleEnd) {
          flight.done?.();
          flight.done = null;
          if (flight.cleanupAt === null) flight.cleanupAt = now + 250;
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
        } else if (flight.kind === "toHome" && elapsed >= flight.camera) {
          for (const runtime of runtimes.values()) {
            runtime.resolved = false;
            runtime.unassigned = false;
            runtime.cell = null;
          }
          flight = null;
          cameraZ = 0;
          finishHomeFlight();
        }
      }
    };
    frame = requestAnimationFrame(render);
    let hiddenAt: number | null = null;
    const onVisibility = () => {
      const now = performance.now();
      if (document.hidden) hiddenAt = now;
      else if (hiddenAt !== null) {
        if (flight) flight.startedAt += now - hiddenAt;
        hiddenAt = null;
      }
      running = !document.hidden;
      cancelAnimationFrame(frame);
      lastFrameAt = performance.now();
      if (running) frame = requestAnimationFrame(render);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", resize);
    resize();

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibility);
      registerFlightHandler(null);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("resize", resize);
      reducedMotionQuery.removeEventListener("change", onMotionChange);
    };
  }, [clientIds]);

  if (SKY_DISABLED) return null;
  return <canvas ref={canvasRef} className={styles.sky} aria-hidden />;
}
