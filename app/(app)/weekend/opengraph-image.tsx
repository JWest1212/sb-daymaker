import { ogCard, OG_SIZE } from "@/lib/seo/ogCard";

// R1 W7.8 (META-001). This page's own preview card, not the sitewide one.
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Things to do in Santa Barbara this weekend";

export default function Image() {
  return ogCard({
    eyebrow: "This weekend",
    title: "Santa Barbara this weekend",
    line: "Events, live music, markets and outings worth your time.",
  });
}
