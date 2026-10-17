import type { Project, ProjectSummary } from "@/types";
import { stageProgress } from "@/workflows/stages";
import { newId, newShareToken } from "@/utils/id";

/**
 * Pure project transforms shared by the browser and the server: the dashboard
 * summary and the duplicate-with-remapped-artwork copy.
 */

export function summariseProject(project: Project): ProjectSummary {
  const live = project.concepts.filter((c) => c.status !== "archived");
  const cover =
    project.concepts.find((c) => c.status === "approved")?.primaryAssetId ??
    project.concepts.find((c) => c.status === "finalist")?.primaryAssetId ??
    project.concepts.find((c) => c.status === "shortlisted")?.primaryAssetId ??
    project.concepts.find((c) => c.primaryAssetId)?.primaryAssetId;

  return {
    id: project.id,
    companyName: project.companyName,
    industry: project.industry,
    status: project.status,
    stage: project.stage,
    conceptCount: live.length,
    finalistCount: project.finalistIds.length,
    directionCount: project.directions.length,
    approvedDirectionCount: project.directions.filter((d) => d.status === "approved").length,
    progress: stageProgress(project),
    isDemo: project.isDemo,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    coverAssetId: cover,
  };
}

/** Every asset id a project refers to. */
export function referencedAssetIds(project: Project): string[] {
  const ids = new Set<string>();
  for (const c of project.concepts) {
    if (c.primaryAssetId) ids.add(c.primaryAssetId);
    for (const a of c.assets) ids.add(a.assetId);
    for (const m of c.mockups ?? []) ids.add(m.assetId);
    if (c.typography.reconstructedWordmarkAssetId) {
      ids.add(c.typography.reconstructedWordmarkAssetId);
    }
  }
  return [...ids];
}

/**
 * Duplication copies the full design history, including artwork, and remaps
 * every asset reference so the two projects never share images.
 */
export function buildDuplicate(
  source: Project,
  newProjectId: string,
  assetMap: Map<string, string>,
): Project {
  const remap = (assetId?: string) => (assetId ? (assetMap.get(assetId) ?? assetId) : assetId);
  const now = new Date().toISOString();

  const copy: Project = {
    ...structuredClone(source),
    id: newProjectId,
    companyName: `${source.companyName} (copy)`,
    status: "active",
    isDemo: false,
    createdAt: now,
    updatedAt: now,
    archivedAt: undefined,
    clientReview: {
      ...structuredClone(source.clientReview),
      shareToken: newShareToken(),
      published: false,
      publishedAt: undefined,
    },
  };

  copy.concepts = copy.concepts.map((c) => ({
    ...c,
    primaryAssetId: remap(c.primaryAssetId),
    assets: c.assets.map((a) => ({ ...a, assetId: remap(a.assetId)! })),
    mockups: c.mockups?.map((m) => ({
      ...m,
      assetId: remap(m.assetId)!,
      derivedFrom: remap(m.derivedFrom),
    })),
    typography: {
      ...c.typography,
      reconstructedWordmarkAssetId: remap(c.typography.reconstructedWordmarkAssetId),
    },
  }));

  copy.timeline = [
    ...copy.timeline,
    {
      id: newId("evt"),
      at: now,
      kind: "system",
      title: "Project duplicated",
      detail: `Copied from "${source.companyName}" with its full design history.`,
    },
  ];

  return copy;
}
