/** Minimal stroke icon set shared across the shell. */

type IconProps = {
  size?: number;
};

function iconAttributes(size: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 20 20",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

export function MenuIcon({ size = 20 }: IconProps) {
  return (
    <svg {...iconAttributes(size)}>
      <path d="M3 7h14M3 13h14" />
    </svg>
  );
}

export function CloseIcon({ size = 20 }: IconProps) {
  return (
    <svg {...iconAttributes(size)}>
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

export function ArrowLeftIcon({ size = 20 }: IconProps) {
  return (
    <svg {...iconAttributes(size)}>
      <path d="M16 10H4M9 5l-5 5 5 5" />
    </svg>
  );
}

export function ArrowUpRightIcon({ size = 16 }: IconProps) {
  return (
    <svg {...iconAttributes(size)}>
      <path d="M6 14L14 6M7 6h7v7" />
    </svg>
  );
}

export function ArrowRightIcon({ size = 20 }: IconProps) {
  return (
    <svg {...iconAttributes(size)}>
      <path d="M17 10H3M11 4l6 6-6 6" />
    </svg>
  );
}

/** LinkedIn mark, drawn in the shared stroke register. */
export function LinkedInIcon({ size = 20 }: IconProps) {
  return (
    <svg {...iconAttributes(size)}>
      <rect x="3" y="3" width="14" height="14" />
      <path d="M6.5 9v4.5M6.5 6.4v.1M9.5 13.5V9m0 1.6c.4-1 1.3-1.6 2.2-1.6 1.2 0 1.8.8 1.8 2.1v2.4" />
    </svg>
  );
}

/** Envelope — the contact control. */
export function MailIcon({ size = 20 }: IconProps) {
  return (
    <svg {...iconAttributes(size)}>
      <rect x="2.5" y="4.5" width="15" height="11" />
      <path d="M3 5.5l7 5.5 7-5.5" />
    </svg>
  );
}

/** Crossing paths — shuffle the grid composition. */
export function ShuffleIcon({ size = 16 }: IconProps) {
  return (
    <svg {...iconAttributes(size)}>
      <path d="M3 6h3l8 8h3M3 14h3l2-2M12 8l2-2h3M14 3l3 3-3 3M14 11l3 3-3 3" />
    </svg>
  );
}

/** Half-filled disc — theme toggle. */
export function ThemeIcon({ size = 20 }: IconProps) {
  return (
    <svg {...iconAttributes(size)}>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 3a7 7 0 0 1 0 14z" fill="currentColor" stroke="none" />
    </svg>
  );
}
