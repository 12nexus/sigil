import { PresentationView } from "@/features/present/PresentationView";

export default async function PresentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PresentationView projectId={id} />;
}
