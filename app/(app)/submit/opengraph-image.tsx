import { ogCard, OG_SIZE } from "@/lib/seo/ogCard";

// R1 W7.8 (META-001). This page's own preview card, not the sitewide one.
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Suggest an event or business to SB Daymaker";

export default function Image() {
  return ogCard({
    eyebrow: "Know something good?",
    title: "Suggest an event or business",
    line: "Know something worth doing? Add it here.",
  });
}
