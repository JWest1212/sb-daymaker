import { ogCard, OG_SIZE } from "@/lib/seo/ogCard";

// R1 W7.8 (META-001). The homepage's card. It has to live in this segment, next
// to the homepage itself: the homepage now writes its own openGraph block, and
// Next merges metadata shallowly, so that block replaced the layout's and took
// the root image with it. Pages below with a card of their own keep theirs.
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "SB Daymaker, what's worth doing in Santa Barbara today";

export default function Image() {
  return ogCard({
    eyebrow: "Santa Barbara, daily",
    title: "What's worth doing today",
    line: "Find it, save it, share it. Refreshed every day by a local.",
  });
}
