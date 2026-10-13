import { ImageResponse } from "next/og";

export const alt = "Orire — turn the CV you have into the one the role wants";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const LEAF =
  "M32 32 C 31 27 26.5 26 24 23 C 21 19.5 22.5 14.5 27 15 C 29.5 15.3 31 17.3 32 19.5 C 33 17.3 34.5 15.3 37 15 C 41.5 14.5 43 19.5 40 23 C 37.5 26 33 27 32 32 Z";

function Clover({ px }: { px: number }) {
  return (
    <svg width={px} height={px} viewBox="13 13 38 40" fill="none">
      <defs>
        <linearGradient id="g" x1="17" y1="50" x2="47" y2="14" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#17b892" />
          <stop offset="0.55" stopColor="#3ad9b4" />
          <stop offset="1" stopColor="#17b892" />
        </linearGradient>
      </defs>
      <g fill="url(#g)">
        <path d={LEAF} />
        <path d={LEAF} transform="rotate(90 32 32)" />
        <path d={LEAF} transform="rotate(180 32 32)" />
        <path d={LEAF} transform="rotate(270 32 32)" />
      </g>
      <path d="M32 32 C 34 40 37 45 41 49" stroke="url(#g)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 90px",
          color: "#f4f5f8",
          backgroundColor: "#0b0d12",
          backgroundImage:
            "radial-gradient(circle at 12% 18%, rgba(23, 184, 146,0.22), rgba(11,13,18,0) 45%), radial-gradient(circle at 88% 85%, rgba(217, 164, 65,0.18), rgba(11,13,18,0) 45%), radial-gradient(circle at 60% 30%, rgba(58, 217, 180,0.18), rgba(11,13,18,0) 50%)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", width: 640 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <Clover px={104} />
            <div style={{ marginLeft: 22, fontSize: 84, fontWeight: 700, letterSpacing: -2 }}>Orire</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 40, fontSize: 52, fontWeight: 600, lineHeight: 1.15 }}>
            <span>Turn the CV you have into</span>
            <span style={{ color: "#3ad9b4" }}>the one the role wants.</span>
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 40,
              alignSelf: "flex-start",
              padding: "12px 28px",
              borderRadius: 999,
              fontSize: 28,
              fontWeight: 700,
              color: "#0b0d12",
              backgroundImage: "linear-gradient(90deg, #3ad9b4, #17b892)",
            }}
          >
            orire.app
          </div>
        </div>
        <div style={{ display: "flex", position: "relative", width: 330, height: 420 }}>
          <div
            style={{
              position: "absolute",
              left: -60,
              top: 24,
              width: 300,
              height: 380,
              borderRadius: 20,
              backgroundColor: "#171a22",
              border: "1px solid rgba(255,255,255,0.08)",
              transform: "rotate(-6deg)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 20,
              top: 0,
              width: 300,
              height: 380,
              borderRadius: 20,
              backgroundColor: "#ffffff",
              transform: "rotate(4deg)",
              display: "flex",
              flexDirection: "column",
              padding: 28,
            }}
          >
            <div style={{ width: 200, height: 22, borderRadius: 6, backgroundColor: "#1c1d24" }} />
            <div style={{ width: 150, height: 14, borderRadius: 6, backgroundColor: "#4f46e5", marginTop: 14 }} />
            <div style={{ width: 70, height: 5, borderRadius: 3, backgroundImage: "linear-gradient(90deg,#17b892,#3ad9b4)", marginTop: 12 }} />
            <div style={{ width: 90, height: 12, borderRadius: 4, backgroundColor: "#4b5263", marginTop: 34 }} />
            <div style={{ width: 240, height: 8, borderRadius: 4, backgroundColor: "#e6e8ee", marginTop: 16 }} />
            <div style={{ width: 220, height: 8, borderRadius: 4, backgroundColor: "#e6e8ee", marginTop: 10 }} />
            <div style={{ width: 160, height: 8, borderRadius: 4, backgroundColor: "#e6e8ee", marginTop: 10 }} />
            <div style={{ width: 90, height: 12, borderRadius: 4, backgroundColor: "#4b5263", marginTop: 30 }} />
            <div style={{ width: 230, height: 8, borderRadius: 4, backgroundColor: "#e6e8ee", marginTop: 16 }} />
            <div style={{ width: 190, height: 8, borderRadius: 4, backgroundColor: "#e6e8ee", marginTop: 10 }} />
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
