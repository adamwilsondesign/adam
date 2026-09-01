// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  beginHomeFlight,
  beginWorkFlight,
  consumeWorkEntrance,
  isReturnFlightActive,
  measureStarTargets,
  provideWorkTargets,
  registerFlightHandler,
  type WorkTargets,
} from "@/features/sky/sky-director";

const targetsOf = (ids: string[]): WorkTargets =>
  new Map(ids.map((id, i) => [id, { x: i * 100, y: 50, width: 80, height: 60 }]));

afterEach(() => {
  registerFlightHandler(null);
  // Drain any pending entrance so tests stay independent.
  provideWorkTargets(new Map(), () => undefined);
});

describe("home → work progression", () => {
  it("offers the star entrance only after the homepage begins a flight", () => {
    registerFlightHandler({ flyToWork: vi.fn(), flyToHome: vi.fn() });
    expect(consumeWorkEntrance()).toBe(false);
    beginWorkFlight();
    expect(consumeWorkEntrance()).toBe(true);
    // Idempotent read: StrictMode may evaluate the initializer twice.
    expect(consumeWorkEntrance()).toBe(true);
  });

  it("never offers the entrance without a live canvas handler", () => {
    beginWorkFlight();
    expect(consumeWorkEntrance()).toBe(false);
  });

  it("hands measured targets to the canvas and completes through its done", () => {
    const flyToWork = vi.fn((_: WorkTargets, done: () => void) => done());
    registerFlightHandler({ flyToWork, flyToHome: vi.fn() });
    beginWorkFlight();
    const done = vi.fn();
    provideWorkTargets(targetsOf(["a", "b"]), done);
    expect(flyToWork).toHaveBeenCalledOnce();
    expect(done).toHaveBeenCalledOnce();
    // The pending entrance is claimed: a later mount uses the normal fade.
    expect(consumeWorkEntrance()).toBe(false);
  });

  it("completes immediately when there is nothing to fly", () => {
    registerFlightHandler({ flyToWork: vi.fn(), flyToHome: vi.fn() });
    const done = vi.fn();
    provideWorkTargets(new Map(), done);
    expect(done).toHaveBeenCalledOnce();
  });
});

describe("work → home reverse progression", () => {
  it("starts the reverse flight and reports it active while settling", () => {
    const flyToHome = vi.fn();
    registerFlightHandler({ flyToWork: vi.fn(), flyToHome });
    beginHomeFlight(targetsOf(["a"]), { domIsLive: true });
    expect(flyToHome).toHaveBeenCalledWith(expect.any(Map), { domIsLive: true });
    expect(isReturnFlightActive()).toBe(true);
  });

  it("clears any pending work entrance (fast home/work/home cycles)", () => {
    registerFlightHandler({ flyToWork: vi.fn(), flyToHome: vi.fn() });
    beginWorkFlight();
    beginHomeFlight(targetsOf(["a"]), { domIsLive: false });
    expect(consumeWorkEntrance()).toBe(false);
  });
});

describe("measureStarTargets", () => {
  it("collects one rect per star-target id from the live DOM", () => {
    document.body.innerHTML = `
      <span data-star-target="one"></span>
      <span data-star-target="two"></span>
      <span data-star-target="one"></span>
    `;
    const rect = { x: 10, y: 20, width: 30, height: 40, top: 20, left: 10, right: 40, bottom: 60 };
    for (const el of document.querySelectorAll("span")) {
      (el as HTMLElement).getBoundingClientRect = () => rect as DOMRect;
    }
    const targets = measureStarTargets();
    expect(targets.size).toBe(2);
    expect(targets.get("one")).toEqual({ x: 10, y: 20, width: 30, height: 40 });
    document.body.innerHTML = "";
  });

  it("ignores collapsed (unmeasurable) elements", () => {
    document.body.innerHTML = `<span data-star-target="ghost"></span>`;
    expect(measureStarTargets().size).toBe(0);
    document.body.innerHTML = "";
  });
});
