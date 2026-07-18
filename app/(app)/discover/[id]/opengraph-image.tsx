import { ImageResponse } from "next/og";
import { getGuideBySlugOrId, shortGuideTitle } from "@/lib/guides";

// Gate 2 · G2.4, per-guide OG card. Same branded treatment as the per-thing card
// so a shared guide previews as a designed artifact. Brand hexes mirror the
// tokens (ImageResponse can't read CSS vars).

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "SB Daymaker guide";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getGuideBySlugOrId(id);

  if (!result) {
    return new ImageResponse(
      (
        <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#F6F1E7", color: "#C0532E", fontSize: 90, fontWeight: 700 }}>
          SB Daymaker
        </div>
      ),
      { ...size },
    );
  }

  const g = result.guide;
  const eyebrow = `${g.kind === "theme" ? "Theme guide" : "Neighborhood guide"}   ·   Discover SB`;
  const title = shortGuideTitle(g.title);

  return new ImageResponse(
    (
      <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", position: "relative", background: "#F6F1E7" }}>
        {g.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={g.cover_url} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #C0532E, #16586A)" }} />
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(20,15,10,0.2) 0%, rgba(20,15,10,0.85) 100%)" }} />

        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%", padding: 72 }}>
          <div style={{ fontSize: 30, letterSpacing: 2, textTransform: "uppercase", color: "#F6F1E7", opacity: 0.92, marginBottom: 18 }}>
            {eyebrow}
          </div>
          <div style={{ fontSize: title.length > 40 ? 74 : 92, fontWeight: 700, color: "#FCFAF5", lineHeight: 1.05, maxWidth: 1000, display: "flex" }}>
            {title}
          </div>
          {g.kicker ? (
            <div style={{ fontSize: 34, color: "#F6F1E7", opacity: 0.92, marginTop: 20, maxWidth: 940, display: "flex" }}>
              {g.kicker}
            </div>
          ) : null}
          <div style={{ display: "flex", alignItems: "center", marginTop: 34 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#C0532E", display: "flex", alignItems: "center", justifyContent: "center", color: "#FCFAF5", fontSize: 26, fontWeight: 700 }}>
              SB
            </div>
            <div style={{ fontSize: 30, fontWeight: 600, color: "#F6F1E7", marginLeft: 18, letterSpacing: 1 }}>
              SB Daymaker
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
