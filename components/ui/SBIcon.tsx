// Inline-SVG icon set. All icons are aria-hidden="true" — the label on the
// wrapping interactive element carries the accessible name.

export type IconName =
  | "heart"
  | "share"
  | "sparkle"
  | "pin"
  | "sliders"
  | "sun"
  | "reset"
  | "chevron";

const PATHS: Record<IconName, React.ReactNode> = {
  heart: (
    <path d="M12 21s-7-4.5-9.5-8.5C.5 8.5 3 5 6.5 5 9 5 12 8 12 8s3-3 5.5-3C21 5 23.5 8.5 21.5 12.5 19 16.5 12 21 12 21Z" />
  ),
  share: <path d="M7 17 17 7M17 7H9M17 7v8" />,
  sparkle: (
    <path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6L12 3Z" />
  ),
  pin: (
    <>
      <path d="M12 21c4-4.5 7-7.6 7-11a7 7 0 1 0-14 0c0 3.4 3 6.5 7 11Z" />
      <circle cx="12" cy="10" r="2.4" />
    </>
  ),
  sliders: <path d="M4 6h16M7 12h10M10 18h4" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
    </>
  ),
  reset: <path d="M3 12a9 9 0 1 0 2.6-6.4M3 4v4h4" />,
  chevron: <path d="M9 6l6 6-6 6" />,
};

export function SBIcon({
  name,
  size = 20,
  strokeWidth = 1.8,
  className,
  fill,
  stroke,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  fill?: string;
  stroke?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ?? "none"}
      stroke={stroke ?? "currentColor"}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}
