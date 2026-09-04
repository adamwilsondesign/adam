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
import { cinematicEase, invCinematicEase } from "@/lib/motion";

import {
  isWorkEntrancePending,
  measureStarTargets,
  registerFlightHandler,
  shiftClouds,
  SKY_DISABLED,
  surgeClouds,
  type TargetRect,
  type WorkTargets,
} from "./sky-director";
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

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** The clouds' share of the flight: camera-driven scale and lift, so the
 *  travel is felt as one environment moving, not a simulation boiling. */
const FLIGHT_CLOUD_SCALE = 0.14;
const FLIGHT_CLOUD_LIFT = 0.045;
/** Motion blur cap (px) on the cloud layer, tied to camera velocity. */
const FLIGHT_BLUR_MAX = 0.8;

/**
 * The persistent night sky: a fixed 3D field of stars drawn on Canvas 2D,
 * mounted once in the site layout. Forty seeded "project stars" correspond
 * 1:1 with the client list. All movement — the Work entrance, the return
 * home, pointer parallax — is one camera transform: a forward translation
 * (global cameraProgress) plus a depth-divided lateral offset, projected in
 * perspective. Stars never animate individually; each travels its straight
 * radial line from the shared vanishing point, and depth alone decides
 * apparent speed and arrival order. Canvas 2D keeps the sky alive when
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
    let cameraZ = pathnameRef.current === "/" ? 0 : CAMERA.travel;
    const cameraTarget = () => (pathnameRef.current === "/" ? 0 : CAMERA.travel);
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
      // One long forward run on the cinematic curve — the camera only ever
      // advances, drifting a breath past its mark and settling. The clouds
      // ride the same camera (scale, lift, velocity blur below) with only a
      // gentle evolution surge, so the travel reads as movement through the
      // environment rather than the simulation boiling.
      const camAt = (elapsed: number) =>
        fromCam + (CAMERA.travel - fromCam) * cinematicEase(clamp01(elapsed / timing.camera));
      /** Flight time at which the forward run first passes camera z. */
      const timeForCamera = (z: number) =>
        timing.camera * invCinematicEase(clamp01((z - fromCam) / (CAMERA.travel - fromCam)));
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
      surgeClouds(RETURN_MS.camera, 0.45);
      flight = {
        kind: "toHome",
        startedAt: performance.now(),
        camera: RETURN_MS.camera,
        camAt: (elapsed) => fromCam * (1 - cinematicEase(clamp01(elapsed / RETURN_MS.camera))),
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
        if (targets.size > 0) prepareHomeFlight(targets, false);
      }
    };
    window.addEventListener("popstate", onPopState);

    // ---- Render loop ------------------------------------------------------
    let frame = 0;
    let running = true;
    let frameParity = 0;
    let cloudsShifted = false;
    let lastCameraZ = cameraZ;
    let lastFrameAt = performance.now();

    const drawPoint = (x: number, y: number, radius: number, alpha: number) => {
      if (alpha <= 0.004) return;
      if (x < -40 || x > width + 40 || y < -40 || y > height + 40) return;
      ctx.fillStyle = `rgba(244, 245, 242, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    };

    const render = (now: number) => {
      if (!running) return;
      frame = requestAnimationFrame(render);
      frameParity ^= 1;
      const cameraSettled = Math.abs(cameraZ - cameraTarget()) < 0.0005;
      // The idle sky renders at half rate; camera movement gets every frame.
      if (!flight && cameraSettled && frameParity === 0 && !reducedMotion) return;

      if (!reducedMotion) {
        pointer.x += (pointer.tx - pointer.x) * 0.06;
        pointer.y += (pointer.ty - pointer.y) * 0.06;
      }
      presence += (presenceTarget() - presence) * 0.05;

      // ---- One global cameraProgress drives everything. ----
      const elapsed = flight ? now - flight.startedAt : 0;
      if (flight) {
        cameraZ = flight.camAt(elapsed);
      } else if (!cameraSettled && !isWorkEntrancePending()) {
        // No flight owns the camera: relax toward the route's resting
        // position — but never while an entrance is about to claim it.
        cameraZ += (cameraTarget() - cameraZ) * 0.08;
        if (Math.abs(cameraZ - cameraTarget()) < 0.0005) cameraZ = cameraTarget();
      }
      const progress = cameraZ / CAMERA.travel;

      // The clouds ride the same camera during a flight: a swell of scale
      // and lift that returns to rest at both ends (never a snap), plus a
      // whisper of blur tied to camera velocity that vanishes at rest.
      if (flight) {
        const dt = Math.max(1, now - lastFrameAt);
        const velocity = Math.abs(cameraZ - lastCameraZ) / dt;
        const swell = Math.sin(Math.PI * clamp01(elapsed / flight.camera));
        shiftClouds({
          y: -swell * FLIGHT_CLOUD_LIFT * height,
          scale: 1 + swell * FLIGHT_CLOUD_SCALE,
          opacity: 1,
          blur: Math.min(FLIGHT_BLUR_MAX, velocity * 350),
        });
        cloudsShifted = true;
      } else if (cloudsShifted) {
        shiftClouds(null);
        cloudsShifted = false;
      }
      lastCameraZ = cameraZ;
      lastFrameAt = now;

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
          star.alpha * twinkle * (0.35 + 0.65 * presence) * depthDim(star.z),
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
            const settle = clamp01((elapsed - runtime.arrivalTime) / flight.settle);
            const scale = 0.3 + 0.42 * fade + 0.28 * easeOutCubic(settle);
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
      if (cloudsShifted) shiftClouds(null);
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
