/**
 * Coordination between the persistent star canvas and the route components.
 *
 * The canvas (StarField) lives in the site layout and never unmounts; the
 * homepage and Work views come and go around it. This module is the message
 * bus between them:
 *
 *   HomeView  ── beginWorkFlight() ─────────▶ pending flag
 *   WorkView  ── consumeWorkEntrance() ─────▶ decides "stars" entrance
 *   the grid  ── provideWorkTargets(map) ───▶ canvas flies stars into cells
 *   WorkView  ── beginHomeFlight() ─────────▶ canvas reverses toward the sky
 *
 * Everything is in-memory and per-session by design: a hard refresh lands on
 * the completed state of whatever route it loads, never mid-transition.
 */

export type TargetRect = { x: number; y: number; width: number; height: number };

export type WorkTargets = Map<string, TargetRect>;

type FlightHandler = {
  /** Fly project stars into their measured cells; call done when settled. */
  flyToWork: (targets: WorkTargets, done: () => void) => void;
  /** Contract logos back into points and retreat to the home sky. */
  flyToHome: (targets: WorkTargets, options: { domIsLive: boolean }) => void;
};

/** True in hermetic test builds: the sky (and its flights) stand down. */
export const SKY_DISABLED = process.env.NEXT_PUBLIC_DISABLE_SKY === "1";

/** A pending entrance expires if Work doesn't mount promptly after the click. */
const PENDING_ENTRANCE_TTL = 2500;

let pendingWorkFlightAt: number | null = null;
let handler: FlightHandler | null = null;
let flightActive: "toWork" | "toHome" | null = null;

export function registerFlightHandler(next: FlightHandler | null): void {
  handler = next;
}

/** The homepage Work link was activated: the next Work mount flies stars. */
export function beginWorkFlight(): void {
  if (SKY_DISABLED) return;
  pendingWorkFlightAt = performance.now();
}

/**
 * Should this Work mount use the star entrance? True when the canvas is
 * live and the homepage click was recent. Reading is idempotent (StrictMode
 * double-invokes state initializers); the flag clears when the flight is
 * actually claimed by provideWorkTargets, or on a return flight.
 */
export function consumeWorkEntrance(): boolean {
  if (SKY_DISABLED || !handler || pendingWorkFlightAt === null) return false;
  return performance.now() - pendingWorkFlightAt < PENDING_ENTRANCE_TTL;
}

/**
 * True while a star entrance has been requested but its flight has not yet
 * claimed the targets. The canvas holds its resting camera during this gap —
 * otherwise the route change would start easing the camera toward the Work
 * position on its own and eat the flight's run-up.
 */
export function isWorkEntrancePending(): boolean {
  return (
    !SKY_DISABLED &&
    pendingWorkFlightAt !== null &&
    performance.now() - pendingWorkFlightAt < PENDING_ENTRANCE_TTL
  );
}

/** The grid measured its logo boxes; hand them to the canvas to animate. */
export function provideWorkTargets(targets: WorkTargets, done: () => void): void {
  pendingWorkFlightAt = null;
  if (SKY_DISABLED || !handler || targets.size === 0) {
    done();
    return;
  }
  flightActive = "toWork";
  handler.flyToWork(targets, () => {
    flightActive = null;
    done();
  });
}

/**
 * Leaving Work for home. `domIsLive` distinguishes the explicit Back control
 * (the grid stays mounted briefly, so logos can visibly contract) from a
 * browser Back pop (the DOM is about to vanish; the canvas takes over
 * immediately from the snapshot).
 */
export function beginHomeFlight(targets: WorkTargets, options: { domIsLive: boolean }): void {
  pendingWorkFlightAt = null;
  if (SKY_DISABLED || !handler || targets.size === 0) return;
  flightActive = "toHome";
  handler.flyToHome(targets, options);
  // The canvas owns completion; the return flight never blocks navigation.
  window.setTimeout(() => {
    if (flightActive === "toHome") flightActive = null;
  }, 1400);
}

/** True while a return flight is settling — HomeView softens its entrance. */
export function isReturnFlightActive(): boolean {
  return flightActive === "toHome";
}

/** Measure every star-target logo box currently in the document. */
export function measureStarTargets(): WorkTargets {
  const targets: WorkTargets = new Map();
  if (typeof document === "undefined") return targets;
  document.querySelectorAll<HTMLElement>("[data-star-target]").forEach((el) => {
    const id = el.dataset.starTarget;
    if (!id || targets.has(id)) return;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0)
      targets.set(id, { x: rect.x, y: rect.y, width: rect.width, height: rect.height });
  });
  return targets;
}
