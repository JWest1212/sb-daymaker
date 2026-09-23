import { ImageResponse } from "next/og";

/**
 * R1 W7.8 (META-001). The per-page preview card.
 *
 * Every route without an image of its own used to fall through to the single
 * sitewide card, so a shared Saved list, a Discover link and the Submit form all
 * previewed identically. Each route now has a colocated `opengraph-image.tsx`
 * that calls this with its own words. Same design as the root card.
 *
 * Brand hexes are written out because ImageResponse (satori) cannot read CSS
 * tokens; they mirror sbdaymaker_tokens.css (Plaster #F6F1E7, Pacific #16586A,
 * Terracotta #C0532E, Ink-2 #4A4038). No em dash anywhere.
 */
export const OG_SIZE = { width: 1200, height: 630 };

export function ogCard({ eyebrow, title, line }: { eyebrow: string; title: string; line: string }) {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#F6F1E7",
        }}
      >
        <div style={{ fontSize: 34, letterSpacing: 7, textTransform: "uppercase", color: "#16586A" }}>{eyebrow}</div>
        <div style={{ fontSize: title.length > 28 ? 84 : 104, fontWeight: 700, color: "#C0532E", marginTop: 10, lineHeight: 1.05, maxWidth: 1040 }}>
          {title}
        </div>
        <div style={{ fontSize: 38, color: "#4A4038", marginTop: 28, maxWidth: 960, lineHeight: 1.3 }}>{line}</div>
        <div style={{ fontSize: 30, color: "#16586A", marginTop: 44, fontWeight: 700 }}>SB Daymaker</div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
