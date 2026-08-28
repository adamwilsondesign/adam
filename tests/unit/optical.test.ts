import { describe, expect, it } from "vitest";

import { opticalLogoBox } from "@/features/work/optical";

describe("opticalLogoBox", () => {
  it("gives a square symbol a balanced box", () => {
    const box = opticalLogoBox(1);
    expect(box.widthPct).toBeGreaterThan(30);
    expect(box.widthPct).toBeLessThan(55);
    expect(box.widthPct).toBeCloseTo(box.heightPct, 0);
    expect(box.alignment).toBe("center");
  });

  it("area-normalizes: a wide wordmark gets more width, less height", () => {
    const symbol = opticalLogoBox(1);
    const wordmark = opticalLogoBox(4);
    expect(wordmark.widthPct).toBeGreaterThan(symbol.widthPct);
    expect(wordmark.heightPct).toBeLessThan(symbol.heightPct);
  });

  it("caps extreme wordmarks so they never touch the cell edges", () => {
    const extreme = opticalLogoBox(9);
    expect(extreme.widthPct).toBeLessThanOrEqual(78);
  });

  it("caps tall marks below the cell height", () => {
    const tall = opticalLogoBox(0.3);
    expect(tall.heightPct).toBeLessThanOrEqual(58);
  });

  it("preserves the box aspect while clamping", () => {
    const box = opticalLogoBox(8);
    // Clamped width, height follows the same reduction — the box stays wide.
    expect(box.widthPct / box.heightPct).toBeCloseTo(8, 0);
  });

  it("defaults degenerate input to a square", () => {
    expect(opticalLogoBox(0)).toEqual(opticalLogoBox(1));
    expect(opticalLogoBox(null)).toEqual(opticalLogoBox(1));
    expect(opticalLogoBox(undefined)).toEqual(opticalLogoBox(1));
  });

  it("applies the per-client scale override within bounds", () => {
    const base = opticalLogoBox(1);
    const scaled = opticalLogoBox(1, { scale: 1.2 });
    expect(scaled.widthPct).toBeCloseTo(base.widthPct * 1.2, 1);
    // Out-of-range scales are clamped to 1.5, then the height cap applies —
    // an oversized square mark can never exceed the cell's height budget.
    const wild = opticalLogoBox(1, { scale: 9 });
    expect(wild.heightPct).toBeLessThanOrEqual(58);
    expect(wild.widthPct).toBeLessThanOrEqual(58);
    expect(wild.widthPct).toBeGreaterThan(scaled.widthPct);
  });

  it("padding shrinks the available cell", () => {
    const base = opticalLogoBox(6);
    const padded = opticalLogoBox(6, { padding: 0.15 });
    expect(padded.widthPct).toBeLessThan(base.widthPct);
  });

  it("passes the alignment override through", () => {
    expect(opticalLogoBox(1, { alignment: "start" }).alignment).toBe("start");
    expect(opticalLogoBox(1, { alignment: null }).alignment).toBe("center");
  });
});
