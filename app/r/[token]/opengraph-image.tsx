import { ogCard, OG_SIZE } from "@/lib/seo/ogCard";

// R1 W7.8 (META-001). This page's own preview card, not the sitewide one.
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Restore your SB Daymaker saves";

export default function Image() {
  return ogCard({
    eyebrow: "Restore",
    title: "Bring your saves back",
    line: "Your SB Daymaker list, on this device.",
  });
}
