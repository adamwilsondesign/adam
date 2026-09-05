import { useId } from "react";

/**
 * The zero-result portal: a tall monolithic aperture standing in an empty
 * dark plane, the site's distant eclipse orb aligned perfectly through the
 * opening. Solid atmospheric shapes in the oxidized-nocturne grade — matte
 * charcoal mineral, a long moon-cast ground shadow, fog drifting through the
 * threshold, and a slightly different exposure inside the opening so the
 * space beyond reads as physically impossible. No door, no arch, no steps.
 *
 * On hover/focus the light through the aperture deepens (see
 * EmptyState.module.css targeting [data-aperture-glow]); nothing jumps.
 */

type DoorIllustrationProps = {
  size?: number;
};

export function DoorIllustration({ size = 220 }: DoorIllustrationProps) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      aria-hidden
      style={{ display: "block" }}
    >
      <defs>
        {/* Matte mineral slab, lit faintly from the upper right. */}
        <linearGradient id={`${id}-portal-slab`} x1="0" y1="0" x2="0.25" y2="1">
          <stop offset="0" stopColor="#85857c" />
          <stop offset="0.55" stopColor="#484d50" />
          <stop offset="1" stopColor="#171d23" />
        </linearGradient>
        {/* The impossible interior: a touch more exposure than the night. */}
        <linearGradient id={`${id}-portal-inside`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7d898f" />
          <stop offset="0.45" stopColor="#525f68" />
          <stop offset="1" stopColor="#bac0ba" />
        </linearGradient>
        {/* The recurring orb: matte body, asymmetric silver rim. */}
        <radialGradient id={`${id}-portal-orb-body`} cx="0.42" cy="0.38" r="0.75">
          <stop offset="0" stopColor="#aaaba0" />
          <stop offset="0.6" stopColor="#171d23" />
          <stop offset="1" stopColor="#202932" />
        </radialGradient>
        <radialGradient id={`${id}-portal-orb-rim`} cx="0.68" cy="0.26" r="0.85">
          <stop offset="0.55" stopColor="#d2ccbd" stopOpacity="0" />
          <stop offset="0.82" stopColor="#d2ccbd" stopOpacity="0.55" />
          <stop offset="0.97" stopColor="#d2ccbd" stopOpacity="0.08" />
          <stop offset="1" stopColor="#d2ccbd" stopOpacity="0" />
        </radialGradient>
        {/* Hover: light gathering deep in the opening. */}
        <radialGradient id={`${id}-portal-glow`} cx="0.5" cy="0.42" r="0.8">
          <stop offset="0" stopColor="#d2ccbd" stopOpacity="0.3" />
          <stop offset="0.5" stopColor="#c0b7a4" stopOpacity="0.12" />
          <stop offset="1" stopColor="#c0b7a4" stopOpacity="0" />
        </radialGradient>
        {/* The long ground shadow, cast away from the off-canvas moon. */}
        <linearGradient id={`${id}-portal-shadow`} x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#020403" stopOpacity="0.6" />
          <stop offset="1" stopColor="#020403" stopOpacity="0" />
        </linearGradient>
        {/* Ground plane falloff. */}
        <linearGradient id={`${id}-portal-ground`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a434b" stopOpacity="0.9" />
          <stop offset="1" stopColor="#020403" stopOpacity="0" />
        </linearGradient>
        <filter id={`${id}-portal-fog`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        {/* Static mineral grain, consistent with the global grade. */}
        <filter id={`${id}-portal-grain`}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves="2"
            seed="11"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.05" intercept="0" />
          </feComponentTransfer>
          <feComposite operator="in" in2="SourceGraphic" />
        </filter>
        <clipPath id={`${id}-portal-aperture-clip`}>
          <rect x="85" y="40" width="30" height="118" />
        </clipPath>
      </defs>

      {/* The empty dark plane. */}
      <rect x="0" y="158" width="200" height="42" fill={`url(#${id}-portal-ground)`} />

      {/* Long directional shadow toward the lower left. */}
      <polygon points="78,158 122,158 66,178 -12,178" fill={`url(#${id}-portal-shadow)`} />

      {/* The monolith. */}
      <rect x="74" y="28" width="52" height="130" fill={`url(#${id}-portal-slab)`} />
      {/* Moon-side edge: one restrained silver line. */}
      <rect x="125" y="28" width="1.2" height="130" fill="#d2ccbd" opacity="0.28" />
      {/* Mineral grain on the slab only. */}
      <rect
        x="74"
        y="28"
        width="52"
        height="130"
        filter={`url(#${id}-portal-grain)`}
        opacity="0.9"
      />

      {/* The aperture: a taller exposure of somewhere else. */}
      <rect x="85" y="40" width="30" height="118" fill={`url(#${id}-portal-inside)`} />

      <path d="M74 28 L82 24 H134 L126 28 Z" fill="#b1afa1" opacity="0.65" />
      <path d="M126 28 L134 24 V152 L126 158 Z" fill="#555b5c" />
      <g clipPath={`url(#${id}-portal-aperture-clip)`}>
        {/* Deepening light on hover/focus — driven by EmptyState's CSS. */}
        <rect
          x="85"
          y="40"
          width="30"
          height="118"
          fill={`url(#${id}-portal-glow)`}
          opacity="0"
          data-aperture-glow
        />
        <path d="M85 123 L93 103 L104 119 L115 98 V158 H85 Z" fill="#657279" />
        <path d="M85 145 L96 122 L110 137 L115 130 V158 H85 Z" fill="#303d46" />
        {/* The orb, perfectly aligned through the opening. */}
        <circle cx="100" cy="74" r="11" fill={`url(#${id}-portal-orb-body)`} />
        <circle cx="100" cy="74" r="11" fill={`url(#${id}-portal-orb-rim)`} />
      </g>

      {/* Fog drifting through the threshold — inside to out. */}
      <g filter={`url(#${id}-portal-fog)`} opacity="0.6">
        <ellipse cx="97" cy="132" rx="26" ry="6" fill="#999991" opacity="0.38" />
        <ellipse cx="112" cy="147" rx="30" ry="5" fill="#999991" opacity="0.24" />
        <ellipse cx="86" cy="155" rx="22" ry="4.5" fill="#999991" opacity="0.18" />
      </g>
    </svg>
  );
}
