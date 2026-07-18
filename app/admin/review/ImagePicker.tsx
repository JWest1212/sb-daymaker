"use client";

import type { PhotoOption } from "@/lib/review";

const SOURCE_CLASS: Record<string, string> = {
  google: "places", pexels: "soho", wikimedia: "places", owned: "tm", placeholder: "placeholder",
};

/** Edit-mode image slot: arrow through pre-fetched alternates (no network per
 *  arrow). Empty until photo_options is filled, then it shows a one-tap
 *  "Try fetching a photo" that hits the real, cost-incurring image-fetch route
 *  (Wikimedia free, Google Places billed, see lib/images budget; Pexels
 *  retired Phase 3 §6.2). */
export function ImagePicker({
  options, index, onCycle, onTryFetch, fetching,
}: {
  options: PhotoOption[];
  index: number;
  onCycle: (dir: "prev" | "next") => void;
  onTryFetch: () => void;
  fetching: boolean;
}) {
  const has = options.length > 0;
  const opt = has ? options[index] : { url: "", source: "placeholder" as const };
  const cls = SOURCE_CLASS[opt.source] ?? "placeholder";
  return (
    <div className={`thumb ${opt.url ? "" : "placeholder"} ${cls}`}>
      {opt.url ? <img src={opt.url} alt="" className="thumb-img" /> : null}
      <span className="src-pill">{has ? opt.source : "no image yet"}</span>
      {has ? (
        <>
          <button className="imgnav prev" aria-label="Previous image option" onClick={() => onCycle("prev")}>‹</button>
          <button className="imgnav next" aria-label="Next image option" onClick={() => onCycle("next")}>›</button>
          <span className="imgcount" aria-hidden>{index + 1}/{options.length}</span>
        </>
      ) : (
        <button className="tryfetch" onClick={onTryFetch} disabled={fetching}>
          {fetching ? "Fetching…" : "Try fetching a photo"}
        </button>
      )}
    </div>
  );
}
