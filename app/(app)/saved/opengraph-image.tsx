import { ogCard, OG_SIZE } from "@/lib/seo/ogCard";

// R1 W7.8 (META-001). This page's own preview card, not the sitewide one.
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Your saved list on SB Daymaker";

export default function Image() {
  return ogCard({
    eyebrow: "Santa Barbara, on your phone",
    title: "Your saved list",
    line: "Save what you want to do, mark what you did, share a list.",
  });
}
