import { ogCard, OG_SIZE } from "@/lib/seo/ogCard";

// R1 W7.8 (META-001). This page's own preview card, not the sitewide one.
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "A friend's picks from SB Daymaker";

export default function Image() {
  return ogCard({
    eyebrow: "Shared with you",
    title: "A friend's Santa Barbara picks",
    line: "What's worth doing in Santa Barbara, from SB Daymaker.",
  });
}
