import { BrandKitDocument } from "@/features/delivery/BrandKitDocument";

export default async function BrandKitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BrandKitDocument projectId={id} />;
}
