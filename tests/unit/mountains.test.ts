import { describe, expect, it } from "vitest";

import { MOUNTAIN_LAYERS, MOUNTAIN_LAYERS_MOBILE, ridgeHeights } from "@/features/about/mountains";

describe("mountain layers", () => {
  it("stacks five desktop layers from haze to near-black foreground", () => {
    expect(MOUNTAIN_LAYERS).toHaveLength(5);
    const depths = MOUNTAIN_LAYERS.map((layer) => layer.depth);
    expect([...depths].sort((a, b) => a - b)).toEqual(depths);
    expect(MOUNTAIN_LAYERS[0]!.id).toBe("haze");
    expect(MOUNTAIN_LAYERS[4]!.depth).toBe(1);
  });

  it("keeps the mobile silhouette as an ordered subset of the desktop set", () => {
    expect(MOUNTAIN_LAYERS_MOBILE).toHaveLength(3);
    for (const layer of MOUNTAIN_LAYERS_MOBILE) {
      expect(MOUNTAIN_LAYERS).toContain(layer);
    }
    const indices = MOUNTAIN_LAYERS_MOBILE.map((layer) => MOUNTAIN_LAYERS.indexOf(layer));
    expect([...indices].sort((a, b) => a - b)).toEqual(indices);
  });

  it("cuts the valley deeper on nearer layers", () => {
    const valleys = MOUNTAIN_LAYERS.map((layer) => layer.valley);
    expect([...valleys].sort((a, b) => a - b)).toEqual(valleys);
  });
});

describe("ridgeHeights", () => {
  it("is deterministic for a layer", () => {
    const layer = MOUNTAIN_LAYERS[2]!;
    expect(ridgeHeights(layer, 128)).toEqual(ridgeHeights(layer, 128));
  });

  it("returns the requested sample count within bounds", () => {
    for (const layer of MOUNTAIN_LAYERS) {
      const heights = ridgeHeights(layer, 96);
      expect(heights).toHaveLength(96);
      for (const height of heights) {
        expect(height).toBeGreaterThanOrEqual(0.04);
        expect(height).toBeLessThanOrEqual(1);
      }
    }
  });

  it("opens a central valley: the middle sits below the flanks", () => {
    const layer = MOUNTAIN_LAYERS[4]!; // the near layer carries the deepest cut
    const heights = ridgeHeights(layer, 201);
    const center = heights[100]!;
    const flanks = (heights[10]! + heights[30]! + heights[170]! + heights[190]!) / 4;
    expect(center).toBeLessThan(flanks * 0.6);
  });

  it("produces distinct contours per layer (seeded, not shared)", () => {
    const a = ridgeHeights(MOUNTAIN_LAYERS[1]!, 64);
    const b = ridgeHeights(MOUNTAIN_LAYERS[3]!, 64);
    expect(a).not.toEqual(b);
  });
});
