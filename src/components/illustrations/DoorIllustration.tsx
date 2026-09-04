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
        <linearGradient id="portal-slab" x1="0" y1="0" x2="0.25" y2="1">
          <stop offset="0" stopColor="#1d211f" />
          <stop offset="0.55" stopColor="#121615" />
          <stop offset="1" stopColor="#0a0d0c" />
        </linearGradient>
        {/* The impossible interior: a touch more exposure than the night. */}
        <linearGradient id="portal-inside" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a2622" />
          <stop offset="0.45" stopColor="#0e1a17" />
          <stop offset="1" stopColor="#050a08" />
        </linearGradient>
        {/* The recurring orb: matte body, asymmetric silver rim. */}
        <radialGradient id="portal-orb-body" cx="0.42" cy="0.38" r="0.75">
          <stop offset="0" stopColor="#111514" />
          <stop offset="0.6" stopColor="#0a0d0c" />
          <stop offset="1" stopColor="#060807" />
        </radialGradient>
        <radialGradient id="portal-orb-rim" cx="0.68" cy="0.26" r="0.85">
          <stop offset="0.55" stopColor="#969e9a" stopOpacity="0" />
          <stop offset="0.82" stopColor="#969e9a" stopOpacity="0.55" />
          <stop offset="0.97" stopColor="#969e9a" stopOpacity="0.08" />
          <stop offset="1" stopColor="#969e9a" stopOpacity="0" />
        </radialGradient>
        {/* Hover: light gathering deep in the opening. */}
        <radialGradient id="portal-glow" cx="0.5" cy="0.42" r="0.8">
          <stop offset="0" stopColor="#969e9a" stopOpacity="0.3" />
          <stop offset="0.5" stopColor="#6f5947" stopOpacity="0.12" />
          <stop offset="1" stopColor="#6f5947" stopOpacity="0" />
        </radialGradient>
        {/* The long ground shadow, cast away from the off-canvas moon. */}
        <linearGradient id="portal-shadow" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#020403" stopOpacity="0.6" />
          <stop offset="1" stopColor="#020403" stopOpacity="0" />
        </linearGradient>
        {/* Ground plane falloff. */}
        <linearGradient id="portal-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0c100f" stopOpacity="0.9" />
          <stop offset="1" stopColor="#020403" stopOpacity="0" />
        </linearGradient>
        <filter id="portal-fog" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        {/* Static mineral grain, consistent with the global grade. */}
        <filter id="portal-grain">
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
        <clipPath id="portal-aperture-clip">
          <rect x="85" y="40" width="30" height="118" />
        </clipPath>
      </defs>

      {/* The empty dark plane. */}
      <rect x="0" y="158" width="200" height="42" fill="url(#portal-ground)" />

      {/* Long directional shadow toward the lower left. */}
      <polygon points="78,158 122,158 66,178 -12,178" fill="url(#portal-shadow)" />

      {/* The monolith. */}
      <rect x="74" y="28" width="52" height="130" fill="url(#portal-slab)" />
      {/* Moon-side edge: one restrained silver line. */}
      <rect x="125" y="28" width="1.2" height="130" fill="#969e9a" opacity="0.28" />
      {/* Mineral grain on the slab only. */}
      <rect x="74" y="28" width="52" height="130" filter="url(#portal-grain)" opacity="0.9" />

      {/* The aperture: a taller exposure of somewhere else. */}
      <rect x="85" y="40" width="30" height="118" fill="url(#portal-inside)" />

      <g clipPath="url(#portal-aperture-clip)">
        {/* Deepening light on hover/focus — driven by EmptyState's CSS. */}
        <rect
          x="85"
          y="40"
          width="30"
          height="118"
          fill="url(#portal-glow)"
          opacity="0"
          data-aperture-glow
        />
        {/* The orb, perfectly aligned through the opening. */}
        <circle cx="100" cy="74" r="11" fill="url(#portal-orb-body)" />
        <circle cx="100" cy="74" r="11" fill="url(#portal-orb-rim)" />
      </g>

      {/* Fog drifting through the threshold — inside to out. */}
      <g filter="url(#portal-fog)" opacity="0.6">
        <ellipse cx="97" cy="132" rx="26" ry="6" fill="#999991" opacity="0.14" />
        <ellipse cx="112" cy="147" rx="30" ry="5" fill="#999991" opacity="0.1" />
        <ellipse cx="86" cy="155" rx="22" ry="4.5" fill="#999991" opacity="0.08" />
      </g>
    </svg>
  );
}
