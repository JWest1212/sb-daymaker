import { ogCard, OG_SIZE } from "@/lib/seo/ogCard";

// R1 W7.8 (META-001). This page's own preview card, not the sitewide one.
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Discover SB, local walking guides";

export default function Image() {
  return ogCard({
    eyebrow: "Discover SB",
    title: "Local walking guides",
    line: "The Funk Zone and State Street, with what's on along each.",
  });
}
