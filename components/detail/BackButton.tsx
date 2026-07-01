"use client";

import { useRouter } from "next/navigation";

export function BackButton({ fallbackLabel = "Back" }: { fallbackLabel?: string }) {
  const router = useRouter();
  return (
    <div className="sbd-backrow">
      <button
        type="button"
        className="sbd-backrow__btn"
        onClick={() => router.back()}
      >
        ‹ {fallbackLabel}
      </button>
    </div>
  );
}
