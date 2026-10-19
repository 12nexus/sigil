import { PresentationView } from "@/features/present/PresentationView";

/** The signed-in preview of a project's client presentation. */
export default async function PresentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PresentationView source={{ kind: "project", id }} />;
}
