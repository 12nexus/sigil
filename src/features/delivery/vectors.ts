import type JSZip from "jszip";
import { getAsset } from "@/services/db/assetStore";
import { vectorizeLogo, type VectorResult } from "@/services/vector";
import type { LockupKind, LogoConcept, Project } from "@/types";
import { slugify } from "@/utils/format";
import { toLogoPng } from "@/utils/image";

/**
 * The vector folder of the logo package: each final lockup traced to SVG, PDF and EPS, in full
 * colour and as one-colour white and black versions. A lockup whose trace does not match its image
 * is left out and the README says why, so nothing in the folder silently differs from the
 * approved logo.
 */

/** Lockups worth tracing. Reversed is the white version of the primary; the favicon and small
 * versions are pixel-tuned images, not artwork. */
export const TRACED_KINDS: LockupKind[] = [
  "primary",
  "secondary",
  "horizontal",
  "stacked",
  "symbol",
  "wordmark",
  "monochrome",
];

/** The transparent PNG an asset is exported as: also what gets traced. */
export async function assetLogoPng(assetId: string): Promise<Blob | null> {
  const stored = await getAsset(assetId);
  if (!stored) return null;
  try {
    return await toLogoPng(stored.blob);
  } catch {
    return null;
  }
}

/** Trace a lockup; the result is cached per asset, so the package and stationery share it. */
export async function traceAsset(assetId: string): Promise<VectorResult> {
  const png = await assetLogoPng(assetId);
  if (!png) return { ok: false, reason: "The image could not be loaded." };
  return vectorizeLogo(assetId, png);
}

export async function addVectorLogos(zip: JSZip, project: Project, concept: LogoConcept, folder: string): Promise<void> {
  const assets = TRACED_KINDS.flatMap((kind) => concept.assets.filter((a) => a.kind === kind).slice(0, 1));
  const results = await Promise.all(assets.map(async (a) => ({ kind: a.kind, result: await traceAsset(a.assetId) })));
  const dir = zip.folder(folder)!;
  const base = `${slugify(project.companyName)}-${concept.code}`;

  if (results.length && results.every((r) => !r.result.ok && r.result.unavailable)) {
    dir.file("README.txt", "Vector tracing is not installed on this SIGIL server, so this package has no vector files.\n");
    return;
  }

  const traced: string[] = [];
  const skipped: string[] = [];
  for (const { kind, result } of results) {
    if (!result.ok) {
      skipped.push(`- ${kind}: ${result.reason}`);
      continue;
    }
    for (const [variant, suffix] of [
      ["colour", ""],
      ["white", "-white"],
      ["black", "-black"],
    ] as const) {
      const files = result.set[variant];
      dir.file(`${base}-${kind}${suffix}.svg`, files.svg);
      dir.file(`${base}-${kind}${suffix}.pdf`, files.pdf);
      dir.file(`${base}-${kind}${suffix}.eps`, files.eps);
    }
    traced.push(`- ${kind} (matches the image on ${(100 - result.set.mismatch * 100).toFixed(1)}% of the artwork)`);
  }

  dir.file("README.txt", vectorReadme(traced, skipped));
}

function vectorReadme(traced: string[], skipped: string[]): string {
  return `VECTOR LOGOS
============

Each lockup below was traced from its approved image into true vector
artwork (VectorCraft Image Trace, Flat Logo mode), then checked against the
image: a trace that differed visibly was left out.

Every lockup comes in three versions, each as SVG, PDF and EPS:
  <name>.svg         full colour
  <name>-white.svg   one colour, white: for dark backgrounds
  <name>-black.svg   one colour, black: for single-colour print, engraving, stamps

SVG is for websites and apps, PDF for printers and most design tools, EPS
for older print and signage workflows. White areas inside the mark are
holes, so the logos sit on any background.

Traced:
${traced.join("\n") || "- none"}
${skipped.length ? `\nNot traced:\n${skipped.join("\n")}\n` : ""}
WHAT TO CHECK
-------------
A trace copies the image exactly, including its mistakes: if a letter in the
image's wordmark is malformed, it is malformed here too. Check the lettering
before a large print run, and have a designer reset the wordmark in the
brand typeface if it needs it.
`;
}
