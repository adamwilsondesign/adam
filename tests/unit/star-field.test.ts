import { describe, expect, it } from "vitest";

import {
  ambientStarsFor,
  arrivalProgress,
  assignEntranceOrder,
  CAMERA,
  cameraForFactor,
  hashString,
  HEADLINE_EXCLUSION,
  projectionFactor,
  projectPoint,
  projectStarsFor,
  starForClient,
  starRay,
  VANISHING_POINT,
} from "@/features/sky/star-field";

const ids = Array.from({ length: 40 }, (_, i) => `client-${i.toString(36)}-${i * 7}`);
const viewport = { x: 1440, y: 900 };

describe("the fixed star field", () => {
  it("creates exactly one star per client, keyed by id", () => {
    const stars = projectStarsFor(ids);
    expect(stars).toHaveLength(40);
    expect(new Set(stars.map((star) => star.clientId)).size).toBe(40);
    stars.forEach((star, index) => expect(star.clientId).toBe(ids[index]));
  });

  it("is deterministic: the same id always yields the same coordinates", () => {
    for (const id of ids) {
      expect(starForClient(id)).toEqual(starForClient(id));
    }
  });

  it("derives everything from the id, not call order or the surrounding list", () => {
    const fromFullList = projectStarsFor(ids).find((star) => star.clientId === ids[7]);
    expect(fromFullList).toEqual(starForClient(ids[7]!));
  });

  it("scatters stars inside the sky bounds and outside the headline block", () => {
    for (const star of projectStarsFor(ids)) {
      expect(star.x).toBeGreaterThanOrEqual(0);
      expect(star.x).toBeLessThanOrEqual(1);
      expect(star.y).toBeGreaterThanOrEqual(0);
      expect(star.y).toBeLessThanOrEqual(1);
      const inHeadline =
        star.x >= HEADLINE_EXCLUSION.x &&
        star.x <= HEADLINE_EXCLUSION.x + HEADLINE_EXCLUSION.width &&
        star.y >= HEADLINE_EXCLUSION.y &&
        star.y <= HEADLINE_EXCLUSION.y + HEADLINE_EXCLUSION.height;
      expect(inHeadline).toBe(false);
    }
  });

  it("keeps every star a tiny point at a depth the camera never reaches", () => {
    for (const star of projectStarsFor(ids)) {
      expect(star.size).toBeGreaterThan(0.5);
      expect(star.size).toBeLessThan(3);
      expect(star.z).toBeGreaterThanOrEqual(CAMERA.zNear);
      expect(star.z).toBeLessThanOrEqual(CAMERA.zFar);
      expect(star.z).toBeGreaterThan(CAMERA.travel);
    }
  });

  it("keeps ambient stars deeper than every project star's flight", () => {
    for (const star of ambientStarsFor(110)) {
      expect(star.z).toBeGreaterThanOrEqual(CAMERA.ambientNear);
      expect(star.z).toBeGreaterThan(CAMERA.travel);
      expect(star.size).toBeLessThan(1.4);
      expect(star.alpha).toBeLessThanOrEqual(0.5);
    }
    expect(ambientStarsFor(55)).toHaveLength(55);
    expect(ambientStarsFor(110)).toEqual(ambientStarsFor(110));
  });
});

describe("perspective projection", () => {
  it("is the identity at camera zero and grows monotonically with the camera", () => {
    expect(projectionFactor(2, 0)).toBe(1);
    expect(projectionFactor(2, 0.5)).toBeGreaterThan(1);
    expect(projectionFactor(2, 1)).toBeGreaterThan(projectionFactor(2, 0.5));
  });

  it("moves shallower stars faster than deeper ones (depth = speed)", () => {
    const cam = CAMERA.travel * 0.8;
    expect(projectionFactor(CAMERA.zNear, cam)).toBeGreaterThan(projectionFactor(CAMERA.zFar, cam));
  });

  it("inverts cleanly: cameraForFactor(z, projectionFactor(z, c)) === c", () => {
    for (const z of [1.3, 2, 3]) {
      for (const cam of [0.2, 0.6, 1]) {
        expect(cameraForFactor(z, projectionFactor(z, cam))).toBeCloseTo(cam, 10);
      }
    }
  });

  it("projects every star along its straight radial line from the vanishing point", () => {
    const vp = { x: VANISHING_POINT.x * viewport.x, y: VANISHING_POINT.y * viewport.y };
    for (const star of projectStarsFor(ids).slice(0, 10)) {
      const rest = { x: star.x * viewport.x, y: star.y * viewport.y };
      const a = projectPoint(rest, star.z, 0.3, vp, { x: 0, y: 0 });
      const b = projectPoint(rest, star.z, 0.9, vp, { x: 0, y: 0 });
      // Both projections must be collinear with vp and rest: cross ≈ 0.
      const cross = (a.x - vp.x) * (rest.y - vp.y) - (a.y - vp.y) * (rest.x - vp.x);
      const crossB = (b.x - vp.x) * (rest.y - vp.y) - (b.y - vp.y) * (rest.x - vp.x);
      expect(Math.abs(cross)).toBeLessThan(1e-6);
      expect(Math.abs(crossB)).toBeLessThan(1e-6);
      // And strictly outward: farther camera, farther from the vp.
      expect(Math.hypot(b.x - vp.x, b.y - vp.y)).toBeGreaterThan(
        Math.hypot(a.x - vp.x, a.y - vp.y),
      );
    }
  });

  it("shifts whole depth layers together under parallax, deeper layers less", () => {
    const vp = { x: 720, y: 378 };
    const rest = { x: 900, y: 200 };
    const parallax = { x: 20, y: 0 };
    const shallow = projectPoint(rest, 1.3, 0, vp, parallax);
    const deep = projectPoint(rest, 3, 0, vp, parallax);
    const still = projectPoint(rest, 1.3, 0, vp, { x: 0, y: 0 });
    expect(Math.abs(shallow.x - still.x)).toBeGreaterThan(Math.abs(deep.x - rest.x));
    // Two stars at the same depth shift by exactly the same amount.
    const other = projectPoint({ x: 300, y: 600 }, 1.3, 0, vp, parallax);
    const otherStill = projectPoint({ x: 300, y: 600 }, 1.3, 0, vp, { x: 0, y: 0 });
    expect(other.x - otherStill.x).toBeCloseTo(shallow.x - still.x, 10);
  });
});

describe("star → cell assignment", () => {
  const grid = (columns: number, rows: number) => {
    const centers: { x: number; y: number }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        centers.push({ x: 120 + c * 160, y: 140 + r * 150 });
      }
    }
    return centers;
  };

  it("assigns every client to exactly one cell (a permutation)", () => {
    const centers = grid(8, 5);
    const order = assignEntranceOrder(ids, centers, viewport);
    expect(order).toHaveLength(40);
    expect(new Set(order).size).toBe(40);
    expect([...order].sort()).toEqual([...ids].sort());
  });

  it("is deterministic for identical inputs", () => {
    const centers = grid(8, 5);
    expect(assignEntranceOrder(ids, centers, viewport)).toEqual(
      assignEntranceOrder(ids, centers, viewport),
    );
  });

  it("prefers cells that lie on a star's own radial line", () => {
    // One star, two cells: one sits on its ray beyond the rest radius, the
    // other far off it — the on-ray cell must win.
    const id = ids[3]!;
    const ray = starRay(starForClient(id), viewport);
    const onRay = {
      x: ray.vp.x + ray.dir.x * (ray.r0 * 2),
      y: ray.vp.y + ray.dir.y * (ray.r0 * 2),
    };
    const offRay = { x: ray.vp.x - ray.dir.x * 500, y: ray.vp.y - ray.dir.y * 500 };
    const order = assignEntranceOrder([id, ids[4]!], [offRay, onRay], viewport);
    expect(order[1]).toBe(id);
  });

  it("gives each assigned star a valid arrival progress inside the travel", () => {
    const centers = grid(8, 5);
    const order = assignEntranceOrder(ids, centers, viewport);
    order.forEach((id, cell) => {
      const c = arrivalProgress(starForClient(id), centers[cell]!, viewport);
      expect(c).toBeGreaterThan(0);
      expect(c).toBeLessThanOrEqual(1);
    });
  });

  it("orders arrivals naturally: deeper stars needing the same expansion arrive later", () => {
    const shallow = { clientId: "a", x: 0.7, y: 0.2, z: CAMERA.zNear };
    const deep = { clientId: "b", x: 0.7, y: 0.2, z: CAMERA.zFar };
    const cell = { x: 0.85 * viewport.x, y: 0.05 * viewport.y };
    expect(arrivalProgress(shallow, cell, viewport)).toBeLessThan(
      arrivalProgress(deep, cell, viewport),
    );
  });
});

describe("hashString", () => {
  it("is stable and spreads distinct ids", () => {
    expect(hashString("auralith")).toBe(hashString("auralith"));
    expect(new Set(ids.map(hashString)).size).toBe(ids.length);
  });
});
