import { ogCard, OG_SIZE } from "@/lib/seo/ogCard";

// R1 W7.8 (META-001). This page's own preview card, not the sitewide one.
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Discover SB, neighborhood and theme guides";

export default function Image() {
  return ogCard({
    eyebrow: "Discover SB",
    title: "Neighborhood and theme guides",
    line: "The Funk Zone, State Street and more, with what's on in each.",
  });
}
