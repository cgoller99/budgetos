import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Buxme — Take Control of Every Dollar";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          height: "100%",
          width: "100%",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(180deg, #0b0f14 0%, #11161d 100%)",
          color: "#f9fafb",
          padding: "64px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "#3b82f6",
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            B
          </div>
          <span style={{ fontSize: 32, fontWeight: 600 }}>Buxme</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.05 }}>
            Take Control of Every Dollar.
          </div>
          <div style={{ fontSize: 28, color: "#94a3b8", maxWidth: 900 }}>
            Accounts, bills, income plans, goals, and insights in one secure place.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
