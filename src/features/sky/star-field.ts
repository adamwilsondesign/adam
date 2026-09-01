/**
 * The night sky's data model: deterministic star placement and flight timing.
 *
 * Every client owns exactly one "project star". Its position is seeded from
 * the client id alone, so it is identical on the server, after hydration and
 * across re-renders — the star IS the logo, seen from very far away, and that
 * identity must never drift. Ambient stars are seeded from a fixed constant.
 *
 * All coordinates are normalized (0–1 of the viewport); the renderer projects
 * them to pixels and applies depth parallax.
 */

export type ProjectStar = {
  clientId: string;
  /** Normalized sky position. */
  x: number;
  y: number;
  /** 0 = deepest (barely moves, flies last), 1 = nearest (flies first). */
  depth: number;
  /** Point radius in CSS pixels at depth 1. */
  size: number;
  /** Which of the overlapping entrance waves this star belongs to. */
  wave: number;
  /** Twinkle parameters — phase offset and period (seconds); 0 period = steady. */
  twinklePhase: number;
  twinklePeriod: number;
};

export type AmbientStar = {
  x: number;
  y: number;
  depth: number;
  size: number;
  alpha: number;
  twinklePhase: number;
  twinklePeriod: number;
};

/** The homepage headline block (lower-left column) that stars must respect. */
export const HEADLINE_EXCLUSION = { x: 0, y: 0.5, width: 0.66, height: 0.5 } as const;

export const WAVE_COUNT = 4;

/**
 * Entrance choreography (desktop, milliseconds). Waves overlap: the nearest
 * stars leave first, deeper ones follow almost immediately.
 */
export const ENTRANCE = {
  total: 1450,
  waveDelays: [150, 260, 380, 520],
  travel: 900,
  /** Portion of a star's travel spent on the forward depth run. */
  depthPortion: 0.58,
} as const;

/** Mobile entrance: same shape, compressed. */
export const ENTRANCE_MOBILE = {
  total: 1050,
  waveDelays: [90, 170, 260, 360],
  travel: 660,
  depthPortion: 0.58,
} as const;

/** The return home: shorter, one breath out. */
export const RETURN = {
  total: 900,
  contract: 240,
  waveDelays: [0, 60, 120, 180],
  travel: 620,
} as const;

/** FNV-1a — a stable 32-bit hash of the client id. */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Deterministic PRNG (mulberry32), matching the Work shuffle's generator. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function insideExclusion(x: number, y: number): boolean {
  return (
    x >= HEADLINE_EXCLUSION.x &&
    x <= HEADLINE_EXCLUSION.x + HEADLINE_EXCLUSION.width &&
    y >= HEADLINE_EXCLUSION.y &&
    y <= HEADLINE_EXCLUSION.y + HEADLINE_EXCLUSION.height
  );
}

/** The floor of the seeded depth range (see starForClient). */
export const DEPTH_MIN = 0.25;

export function waveForDepth(depth: number): number {
  // Nearest stars (depth → 1) are wave 0; deepest are the last wave. The
  // quantizer spans the actual seeded depth range so all waves participate.
  const normalized = (1 - depth) / (1 - DEPTH_MIN);
  const wave = Math.floor(normalized * WAVE_COUNT);
  return Math.min(WAVE_COUNT - 1, Math.max(0, wave));
}

/**
 * The one deterministic project star for a client. Placement scatters across
 * the upper sky, rejected out of the headline block; depth, size and twinkle
 * all derive from the same seeded stream.
 */
export function starForClient(clientId: string): ProjectStar {
  const random = seededRandom(hashString(clientId));
  let x = 0.05 + random() * 0.9;
  let y = 0.03 + random() * 0.55;
  for (let attempt = 0; attempt < 8 && insideExclusion(x, y); attempt++) {
    x = 0.05 + random() * 0.9;
    y = 0.03 + random() * 0.55;
  }
  if (insideExclusion(x, y)) {
    // Deterministic last resort: lift the star into the open sky band.
    y = 0.03 + (y % 0.4);
  }
  const depth = DEPTH_MIN + random() * (1 - DEPTH_MIN);
  // Roughly 40% of project stars breathe; the rest hold steady.
  const twinkles = random() < 0.4;
  return {
    clientId,
    x,
    y,
    depth,
    size: 1.1 + random() * 1.1,
    wave: waveForDepth(depth),
    twinklePhase: random() * Math.PI * 2,
    twinklePeriod: twinkles ? 3.5 + random() * 4 : 0,
  };
}

export function projectStarsFor(clientIds: readonly string[]): ProjectStar[] {
  return clientIds.map((id) => starForClient(id));
}

const AMBIENT_SEED = 0x5eed5;

/** The restrained ambient field: smaller, dimmer, spread over the whole sky. */
export function ambientStarsFor(count: number): AmbientStar[] {
  const random = seededRandom(AMBIENT_SEED);
  const stars: AmbientStar[] = [];
  for (let i = 0; i < count; i++) {
    const x = random();
    const y = random() * 0.86;
    const depth = 0.1 + random() * 0.8;
    const twinkles = random() < 0.25;
    stars.push({
      x,
      y,
      depth,
      size: 0.4 + random() * 0.9,
      // Keep faint stars near the headline effectively invisible.
      alpha: (0.16 + random() * 0.3) * (insideExclusion(x, y) ? 0.45 : 1),
      twinklePhase: random() * Math.PI * 2,
      twinklePeriod: twinkles ? 4 + random() * 5 : 0,
    });
  }
  return stars;
}

/** Per-star flight schedule: when it leaves and how long it travels. */
export function flightWindow(
  star: Pick<ProjectStar, "wave" | "depth">,
  timing: { waveDelays: readonly number[]; travel: number },
): { delay: number; duration: number } {
  const waveDelay = timing.waveDelays[star.wave] ?? 0;
  // Slight in-wave spread from depth so members of a wave don't move as one.
  const spread = (1 - star.depth) * 90;
  return { delay: waveDelay + spread, duration: timing.travel };
}
