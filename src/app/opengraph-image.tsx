import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Talía";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const head = await readFile(join(process.cwd(), "public", "talia-miniatura.png"));
  const headSrc = `data:image/png;base64,${head.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#17172b",
          color: "#f7f2e9",
          padding: "74px 86px",
          fontFamily: "Arial",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              color: "#12d9c7",
              fontSize: 34,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            Talía
          </div>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 0.98, maxWidth: 720 }}>
            AI attention platform for cultural organizations
          </div>
          <div style={{ color: "#d4b64c", fontSize: 34, fontWeight: 700 }}>
            agora.talia.events
          </div>
        </div>
        <div
          style={{
            width: 260,
            height: 260,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 52,
            background: "#0d0d16",
            overflow: "hidden",
          }}
        >
          <img
            src={headSrc}
            alt=""
            style={{
              width: 260,
              height: 260,
              objectFit: "cover",
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}
