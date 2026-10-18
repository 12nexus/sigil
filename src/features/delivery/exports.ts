import JSZip from "jszip";
import { getAsset } from "@/services/db/assetStore";
import type { LogoConcept, Project } from "@/types";
import { downloadBlob, downloadJson, downloadText } from "@/utils/download";
import { slugify } from "@/utils/format";
import { toLogoPng } from "@/utils/image";
import { serializeBrief } from "@/prompts/shared";
import { addStationery } from "./stationery";
import { addVectorLogos } from "./vectors";

/**
 * Exports.
 *
 * Asset bundles carry a README that states plainly what the files are — AI
 * raster images, plus vector traces of the final lockups where they trace
 * cleanly — so the distinction survives the handoff even when the ZIP is
 * forwarded on without context.
 *
 * Every image is exported as a transparent PNG cropped edge to edge to the
 * artwork. The favicon keeps its tile: only background outside it is removed.
 */

const extensionFor = (mimeType: string): string =>
  mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";

async function logoFile(blob: Blob, kind: string): Promise<{ blob: Blob; ext: string } | null> {
  try {
    return { blob: await toLogoPng(blob, { keepEnclosed: kind === "favicon" }), ext: "png" };
  } catch {
    return null;
  }
}

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
    // If an image cannot be processed, ship the original rather than drop it.
    const file = (await logoFile(stored.blob, asset.kind)) ?? {
      blob: stored.blob,
      ext: extensionFor(stored.mimeType),
    };
    const name = `${slugify(project.companyName)}-${concept.code}-${asset.kind}.${file.ext}`;
    zip.folder(folder)!.file(name, file.blob);
    count += 1;
  }
  return count;
}

const DISCLOSURE = `ASSET DISCLOSURE
================

The image files in this package are AI-generated raster images, exported as
transparent PNGs cropped to the artwork. The background was removed
automatically: check edges before use. The favicon keeps its own tile.

final-logo/vector/ holds the final lockups traced into true vector artwork
(SVG, PDF and EPS, in colour, white and black). Each trace was checked against
its image; lockups that did not trace cleanly are listed in that folder's
README and have no vector files. Use the vector files for print, signage and
anything large.

What to keep in mind:
- A trace reproduces the image exactly, including any malformed letters in
  the wordmark. Check the lettering before a large print run; a designer may
  need to reset the wordmark in the recommended typeface.
- Lockups without a vector file (and the concepts in finalists/) are raster
  only: fine for screens and review, not for large print.

The colour values, typography recommendations, clear space rules, minimum sizes
and usage guidelines in the accompanying brand kit ARE production-ready as
written.
`;

/** The approved logo files, finalists, brief, brand kit and stationery kit. */
export async function exportFinalAssets(project: Project): Promise<void> {
  const zip = new JSZip();
  const approvedId = project.approvals.final.conceptId ?? project.approvals.client.conceptId;
  const approved = project.concepts.find((c) => c.id === approvedId);

  if (approved) {
    await addConceptAssets(zip, project, approved, "final-logo");
    try {
      await addVectorLogos(zip, project, approved, "final-logo/vector");
    } catch (err) {
      zip.file(
        "final-logo/vector/README.txt",
        `The vector logos could not be made: ${err instanceof Error ? err.message : String(err)}\n`,
      );
    }
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
    // The logo files above are the package's core: a stationery failure must not cost them.
    try {
      await addStationery(zip, project);
    } catch (err) {
      zip.file(
        "stationery/NOT-INCLUDED.txt",
        `The stationery kit could not be built: ${err instanceof Error ? err.message : String(err)}\n` +
          "Try Delivery → Stationery kit → Download stationery.\n",
      );
    }
  }

  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, `${slugify(project.companyName)}-logo-package.zip`);
}

/** The stationery kit on its own. */
export async function exportStationery(project: Project): Promise<void> {
  const zip = new JSZip();
  await addStationery(zip, project, `${slugify(project.companyName)}-stationery`);
  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, `${slugify(project.companyName)}-stationery.zip`);
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
