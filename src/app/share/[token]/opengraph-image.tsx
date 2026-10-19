import { ImageResponse } from "next/og";
import { sharedPresentation } from "@/server/share";
import { getAsset } from "@/server/store";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Logo concepts for review";

/**
 * The link preview for a client's share link: the presentation title and its
 * concepts' logos side by side, on the presentation's own paper colour.
 * Only images from the published presentation are used.
 */
export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const presentation = await sharedPresentation(token).catch(() => null);

  const logos: string[] = [];
  for (const concept of presentation?.concepts.slice(0, 4) ?? []) {
    if (!concept.primaryAssetId) continue;
    const asset = await getAsset(concept.primaryAssetId).catch(() => null);
    // The image renderer reads PNG and JPEG only.
    if (asset && /png|jpe?g/.test(asset.mimeType)) {
      logos.push(`data:${asset.mimeType};base64,${asset.data.toString("base64")}`);
    }
  }

  const title = presentation ? presentation.title || "Identity concepts" : "Presentation not available";
  const count = presentation?.concepts.length ?? 0;
  const tile = logos.length <= 2 ? 300 : logos.length === 3 ? 270 : 230;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#f7f5f0",
          color: "#16161c",
          padding: "56px 64px",
        }}
      >
        <div style={{ display: "flex", fontSize: 54, fontWeight: 600, textAlign: "center", lineHeight: 1.15 }}>
          {title.length > 60 ? `${title.slice(0, 57)}…` : title}
        </div>
        {presentation ? (
          <div style={{ display: "flex", marginTop: 14, fontSize: 24, color: "#8c887f", letterSpacing: 3 }}>
            {`${count} CONCEPT${count === 1 ? "" : "S"} FOR YOUR REVIEW`}
          </div>
        ) : null}
        {logos.length ? (
          <div style={{ display: "flex", gap: 24, marginTop: 44 }}>
            {logos.map((src, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: tile,
                  height: tile,
                  background: "#ffffff",
                  border: "1px solid #e4dfd6",
                  borderRadius: 18,
                }}
              >
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <img src={src} width={tile - 36} height={tile - 36} style={{ objectFit: "contain" }} />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    ),
    { ...size },
  );
}
