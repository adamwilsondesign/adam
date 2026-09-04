/**
 * "Oxidized Nocturne" — the site's single atmospheric grade.
 *
 * Every environmental surface (Vanta clouds, the star canvas, the About
 * terrain and scene, the surreal orb, the portal, CSS washes) reads its
 * colors from here, so the night grades as one photograph: near-monochrome
 * with faint green and umber undertones, deep blacks that keep shadow
 * detail, diffused silver moonlight rather than blue game lighting, warm
 * graphite clouds against cooler slate mountains.
 */

export const ATMOS = {
  /** The absolute floor — page background, deepest shadow. */
  deepBackground: "#020403",
  /** Green-black open sky. */
  sky: "#07110f",
  /** Warm graphite cloud body. */
  cloud: "#25231f",
  /** Cloud shadow / underside. */
  cloudShadow: "#030405",
  /** Mountain slate (cool against the warm clouds). */
  mountainSlate: "#11191b",
  /** Horizon haze — where distance dissolves. */
  horizonHaze: "#181d1c",
  /** Diffused lunar silver: the one motivated light. */
  lunarSilver: "#969e9a",
  /** Warm atmospheric accent (umber) — glare, embers, the portal's warmth. */
  warmAccent: "#6f5947",
  /** Primary warm white — stars, type-adjacent light. */
  warmWhite: "#e8e3d9",
  /** Muted silver — mist, secondary light. */
  mutedSilver: "#999991",
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
  backgroundColor: 0x020403,
  skyColor: 0x07110f,
  cloudColor: 0x25231f,
  cloudShadowColor: 0x030405,
  sunColor: 0x6f5947,
  sunGlareColor: 0x51402f,
  sunlightColor: 0x5d4a38,
} as const;
