import { ImageResponse } from "next/og";

export const alt = "SweetToon - Read, collect, and publish webtoons";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f5f0e7",
        color: "#20231e",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "1020px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              color: "#c94b30",
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: 4,
            }}
          >
            FROM SCROLL TO SHELF
          </span>
          <strong
            style={{
              marginTop: 22,
              fontSize: 96,
              letterSpacing: -6,
            }}
          >
            SweetToon
          </strong>
          <span
            style={{
              marginTop: 18,
              color: "#5f655c",
              fontSize: 36,
            }}
          >
            Read. Collect. Publish.
          </span>
        </div>
        <div
          style={{
            width: 300,
            height: 410,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "14px solid #fffaf2",
            borderRadius: "8px 26px 26px 8px",
            background: "#365844",
            boxShadow: "-22px 28px 0 rgba(32,35,30,.16)",
            color: "#fffaf2",
            fontSize: 120,
            fontWeight: 800,
          }}
        >
          S
        </div>
      </div>
    </div>,
    size,
  );
}
