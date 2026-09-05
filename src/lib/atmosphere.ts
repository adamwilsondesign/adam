/**
 * "Mineral Nocturne" — the site's single atmospheric grade.
 *
 * Every environmental surface (Vanta clouds, the star canvas, the About
 * terrain and scene, the surreal orb, the portal, CSS washes) reads its
 * colors from here, so the night grades as one photograph: near-monochrome
 * with warm limestone light and cool slate shadows, deep blacks that keep shadow
 * detail, diffused silver moonlight rather than blue game lighting, warm
 * graphite clouds against cooler slate mountains.
 */

export const ATMOS = {
  /** The absolute floor — page background, deepest shadow. */
  deepBackground: "#080a0c",
  /** Desaturated slate open sky. */
  sky: "#171c22",
  /** Warm graphite cloud body. */
  cloud: "#61605c",
  /** Cloud shadow / underside. */
  cloudShadow: "#171a20",
  /** Mountain slate (cool against the warm clouds). */
  mountainSlate: "#303840",
  /** Horizon haze — where distance dissolves. */
  horizonHaze: "#646c70",
  /** Diffused lunar silver: the one motivated light. */
  lunarSilver: "#c7c3b7",
  /** Warm atmospheric accent (umber) — glare, embers, the portal's warmth. */
  warmAccent: "#aaa08e",
  /** Primary warm white — stars, type-adjacent light. */
  warmWhite: "#e8e3d9",
  /** Muted silver — mist, secondary light. */
  mutedSilver: "#a5aaa8",
} as const;

/**
 * The single motivated light: the unseen moon, low off-canvas to the upper
 * right (x right, y up, z toward the viewer). Clouds, mountains, the orb and
 * the portal all key their lighting to this direction.
 */
export const MOON_DIRECTION = (() => {
  const v = [0.72, 0.3, -0.22];
  const length = Math.hypot(v[0]!, v[1]!, v[2]!);
  return { x: v[0]! / length, y: v[1]! / length, z: v[2]! / length } as const;
})();

export function hexToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.replace("#", ""), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** The same palette as WebGL-friendly numbers for the Vanta cloud config. */
export const VANTA_NIGHT = {
  backgroundColor: 0x080a0c,
  skyColor: 0x171c22,
  cloudColor: 0x61605c,
  cloudShadowColor: 0x171a20,
  sunColor: 0xaaa08e,
  sunGlareColor: 0x77766f,
  sunlightColor: 0xaaa89d,
} as const;
