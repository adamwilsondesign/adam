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

/** Half-filled disc — theme toggle. */
export function ThemeIcon({ size = 20 }: IconProps) {
  return (
    <svg {...iconAttributes(size)}>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 3a7 7 0 0 1 0 14z" fill="currentColor" stroke="none" />
    </svg>
  );
}
