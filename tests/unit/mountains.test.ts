import { describe, expect, it } from "vitest";

import { MOUNTAIN_LAYERS, MOUNTAIN_LAYERS_MOBILE } from "@/features/about/mountains";

describe("mountain layers", () => {
  it("stacks five desktop layers from haze to near foreground", () => {
    expect(MOUNTAIN_LAYERS).toHaveLength(5);
    const depths = MOUNTAIN_LAYERS.map((layer) => layer.depth);
    expect([...depths].sort((a, b) => a - b)).toEqual(depths);
    expect(MOUNTAIN_LAYERS[0]!.id).toBe("haze");
    expect(MOUNTAIN_LAYERS[4]!.depth).toBe(1);
  });

  it("washes distance into haze: farther layers carry more of it", () => {
    const hazes = MOUNTAIN_LAYERS.map((layer) => layer.haze);
    expect([...hazes].sort((a, b) => b - a)).toEqual(hazes);
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
