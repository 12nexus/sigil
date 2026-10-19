import type { Metadata } from "next";
import { PresentationView } from "@/features/present/PresentationView";

export const metadata: Metadata = {
  title: "Identity concepts",
  // A client's private link: keep it out of search engines and link previews' caches.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PresentationView source={{ kind: "share", token }} />;
}
