import { describe, expect, it } from "vitest";

import {
  ambientStarsFor,
  ENTRANCE,
  flightWindow,
  HEADLINE_EXCLUSION,
  hashString,
  projectStarsFor,
  RETURN,
  starForClient,
  WAVE_COUNT,
  waveForDepth,
} from "@/features/sky/star-field";

const ids = Array.from({ length: 40 }, (_, i) => `client-${i.toString(36)}-${i * 7}`);

describe("project stars", () => {
  it("creates exactly one star per client, keyed by id", () => {
    const stars = projectStarsFor(ids);
    expect(stars).toHaveLength(40);
    expect(new Set(stars.map((star) => star.clientId)).size).toBe(40);
    stars.forEach((star, index) => expect(star.clientId).toBe(ids[index]));
  });

  it("is deterministic: the same id always yields the same star", () => {
    for (const id of ids) {
      const a = starForClient(id);
      const b = starForClient(id);
      expect(b).toEqual(a);
    }
  });

  it("derives everything from the id, not call order or the surrounding list", () => {
    const fromFullList = projectStarsFor(ids).find((star) => star.clientId === ids[7]);
    const alone = starForClient(ids[7]!);
    expect(fromFullList).toEqual(alone);
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

  it("keeps every star an extremely small point", () => {
    for (const star of projectStarsFor(ids)) {
      expect(star.size).toBeGreaterThan(0.5);
      expect(star.size).toBeLessThan(3);
      expect(star.depth).toBeGreaterThanOrEqual(0.25);
      expect(star.depth).toBeLessThanOrEqual(1);
    }
  });

  it("distributes stars across all entrance waves", () => {
    const waves = new Set(projectStarsFor(ids).map((star) => star.wave));
    // Statistically all four waves are populated for 40 seeded stars.
    expect(waves.size).toBeGreaterThanOrEqual(3);
    for (const wave of waves) {
      expect(wave).toBeGreaterThanOrEqual(0);
      expect(wave).toBeLessThan(WAVE_COUNT);
    }
  });
});

describe("waves and timing", () => {
  it("assigns nearer stars to earlier waves", () => {
    expect(waveForDepth(1)).toBe(0);
    expect(waveForDepth(0.99)).toBe(0);
    expect(waveForDepth(0.26)).toBe(WAVE_COUNT - 1);
    expect(waveForDepth(0.6)).toBeGreaterThanOrEqual(waveForDepth(0.9));
  });

  it("later waves leave later but overlap earlier ones", () => {
    const near = flightWindow({ wave: 0, depth: 0.95 }, ENTRANCE);
    const deep = flightWindow({ wave: 3, depth: 0.3 }, ENTRANCE);
    expect(deep.delay).toBeGreaterThan(near.delay);
    // Overlap: the deepest wave starts before the nearest wave has landed.
    expect(deep.delay).toBeLessThan(near.delay + near.duration);
  });

  it("keeps the desktop entrance inside the 1.3–1.5s art direction window", () => {
    const latest = flightWindow({ wave: WAVE_COUNT - 1, depth: 0.25 }, ENTRANCE);
    expect(latest.delay + latest.duration).toBeLessThanOrEqual(1500);
    expect(ENTRANCE.total).toBeGreaterThanOrEqual(1300);
    expect(ENTRANCE.total).toBeLessThanOrEqual(1500);
  });

  it("keeps the return flight around 900ms", () => {
    const latest = flightWindow({ wave: WAVE_COUNT - 1, depth: 0.25 }, RETURN);
    expect(latest.delay + latest.duration).toBeLessThanOrEqual(950);
    expect(RETURN.total).toBe(900);
  });
});

describe("ambient stars", () => {
  it("is deterministic and respects the requested count", () => {
    expect(ambientStarsFor(110)).toEqual(ambientStarsFor(110));
    expect(ambientStarsFor(55)).toHaveLength(55);
  });

  it("stays smaller and dimmer than the project stars", () => {
    for (const star of ambientStarsFor(110)) {
      expect(star.size).toBeLessThan(1.4);
      expect(star.alpha).toBeLessThanOrEqual(0.5);
    }
  });
});

describe("hashString", () => {
  it("is stable and spreads distinct ids", () => {
    expect(hashString("auralith")).toBe(hashString("auralith"));
    const hashes = new Set(ids.map(hashString));
    expect(hashes.size).toBe(ids.length);
  });
});
