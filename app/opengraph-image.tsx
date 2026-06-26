import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "SB Daymaker — find what's worth doing in Santa Barbara, daily";

export default function OpengraphImage() {
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
        <div style={{ fontSize: 38, letterSpacing: 8, textTransform: "uppercase", color: "#16586A" }}>
          Santa Barbara, daily
        </div>
        <div style={{ fontSize: 110, fontWeight: 700, color: "#C0532E", marginTop: 8 }}>
          SB Daymaker
        </div>
        <div style={{ fontSize: 40, color: "#4A4038", marginTop: 28, maxWidth: 920, lineHeight: 1.3 }}>
          Find what&rsquo;s worth doing — find it, save it, share it.
        </div>
      </div>
    ),
    { ...size },
  );
}
