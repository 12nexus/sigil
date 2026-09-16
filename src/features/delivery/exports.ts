import JSZip from "jszip";
import { getAsset } from "@/services/db/assetStore";
import type { LogoConcept, Project } from "@/types";
import { downloadBlob, downloadJson, downloadText } from "@/utils/download";
import { slugify } from "@/utils/format";
import { serializeBrief } from "@/prompts/shared";

/**
 * Exports.
 *
 * Asset bundles carry a README that states plainly what the files are — AI
 * raster, not production vector — so the distinction survives the handoff even
 * when the ZIP is forwarded on without context.
 */

const extensionFor = (mimeType: string): string =>
  mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";

async function addConceptAssets(
  zip: JSZip,
  project: Project,
  concept: LogoConcept,
  folder: string,
): Promise<number> {
  let count = 0;
  for (const asset of concept.assets) {
    const stored = await getAsset(asset.assetId);
    if (!stored) continue;
    const name = `${slugify(project.companyName)}-${concept.code}-${asset.kind}.${extensionFor(stored.mimeType)}`;
    zip.folder(folder)!.file(name, stored.blob);
    count += 1;
  }
  return count;
}

const DISCLOSURE = `ASSET DISCLOSURE
================

Every image file in this package is an AI-generated raster image (PNG or JPEG).

What that means in practice:
- These files are suitable for review, client presentation, digital comping,
  and internal circulation.
- They are NOT production-ready vector artwork. They do not scale losslessly,
  they cannot be colour-separated for print, and their edges are resampled
  rather than mathematically defined.
- Before this identity is rolled out, the approved mark must be redrawn as true
  vector artwork by a designer, using these files as reference.
- Any text rendered inside these images should be treated as indicative only.
  Image models routinely corrupt letterforms. The wordmark must be reset in the
  recommended typeface before use.

The colour values, typography recommendations, clear space rules, minimum sizes
and usage guidelines in the accompanying brand kit ARE production-ready as
written.
`;

export async function exportFinalAssets(project: Project): Promise<void> {
  const zip = new JSZip();
  const approvedId = project.approvals.final.conceptId ?? project.approvals.client.conceptId;
  const approved = project.concepts.find((c) => c.id === approvedId);

  if (approved) {
    await addConceptAssets(zip, project, approved, "final-logo");
  }

  for (const id of project.finalistIds) {
    const concept = project.concepts.find((c) => c.id === id);
    if (concept && concept.id !== approvedId) {
      await addConceptAssets(zip, project, concept, `finalists/${concept.code}`);
    }
  }

  zip.file("README.txt", DISCLOSURE);
  if (project.brief) {
    zip.file("brand-brief.md", briefMarkdown(project));
  }
  if (project.brandKit) {
    zip.file("brand-kit.md", brandKitMarkdown(project));
  }

  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, `${slugify(project.companyName)}-logo-package.zip`);
}

export async function exportAllConcepts(project: Project): Promise<void> {
  const zip = new JSZip();

  for (const concept of project.concepts) {
    const direction = project.directions.find((d) => d.id === concept.directionId);
    const folder = direction
      ? `${direction.number}-${slugify(direction.name)}`
      : "unsorted";
    await addConceptAssets(zip, project, concept, folder);
  }

  zip.file("README.txt", DISCLOSURE);
  zip.file("concept-index.md", conceptIndexMarkdown(project));

  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, `${slugify(project.companyName)}-all-concepts.zip`);
}

export function exportProjectData(project: Project): void {
  // Asset blobs are excluded; ids are kept so a re-import could rehydrate them.
  downloadJson(project, `${slugify(project.companyName)}-project.json`);
}

export function exportBrief(project: Project): void {
  downloadText(
    briefMarkdown(project),
    `${slugify(project.companyName)}-brand-brief.md`,
    "text/markdown",
  );
}

export function exportHistory(project: Project): void {
  const lines = [
    `# ${project.companyName} — project history`,
    "",
    ...project.timeline.map((event) => {
      const at = new Date(event.at);
      return `**${at.toLocaleString()}** — ${event.title}${event.detail ? `\n: ${event.detail}` : ""}`;
    }),
  ];
  downloadText(
    lines.join("\n\n"),
    `${slugify(project.companyName)}-history.md`,
    "text/markdown",
  );
}

/* ------------------------------------------------------------------ */

function briefMarkdown(project: Project): string {
  if (!project.brief) return "# No brief\n";
  return `# ${project.companyName} — Brand Brief

${project.briefApprovedAt ? `Approved ${new Date(project.briefApprovedAt).toLocaleString()}` : "Draft — not yet approved"}

${serializeBrief(project.brief)}
`;
}

function conceptIndexMarkdown(project: Project): string {
  const lines = [`# ${project.companyName} — concept index`, ""];

  for (const direction of project.directions) {
    const concepts = project.concepts.filter((c) => c.directionId === direction.id);
    if (!concepts.length) continue;
    lines.push(`## Direction ${direction.number} — ${direction.name}`, "", direction.concept, "");
    for (const concept of concepts) {
      lines.push(
        `### ${concept.code} — ${concept.name}`,
        `Status: ${concept.status}${concept.rating ? ` · rated ${concept.rating}/5` : ""}`,
        `Objective: ${concept.objective}`,
        concept.parentConceptId
          ? `Derived from: ${project.concepts.find((c) => c.id === concept.parentConceptId)?.code ?? "unknown"}`
          : "",
        "",
        concept.rationale,
        "",
      );
    }
  }
  return lines.filter((l) => l !== undefined).join("\n");
}

function brandKitMarkdown(project: Project): string {
  const kit = project.brandKit;
  if (!kit) return "";
  const concept = project.concepts.find((c) => c.id === kit.conceptId);

  return `# ${project.companyName} — Brand Kit

${concept ? `Final mark: **${concept.name}**\n\n${concept.rationale}\n` : ""}

## Colour palette

| Name | Hex | Role | Usage |
| --- | --- | --- | --- |
${kit.palette.map((c) => `| ${c.name} | \`${c.hex}\` | ${c.role} | ${c.usage} |`).join("\n")}

## Typography

**Primary — ${kit.typography.primary.family}** (${kit.typography.primary.category}, ${kit.typography.primary.weight})
${kit.typography.primary.why}

**Secondary — ${kit.typography.secondary.family}** (${kit.typography.secondary.category}, ${kit.typography.secondary.weight})
${kit.typography.secondary.why}

${kit.typography.notes}

## Clear space
${kit.clearSpace}

## Minimum size
${kit.minimumSize}

## Usage rules
${kit.usageRules.map((r) => `- ${r}`).join("\n")}

## Do
${kit.dos.map((r) => `- ${r}`).join("\n")}

## Don't
${kit.donts.map((r) => `- ${r}`).join("\n")}

## Brand personality
${kit.personality.join(" · ")}

## Rationale
${kit.rationale}

---

## Asset disclosure
${kit.assetDisclosure}
`;
}

export { brandKitMarkdown, briefMarkdown };
