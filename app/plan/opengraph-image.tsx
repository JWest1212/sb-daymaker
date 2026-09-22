import { ogCard, OG_SIZE } from "@/lib/seo/ogCard";

// R1 W7.8 (META-001). This page's own preview card, not the sitewide one.
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Build your Santa Barbara day with SB Daymaker";

export default function Image() {
  return ogCard({
    eyebrow: "Build a day",
    title: "Your Santa Barbara day",
    line: "Clustered stops, real hours, meals, and a link to share.",
  });
}
