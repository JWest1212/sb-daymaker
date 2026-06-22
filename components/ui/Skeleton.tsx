import type { CSSProperties } from "react";

type SkeletonVariant = "line" | "block" | "circle";

/** Grey shimmer placeholder. Shimmer halts under prefers-reduced-motion. */
export function Skeleton({
  variant = "line",
  width,
  height,
  className = "",
  style,
}: {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
  className?: string;
  style?: CSSProperties;
}) {
  const cls = ["sbd-skel", `sbd-skel--${variant}`, className]
    .filter(Boolean)
    .join(" ");
  return <span className={cls} style={{ width, height, ...style }} aria-hidden="true" />;
}

/** A card-shaped loading placeholder (media banner + a few text lines). */
export function SkeletonCard() {
  return (
    <div className="sbd-card" aria-hidden="true">
      <Skeleton variant="block" height={140} style={{ borderRadius: 0 }} />
      <div style={{ padding: "var(--space-4) var(--space-5)" }}>
        <Skeleton variant="line" width="70%" height={20} />
        <div style={{ height: "var(--space-3)" }} />
        <Skeleton variant="line" width="100%" />
        <div style={{ height: "var(--space-2)" }} />
        <Skeleton variant="line" width="85%" />
      </div>
    </div>
  );
}
