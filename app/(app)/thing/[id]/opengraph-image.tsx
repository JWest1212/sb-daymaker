import { ImageResponse } from "next/og";
import { getThingBySlugOrId } from "@/lib/things";
import { ZONE_LABEL } from "@/lib/zones";

// Elevation v1 · Gate 2 · G2.4, per-thing OG card. A shared link previews as a
// designed artifact (title + key line over the thing's photo or a branded motif)
// instead of the generic sitewide card. Brand hexes are hardcoded because
// ImageResponse (satori) can't read CSS tokens; they mirror sbdaymaker_tokens.css
// (Plaster #F6F1E7, Ink #241C16, Pacific #16586A, Terracotta #C0532E, Paper #FCFAF5).

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "SB Daymaker listing";

function pretty(s: string | null): string | null {
  if (!s) return null;
  return s.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getThingBySlugOrId(id);

  if (!t) {
    return new ImageResponse(
      (
        <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#F6F1E7", color: "#C0532E", fontSize: 90, fontWeight: 700 }}>
          SB Daymaker
        </div>
      ),
      { ...size },
    );
  }

  // Image rights: never bake a Google-sourced photo into a cached OG image (ToS +
  // CLAUDE.md no-cache rule). Google photos fall back to the branded motif card;
  // owned/wikimedia/pexels are fine to composite.
  const usePhoto = !!t.photo_url && t.photo_source !== "google";
  const zone = t.nearby_zone ? ZONE_LABEL[t.nearby_zone] : pretty(t.neighborhood);
  const price = t.free ? "Free" : t.price_band;
  const metaLine = [price, pretty(t.happening_category), zone].filter(Boolean).join("   ·   ");

  return new ImageResponse(
    (
      <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", position: "relative", background: "#F6F1E7" }}>
        {usePhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.photo_url as string} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #16586A, #C0532E)" }} />
        )}
        {/* Legibility scrim: dark from the bottom so the title reads over any image. */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(20,15,10,0.15) 0%, rgba(20,15,10,0.85) 100%)" }} />

        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%", padding: 72 }}>
          {metaLine ? (
            <div style={{ fontSize: 30, letterSpacing: 2, textTransform: "uppercase", color: "#F6F1E7", opacity: 0.92, marginBottom: 18 }}>
              {metaLine}
            </div>
          ) : null}
          <div style={{ fontSize: t.title.length > 48 ? 66 : 82, fontWeight: 700, color: "#FCFAF5", lineHeight: 1.05, maxWidth: 1000, display: "flex" }}>
            {t.title}
          </div>
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
