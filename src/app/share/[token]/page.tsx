import type { Metadata } from "next";
import { headers } from "next/headers";
import { PresentationView } from "@/features/present/PresentationView";
import { sharedPresentation } from "@/server/share";

type Props = { params: Promise<{ token: string }> };

/**
 * The client's link. Its title, description and preview image come from the
 * presentation, so a link pasted into email, WhatsApp or Slack reads as the
 * client's own project. Still kept out of search engines: it is a private link.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const presentation = await sharedPresentation(token).catch(() => null);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base: Metadata = {
    metadataBase: new URL(`${proto}://${host}`),
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
  if (!presentation) return { ...base, title: { absolute: "Presentation not available" } };

  const count = presentation.concepts.length;
  const title = presentation.title || "Identity concepts";
  const description =
    presentation.intro.trim() ||
    `${count} logo concept${count === 1 ? "" : "s"} for your review, each shown on real surfaces.`;
  return {
    ...base,
    title: { absolute: title },
    description,
    openGraph: { type: "website", title, description, url: `/share/${token}` },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SharePage({ params }: Props) {
  const { token } = await params;
  return <PresentationView source={{ kind: "share", token }} />;
}
