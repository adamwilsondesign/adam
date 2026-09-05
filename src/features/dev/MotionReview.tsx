"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import styles from "./MotionReview.module.css";

type Sample = {
  canvas: HTMLCanvasElement;
  elapsed: number;
  route: string;
  captureMs: number;
  sources: number;
};
type Recording = {
  kind: "navigation" | "idle";
  startedAt: number;
  duration: number;
  nextSample: number;
  lastFrameAt: number;
  deltas: number[];
  samples: Sample[];
  errors: string[];
};
type Sheet = Omit<Recording, "nextSample" | "lastFrameAt">;

const SAMPLE_INTERVAL = 200;
const TILE_WIDTH = 400;
const subscribeQuery = () => () => {};
const serverQuery = () => false;
let initialReviewQuery: boolean | undefined;
function browserQuery() {
  // Keep the review session enabled when navigation removes its query string.
  initialReviewQuery ??=
    process.env.NODE_ENV === "development" &&
    new URLSearchParams(window.location.search).get("motion-review") === "1";
  return initialReviewQuery;
}

/** Scenery only: never inspect React state or replace the actual scene rendering. */
function captureEnvironment(elapsed: number): Sample {
  const startedAt = performance.now();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const canvas = document.createElement("canvas");
  canvas.width = TILE_WIDTH;
  canvas.height = Math.round((TILE_WIDTH * viewportHeight) / viewportWidth);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Contact-sheet canvas is unavailable.");
  const scale = TILE_WIDTH / viewportWidth;
  ctx.scale(scale, scale);
  ctx.fillStyle = "#080808";
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);

  const sources = Array.from(
    document.querySelectorAll<HTMLCanvasElement>(
      '[data-live-clouds] canvas, canvas[class*="sky"], canvas[data-about-scene], canvas[data-environment-canvas]',
    ),
  ).filter((source) => !source.closest("[data-motion-review]"));
  // DOM order breaks ties, matching the persistent cloud/star layers.
  sources.sort((a, b) => {
    const z = (source: HTMLElement) => {
      let node: HTMLElement | null = source;
      while (node && node !== document.body) {
        const value = getComputedStyle(node).zIndex;
        if (value !== "auto") return Number(value) || 0;
        node = node.parentElement;
      }
      return 0;
    };
    return z(a) - z(b);
  });

  let drawn = 0;
  for (const source of sources) {
    const rect = source.getBoundingClientRect();
    if (!source.width || !source.height || !rect.width || !rect.height) continue;
    let opacity = 1;
    const filters: string[] = [];
    let hidden = false;
    for (let node: HTMLElement | null = source; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      opacity *= Number(style.opacity);
      if (style.filter !== "none") filters.push(style.filter);
      if (style.display === "none" || style.visibility === "hidden") hidden = true;
    }
    if (hidden || opacity < 0.001) continue;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.filter = filters.join(" ") || "none";
    // getBoundingClientRect incorporates the cloud deck's scale/translation.
    ctx.drawImage(source, rect.left, rect.top, rect.width, rect.height);
    ctx.restore();
    drawn++;
  }
  return {
    canvas,
    elapsed,
    route: window.location.pathname,
    captureMs: performance.now() - startedAt,
    sources: drawn,
  };
}

function percentile(values: number[], fraction: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
}

/** Mount through a development-guarded dynamic import in the site layout. */
export function MotionReview() {
  const enabled = useSyncExternalStore(subscribeQuery, browserQuery, serverQuery);
  const [mode, setMode] = useState<"ready" | "armed" | "recording">("ready");
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const recording = useRef<Recording | null>(null);
  const armed = useRef(false);
  const deadline = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frame = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const finish = () => {
      const current = recording.current;
      if (!current) return;
      recording.current = null;
      cancelAnimationFrame(frame.current);
      if (deadline.current) clearTimeout(deadline.current);
      deadline.current = null;
      setSheet(current);
      setMode("ready");
    };
    const start = (kind: Recording["kind"]) => {
      if (recording.current) return;
      armed.current = false;
      setSheet(null);
      const now = performance.now();
      recording.current = {
        kind,
        startedAt: now,
        duration: kind === "navigation" ? 3000 : 5000,
        nextSample: 0,
        lastFrameAt: now,
        deltas: [],
        samples: [],
        errors: [],
      };
      setMode("recording");
      const tick = (timestamp: number) => {
        const current = recording.current;
        if (!current) return;
        current.deltas.push(timestamp - current.lastFrameAt);
        current.lastFrameAt = timestamp;
        // Retain stalls; no large-delta filtering or claims of GPU frame time.
        frame.current = requestAnimationFrame(tick);
      };
      frame.current = requestAnimationFrame(tick);
      deadline.current = setTimeout(finish, recording.current.duration + 300);
    };
    const onEnvironmentFrame = () => {
      const current = recording.current;
      if (!current) return;
      const elapsed = performance.now() - current.startedAt;
      if (elapsed >= current.nextSample && elapsed <= current.duration + 200) {
        try {
          current.samples.push(captureEnvironment(elapsed));
        } catch (error) {
          current.errors.push(error instanceof Error ? error.message : String(error));
        }
        current.nextSample = (Math.floor(elapsed / SAMPLE_INTERVAL) + 1) * SAMPLE_INTERVAL;
      }
      if (elapsed >= current.duration) finish();
    };
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const reviewAction = event.target.closest<HTMLElement>("[data-motion-review-action]");
      if (reviewAction?.dataset.motionReviewAction === "idle") {
        start("idle");
        return;
      }
      if (!armed.current || event.target.closest("[data-motion-review]")) return;
      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      if (link) {
        const destination = new URL(link.href, window.location.href);
        if (
          destination.origin === window.location.origin &&
          destination.pathname !== window.location.pathname
        )
          start("navigation");
        return;
      }
      const button = event.target.closest<HTMLButtonElement>("button");
      const label = button?.getAttribute("aria-label") ?? "";
      if (label === "Back" || label.endsWith(" — home")) start("navigation");
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("adam:environment-frame", onEnvironmentFrame);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("adam:environment-frame", onEnvironmentFrame);
      cancelAnimationFrame(frame.current);
      if (deadline.current) clearTimeout(deadline.current);
      recording.current = null;
    };
  }, [enabled]);

  if (!enabled || process.env.NODE_ENV !== "development") return null;

  const deltas = sheet?.deltas ?? [];
  const costs = sheet?.samples.map((sample) => sample.captureMs) ?? [];
  return (
    <div data-motion-review>
      <div className={styles.controls} data-motion-review-controls hidden={mode === "recording"}>
        <span>Motion review</span>
        <button
          type="button"
          onClick={() => {
            armed.current = !armed.current;
            if (armed.current) setSheet(null);
            setMode(armed.current ? "armed" : "ready");
          }}
          aria-pressed={mode === "armed"}
        >
          {mode === "armed" ? "Armed — choose a page" : "Arm next navigation"}
        </button>
        <button type="button" data-motion-review-action="idle">
          Capture idle (5s)
        </button>
        {sheet && (
          <button type="button" onClick={() => setSheet(null)}>
            Close sheet
          </button>
        )}
      </div>
      {sheet && (
        <section
          className={styles.sheet}
          role="dialog"
          aria-modal="true"
          aria-label="Motion contact sheet"
          data-motion-review-sheet
        >
          <header className={styles.summary}>
            <h2>{sheet.kind === "idle" ? "Idle evolution" : "Navigation journey"}</h2>
            <p>
              {sheet.samples.length} scenery samples, approximately every 200ms. The foreground
              content is omitted.
            </p>
            <p>
              rAF spacing, including capture overhead: median {percentile(deltas, 0.5).toFixed(1)}
              ms; p95 {percentile(deltas, 0.95).toFixed(1)}ms; maximum{" "}
              {Math.max(0, ...deltas).toFixed(1)}ms; {deltas.filter((delta) => delta > 50).length}{" "}
              intervals over 50ms.
            </p>
            <p>
              Snapshot overhead: median {percentile(costs, 0.5).toFixed(1)}ms; maximum{" "}
              {Math.max(0, ...costs).toFixed(1)}ms. This recorder adds work and these timings are
              not a performance benchmark.
            </p>
            <p>Renderer browser: {navigator.userAgent}</p>
            <p>
              Live canvases are copied immediately after the cloud renderer submits its frame. DOM
              gradients and foreground UI are not captured.
            </p>
            {!sheet.samples.length && (
              <p>No renderer frames received. Check the development-only afterRender event hook.</p>
            )}
            {sheet.errors.length > 0 && (
              <p>Capture errors: {Array.from(new Set(sheet.errors)).join("; ")}</p>
            )}
            <button type="button" onClick={() => setSheet(null)}>
              Close sheet
            </button>
          </header>
          <div className={styles.grid}>
            {sheet.samples.map((sample, index) => (
              <figure key={index} data-motion-review-sample={index}>
                <canvas
                  width={sample.canvas.width}
                  height={sample.canvas.height}
                  ref={(canvas) => {
                    canvas?.getContext("2d")?.drawImage(sample.canvas, 0, 0);
                  }}
                />
                <figcaption>
                  +{(sample.elapsed / 1000).toFixed(2)}s · {sample.route} · {sample.sources}{" "}
                  canvases · capture {sample.captureMs.toFixed(1)}ms
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
