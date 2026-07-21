import { ImageResponse } from "next/og";
import { getSharedState } from "@/lib/shares";
import type { SharedPlanPayload } from "@/lib/plan/types";

// Gate 4 · G4.7, the shared-plan "day card" OG image. A shared /p/[token] link
// previews as a designed artifact (title + the day's itinerary line) rather than
// a bare link. Brand hexes are hardcoded because ImageResponse (satori) cannot
// read CSS tokens; they mirror sbdaymaker_tokens.css (Plaster #F6F1E7, Ink
// #241C16, Pacific #16586A / dark #0E3C49, Terracotta #C0532E, Paper #FCFAF5).
// No em dash anywhere (Golden Rule).

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "A day in Santa Barbara, planned with SB Daymaker";

function brandFallback() {
  return new ImageResponse(
    (
      <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#F6F1E7", color: "#C0532E", fontSize: 90, fontWeight: 700 }}>
        SB Daymaker
      </div>
    ),
    { ...size },
  );
}

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const shared = await getSharedState(token);
  if (!shared || shared.kind !== "shared_plan") return brandFallback();

  const payload = shared.payload as SharedPlanPayload;
  const stops = payload.stops ?? [];
  const stopCount = stops.length;
  // The itinerary mini-line: up to four stop names, meals flagged.
  const mini = stops
    .slice(0, 4)
    .map((s) => (s.meal ? `${s.title} (${s.meal})` : s.title))
    .join("   ·   ");
  const more = stopCount > 4 ? `  +${stopCount - 4} more` : "";

  return new ImageResponse(
    (
      <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", position: "relative", background: "linear-gradient(135deg, #0E3C49, #16586A)" }}>
        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", padding: 72 }}>
          <div style={{ fontSize: 28, letterSpacing: 6, textTransform: "uppercase", color: "#F6F1E7", opacity: 0.82, display: "flex" }}>
            SB Daymaker · A day in Santa Barbara
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: payload.title.length > 40 ? 70 : 88, fontWeight: 700, color: "#FCFAF5", lineHeight: 1.05, maxWidth: 1040, display: "flex" }}>
              {payload.title}
            </div>
            {mini ? (
              <div style={{ fontSize: 30, color: "#F6F1E7", opacity: 0.92, marginTop: 28, maxWidth: 1040, lineHeight: 1.4, display: "flex" }}>
                {mini}{more}
              </div>
            ) : null}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "#C0532E", display: "flex", alignItems: "center", justifyContent: "center", color: "#FCFAF5", fontSize: 28, fontWeight: 700 }}>
                SB
              </div>
              <div style={{ fontSize: 30, fontWeight: 600, color: "#F6F1E7", marginLeft: 18, letterSpacing: 1 }}>
                SB Daymaker
              </div>
            </div>
            <div style={{ fontSize: 26, color: "#F6F1E7", opacity: 0.85, display: "flex" }}>
              {stopCount} {stopCount === 1 ? "stop" : "stops"}, open when it says
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
