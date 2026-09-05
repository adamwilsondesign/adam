/** One achromatic grade: silver light, graphite rock, luminous distant mist. */

export const ATMOS = {
  /** The absolute floor — page background, deepest shadow. */
  deepBackground: "#080808",
  /** Desaturated slate open sky. */
  sky: "#171717",
  /** Warm graphite cloud body. */
  cloud: "#616161",
  /** Cloud shadow / underside. */
  cloudShadow: "#171717",
  /** Mountain slate (cool against the warm clouds). */
  mountainSlate: "#383838",
  /** Horizon haze — where distance dissolves. */
  horizonHaze: "#707070",
  /** Diffused lunar silver: the one motivated light. */
  lunarSilver: "#c7c7c7",
  /** Warm atmospheric accent (umber) — glare, embers, the portal's warmth. */
  warmAccent: "#aaaaaa",
  /** Primary warm white — stars, type-adjacent light. */
  warmWhite: "#e8e8e8",
  /** Muted silver — mist, secondary light. */
  mutedSilver: "#aaaaaa",
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
  backgroundColor: 0x080808,
  skyColor: 0x171717,
  cloudColor: 0x616161,
  cloudShadowColor: 0x171717,
  sunColor: 0xaaaaaa,
  sunGlareColor: 0x777777,
  sunlightColor: 0xaaaaaa,
} as const;
