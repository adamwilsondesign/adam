/**
 * The "nothing to see here" doorway: an arched opening onto a starry void,
 * its door swung open, with steps leading down and away.
 *
 * A black & white redraw of the reference illustration, built from theme
 * tokens so it produces the two required variants by itself: ink-on-canvas
 * in light mode, canvas-on-carbon in dark mode. currentColor carries the
 * ink; `var(--color-bg)` carries the field.
 */

type DoorIllustrationProps = {
  size?: number;
};

export function DoorIllustration({ size = 220 }: DoorIllustrationProps) {
  const sparkle = (x: number, y: number, r: number) =>
    `M ${x} ${y - r} ` +
    `Q ${x + r * 0.22} ${y - r * 0.22} ${x + r} ${y} ` +
    `Q ${x + r * 0.22} ${y + r * 0.22} ${x} ${y + r} ` +
    `Q ${x - r * 0.22} ${y + r * 0.22} ${x - r} ${y} ` +
    `Q ${x - r * 0.22} ${y - r * 0.22} ${x} ${y - r} Z`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      aria-hidden
      style={{ color: "var(--color-fg)", display: "block" }}
    >
      {/* Open door panel, swung out to the left of the frame. */}
      <path
        d="M 66 78 Q 66 44 84 40 L 84 128 L 66 132 Z"
        fill="var(--color-bg)"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      {/* The doorway: an arch onto the void. */}
      <path
        d="M 84 132 L 84 70 Q 84 38 112 38 Q 140 38 140 70 L 140 132 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      {/* Stars inside the void. */}
      <path d={sparkle(112, 62, 6)} fill="var(--color-bg)" />
      <path d={sparkle(130, 58, 4)} fill="var(--color-bg)" />
      <path d={sparkle(104, 88, 4.5)} fill="var(--color-bg)" />
      <path d={sparkle(122, 96, 5.5)} fill="var(--color-bg)" />
      <path d={sparkle(112, 118, 4)} fill="var(--color-bg)" />
      {/* Threshold under the doorway. */}
      <path
        d="M 84 132 L 140 132 L 140 144 L 84 144 Z"
        fill="var(--color-bg)"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      {/* Steps descending away to the left. */}
      <path
        d="M 70 144 L 132 144 L 132 158 L 70 158 Z"
        fill="var(--color-bg)"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path
        d="M 56 158 L 118 158 L 118 172 L 56 172 Z"
        fill="var(--color-bg)"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path
        d="M 42 172 L 104 172 L 104 186 L 42 186 Z"
        fill="var(--color-bg)"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
