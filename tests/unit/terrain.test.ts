import { describe, expect, it } from "vitest";

import { MOUNTAIN_LAYERS } from "@/features/about/mountains";
import { projectRow, terrainHeight } from "@/features/about/terrain";

const W = 640;
const H = 200;

describe("terrainHeight", () => {
  const layer = MOUNTAIN_LAYERS[4]!; // the near, deepest-valley layer

  it("is deterministic and bounded", () => {
    for (const [u, v] of [
      [-1.2, 0.1],
      [-0.4, 0.5],
      [0, 0.9],
      [0.7, 0.3],
      [1.5, 0],
    ] as const) {
      const a = terrainHeight(layer, u, v);
      expect(a).toBe(terrainHeight(layer, u, v));
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1.2);
    }
  });

  it("carves the central valley: the middle sits below the flanks", () => {
    const sample = (u: number) => {
      let sum = 0;
      for (let i = 0; i <= 20; i++) sum += terrainHeight(layer, u, i / 20);
      return sum / 21;
    };
    const center = sample(0);
    const flanks = (sample(-0.9) + sample(0.9)) / 2;
    expect(center).toBeLessThan(flanks * 0.45);
  });

  it("differs between layers (seeded, not shared)", () => {
    const a = terrainHeight(MOUNTAIN_LAYERS[1]!, 0.6, 0.4);
    const b = terrainHeight(MOUNTAIN_LAYERS[3]!, 0.6, 0.4);
    expect(a).not.toBe(b);
  });
});

describe("projectRow", () => {
  const layer = MOUNTAIN_LAYERS[4]!;

  it("is deterministic with monotonic screen x and lights in range", () => {
    const row = projectRow(layer, 0.4, W, H);
    const again = projectRow(layer, 0.4, W, H);
    expect(Array.from(row.ys)).toEqual(Array.from(again.ys));
    for (let i = 1; i < row.xs.length; i++) {
      expect(row.xs[i]!).toBeGreaterThan(row.xs[i - 1]!);
    }
    for (const light of row.lights) {
      expect(light).toBeGreaterThanOrEqual(0);
      expect(light).toBeLessThanOrEqual(1);
    }
    expect(row.fog).toBeGreaterThanOrEqual(layer.haze);
    expect(row.fog).toBeLessThanOrEqual(1);
  });

  it("foreshortens: nearer rows sit lower and span wider", () => {
    const far = projectRow(layer, 0, W, H);
    const near = projectRow(layer, 1, W, H);
    expect(near.xs[0]!).toBeLessThan(far.xs[0]!);
    expect(near.xs[near.xs.length - 1]!).toBeGreaterThan(far.xs[far.xs.length - 1]!);
    // Ground level (the last quiet columns) is lower on screen up close.
    const groundOf = (row: typeof far) => Math.max(...Array.from(row.ys));
    expect(groundOf(near)).toBeGreaterThan(groundOf(far));
  });

  it("lights moon-facing slopes brighter than shadowed ones", () => {
    // The moon sits off-canvas to the upper right: where the surface
    // descends to the right (screen y increasing), faces catch its light.
    const row = projectRow(layer, 0.25, W, H);
    let lit = 0;
    let litN = 0;
    let dark = 0;
    let darkN = 0;
    for (let i = 2; i < row.ys.length - 2; i++) {
      const slope = row.ys[i + 2]! - row.ys[i - 2]!;
      if (slope > 1.5) {
        lit += row.lights[i]!;
        litN++;
      } else if (slope < -1.5) {
        dark += row.lights[i]!;
        darkN++;
      }
    }
    expect(litN).toBeGreaterThan(10);
    expect(darkN).toBeGreaterThan(10);
    expect(lit / litN).toBeGreaterThan((dark / darkN) * 1.5);
  });
});
