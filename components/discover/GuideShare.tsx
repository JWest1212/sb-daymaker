"use client";

// Elevation v1 · Gate 5 · G5.1, Share a guide. Reuses the same native-share
// helper the things + saved list use (no new PII, no account). The shared URL is
// the guide's canonical slug path (Gate 2), so it previews as the guide's OG card
// (app/(app)/discover/[id]/opengraph-image.tsx). No em dash (Golden Rule).

import { useState } from "react";
import { shareUrl } from "@/components/saved/share";
import { SBIcon } from "@/components/ui/SBIcon";
import { trackEvent } from "@/lib/analytics";

export function GuideShare({ path, title }: { path: string; title: string }) {
  const [result, setResult] = useState<"idle" | "copied" | "shared" | "failed">("idle");

  async function onShare() {
    const url = `${window.location.origin}${path}`;
    const r = await shareUrl(url, title);
    trackEvent("share_create", { kind: "guide", count: 1 });
    setResult(r === "copied" ? "copied" : r === "shared" ? "shared" : "failed");
    if (r !== "shared") setTimeout(() => setResult("idle"), 2200);
  }

  const label =
    result === "copied" ? "Link copied"
    : result === "shared" ? "Shared"
    : result === "failed" ? "Try again"
    : "Share this guide";

  return (
    <button type="button" className="sbd-gd-share" onClick={onShare} aria-label={`Share ${title}`}>
      <SBIcon name="share" size={18} strokeWidth={2} />
      <span>{label}</span>
    </button>
  );
}
