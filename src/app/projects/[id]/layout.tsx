import { ProjectProvider } from "@/hooks/useProject";
import { WorkspaceShell } from "@/features/workspace/WorkspaceShell";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <ProjectProvider projectId={id}>
      <WorkspaceShell>{children}</WorkspaceShell>
    </ProjectProvider>
  );
}
