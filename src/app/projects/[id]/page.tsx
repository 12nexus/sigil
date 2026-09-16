"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingBlock } from "@/components/ui/Primitives";
import { useProject } from "@/hooks/useProject";
import { suggestedStage } from "@/workflows/stages";

/** Opening a project lands on whatever stage actually needs attention. */
export default function ProjectIndexPage() {
  const router = useRouter();
  const { project } = useProject();

  useEffect(() => {
    if (project) {
      router.replace(`/projects/${project.id}/${suggestedStage(project)}`);
    }
  }, [project, router]);

  return <LoadingBlock label="Finding where you left off" />;
}
