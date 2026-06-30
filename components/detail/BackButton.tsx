"use client";

import { useRouter } from "next/navigation";

export function BackButton({ fallbackLabel = "Back" }: { fallbackLabel?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="sbd-backlink"
      onClick={() => router.back()}
    >
      ‹ {fallbackLabel}
    </button>
  );
}
