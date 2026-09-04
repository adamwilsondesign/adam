/**
 * The night sky's data model: a fixed field of stars in 3D and the single
 * camera that moves through it.
 *
 * Every client owns exactly one "project star" with immutable x, y, z
 * coordinates seeded from the client id alone — identical on the server,
 * after hydration and across re-renders. Nothing in the field ever animates
 * its own position: all apparent movement comes from projecting the fixed
 * points through the camera (forward travel plus a lateral parallax offset),
 * so every star travels a straight radial line from the shared vanishing
 * point and depth alone controls apparent speed and arrival order.
 */

export type ProjectStar = {
  clientId: string;
  /** Normalized rest-screen position (projection at camera zero). */
  x: number;
  y: number;
  /** World depth. Larger is deeper; the camera never passes a star. */
  z: number;
  /** Point radius in CSS pixels at rest. */
  size: number;
  /** Twinkle parameters — phase offset and period (seconds); 0 = steady. */
  twinklePhase: number;
  twinklePeriod: number;
};

export type AmbientStar = {
  x: number;
  y: number;
  z: number;
  size: number;
  alpha: number;
  twinklePhase: number;
  twinklePeriod: number;
};

/** The homepage headline block (lower-left column) that stars must respect. */
export const HEADLINE_EXCLUSION = { x: 0, y: 0.5, width: 0.66, height: 0.5 } as const;

/** The shared vanishing point every radial line passes through. */
export const VANISHING_POINT = { x: 0.5, y: 0.42 } as const;

/**
 * Camera geometry. Project stars live in z ∈ [Z_NEAR, Z_FAR]; the camera
 * advances from 0 to TRAVEL and never reaches Z_NEAR, so no star ever blows
 * up past the lens. Ambient stars sit deeper still and only drift outward.
 */
export const CAMERA = {
  travel: 2.1,
  zNear: 2.25,
  zFar: 4.4,
  ambientNear: 2.8,
  ambientFar: 12,
} as const;

/** The largest expansion a star can reach before the camera stops. */
export function maxExpansion(z: number): number {
  return projectionFactor(z, CAMERA.travel);
}

/**
 * Every star expands at least this much before resolving, so no logo can
 * appear before its point has visibly travelled its radial line. Cells that
 * sit inside a star's rest radius are scored against this same minimum, so
 * the assignment naturally hands central cells to stars near the vanishing
 * point.
 */
export const MIN_EXPANSION = 1.5;

/** Entrance timing (ms, relative to camera start ≈ 250ms after the click):
 *  ~1.9s total from the click, one continuous cinematic run. */
export const ENTRANCE_MS = {
  camera: 1600,
  crossfade: 320,
  settle: 400,
} as const;

/** Mobile entrance: the same camera, slightly quicker. */
export const ENTRANCE_MOBILE_MS = {
  camera: 1300,
  crossfade: 280,
  settle: 360,
} as const;

/** The return home: one reversed camera move (~1.1s). */
export const RETURN_MS = {
  camera: 1100,
  contract: 260,
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
  const z = CAMERA.zNear + random() * (CAMERA.zFar - CAMERA.zNear);
  // Roughly 40% of project stars breathe; the rest hold steady.
  const twinkles = random() < 0.4;
  return {
    clientId,
    x,
    y,
    z,
    size: 1.1 + random() * 1.1,
    twinklePhase: random() * Math.PI * 2,
    twinklePeriod: twinkles ? 3.5 + random() * 4 : 0,
  };
}

export function projectStarsFor(clientIds: readonly string[]): ProjectStar[] {
  return clientIds.map((id) => starForClient(id));
}

const AMBIENT_SEED = 0x5eed5;

/** The restrained ambient field: smaller, dimmer, deeper than every flight. */
export function ambientStarsFor(count: number): AmbientStar[] {
  const random = seededRandom(AMBIENT_SEED);
  const stars: AmbientStar[] = [];
  for (let i = 0; i < count; i++) {
    const x = random();
    const y = random() * 0.86;
    const z = CAMERA.ambientNear + random() * (CAMERA.ambientFar - CAMERA.ambientNear);
    const twinkles = random() < 0.25;
    stars.push({
      x,
      y,
      z,
      size: 0.4 + random() * 0.9,
      // Keep faint stars near the headline effectively invisible.
      alpha: (0.16 + random() * 0.3) * (insideExclusion(x, y) ? 0.45 : 1),
      twinklePhase: random() * Math.PI * 2,
      twinklePeriod: twinkles ? 4 + random() * 5 : 0,
    });
  }
  return stars;
}

// ---------------------------------------------------------------------------
// Perspective projection
// ---------------------------------------------------------------------------

export type Vec = { x: number; y: number };

/**
 * Projection scale for a star at depth z with the camera at cameraZ: the
 * fixed point's screen offset from the vanishing point is its rest offset
 * multiplied by this factor. Monotonic in cameraZ; shallower z grows faster.
 */
export function projectionFactor(z: number, cameraZ: number): number {
  return z / (z - cameraZ);
}

/** The camera position at which a star's projection reaches factor k. */
export function cameraForFactor(z: number, k: number): number {
  return z * (1 - 1 / k);
}

/**
 * Screen position of a fixed star for the current camera. `parallax` is the
 * camera's lateral offset in pixels at depth 1 — divided by depth, so whole
 * depth layers shift together and deeper layers move less. Everything is one
 * camera transform; stars never move individually.
 */
export function projectPoint(rest: Vec, z: number, cameraZ: number, vp: Vec, parallax: Vec): Vec {
  const denom = z - cameraZ;
  const k = z / denom;
  return {
    x: vp.x + (rest.x - vp.x) * k - parallax.x / denom,
    y: vp.y + (rest.y - vp.y) * k - parallax.y / denom,
  };
}

// ---------------------------------------------------------------------------
// Star → grid-cell assignment
// ---------------------------------------------------------------------------

/** Radial ray of a star: origin, unit direction and rest radius (pixels). */
export function starRay(star: Pick<ProjectStar, "clientId" | "x" | "y">, viewport: Vec) {
  const vp = { x: VANISHING_POINT.x * viewport.x, y: VANISHING_POINT.y * viewport.y };
  const rest = { x: star.x * viewport.x, y: star.y * viewport.y };
  let dx = rest.x - vp.x;
  let dy = rest.y - vp.y;
  let r0 = Math.hypot(dx, dy);
  if (r0 < 1) {
    // Degenerate rest-on-vanishing-point: a deterministic outward direction.
    const angle = (hashString(star.clientId) % 360) * (Math.PI / 180);
    dx = Math.cos(angle);
    dy = Math.sin(angle);
    r0 = 1;
  } else {
    dx /= r0;
    dy /= r0;
  }
  return { vp, rest, dir: { x: dx, y: dy }, r0 };
}

/**
 * Deterministic minimum-distance matching between project stars and grid
 * cells. Each star's straight radial line is fixed; the score of a (star,
 * cell) pair is the distance from the cell's center to the nearest point on
 * that ray at or beyond the star's rest radius. Greedy over globally sorted
 * pairs (score, then ids) — stable for identical inputs.
 *
 * Returns the entrance composition: `order[cellIndex] = clientId`.
 */
export function assignEntranceOrder(
  clientIds: readonly string[],
  cellCenters: readonly Vec[],
  viewport: Vec,
): string[] {
  const count = Math.min(clientIds.length, cellCenters.length);
  const pairs: { score: number; id: string; idIndex: number; cell: number }[] = [];
  for (let i = 0; i < count; i++) {
    const id = clientIds[i]!;
    const star = starForClient(id);
    const ray = starRay(star, viewport);
    // The reachable stretch of this star's ray: it must expand at least the
    // minimum, and it cannot pass the point where the camera stops.
    const tMin = ray.r0 * MIN_EXPANSION;
    const tMax = Math.max(tMin, ray.r0 * maxExpansion(star.z));
    for (let cell = 0; cell < count; cell++) {
      const c = cellCenters[cell]!;
      const s = (c.x - ray.vp.x) * ray.dir.x + (c.y - ray.vp.y) * ray.dir.y;
      const t = Math.min(Math.max(s, tMin), tMax);
      const nx = ray.vp.x + ray.dir.x * t;
      const ny = ray.vp.y + ray.dir.y * t;
      pairs.push({ score: Math.hypot(c.x - nx, c.y - ny), id, idIndex: i, cell });
    }
  }
  pairs.sort((a, b) => a.score - b.score || a.id.localeCompare(b.id) || a.cell - b.cell);
  const byCell = new Array<string | null>(count).fill(null);
  const placed = new Set<string>();
  for (const pair of pairs) {
    if (placed.has(pair.id) || byCell[pair.cell] !== null) continue;
    byCell[pair.cell] = pair.id;
    placed.add(pair.id);
    if (placed.size === count) break;
  }
  // Guaranteed complete for equal counts; fill defensively regardless.
  for (let i = count; i < clientIds.length; i++) placed.add(clientIds[i]!);
  const leftovers = clientIds.filter((id) => !placed.has(id));
  return byCell.map((id) => id ?? leftovers.shift() ?? "").filter((id) => id !== "");
}

/**
 * The camera progress (0–1) at which a star's straight radial line carries it
 * to its assigned cell — the moment it resolves into the logo. Depth and the
 * required expansion set arrival order naturally.
 */
export function arrivalProgress(
  star: Pick<ProjectStar, "clientId" | "x" | "y" | "z">,
  cellCenter: Vec,
  viewport: Vec,
): number {
  const ray = starRay(star, viewport);
  const s = (cellCenter.x - ray.vp.x) * ray.dir.x + (cellCenter.y - ray.vp.y) * ray.dir.y;
  // Clamp to what this star can actually reach before the camera stops.
  const k = Math.min(maxExpansion(star.z), Math.max(MIN_EXPANSION, s / ray.r0));
  const cameraZ = cameraForFactor(star.z, k);
  return Math.min(1, Math.max(0.12, cameraZ / CAMERA.travel));
}
