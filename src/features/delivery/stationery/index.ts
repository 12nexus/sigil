import type JSZip from "jszip";
import type { LockupKind, LogoConcept, Project, StationeryPerson } from "@/types";
import { slugify } from "@/utils/format";
import { assetLogoPng, traceAsset } from "../vectors";
import {
  kitFonts,
  pickColours,
  stationeryDetails,
  type Brand,
  type BrandLogos,
  type FontFile,
  type LogoImage,
} from "./brand";
import { stationeryReadme } from "./readme";

/**
 * The stationery kit: usable files built from the approved logo, the brand
 * kit's palette and typefaces, and the contact details entered in Delivery.
 * Everything runs in the browser; the only server call is for the typeface
 * files. The heavy document libraries load on first use.
 */

export interface KitFile {
  path: string;
  data: Blob | Uint8Array | string;
}

/* ------------------------------------------------------------------ */
/* Logos                                                               */
/* ------------------------------------------------------------------ */

interface Raster {
  bitmap: ImageBitmap;
  image: LogoImage;
  /** The stored asset this was cut from; derived rasters (whitened, resized) have none. */
  assetId?: string;
}

async function rasterFromBlob(blob: Blob): Promise<Raster> {
  const bitmap = await createImageBitmap(blob);
  return {
    bitmap,
    image: { png: new Uint8Array(await blob.arrayBuffer()), width: bitmap.width, height: bitmap.height },
  };
}

async function canvasToRaster(c: HTMLCanvasElement): Promise<Raster> {
  const blob = await new Promise<Blob>((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode PNG"))), "image/png"),
  );
  return rasterFromBlob(blob);
}

/** The same artwork in solid white, alpha kept: a knockout of the exact geometry. */
async function whiten(source: Raster): Promise<Raster> {
  const c = document.createElement("canvas");
  c.width = source.image.width;
  c.height = source.image.height;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(source.bitmap, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, c.width, c.height);
  return canvasToRaster(c);
}

/** Average luminance of the visible pixels, 0–1. */
function visibleLuminance(bitmap: ImageBitmap): number {
  const c = document.createElement("canvas");
  const scale = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height));
  c.width = Math.max(1, Math.round(bitmap.width * scale));
  c.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    sum += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
    n += 1;
  }
  return n ? sum / n : 0;
}

/** Downscale so the longest side is at most `max` pixels. */
async function limit(source: Raster, max: number): Promise<Raster> {
  const longest = Math.max(source.image.width, source.image.height);
  if (longest <= max) return source;
  const scale = max / longest;
  const c = document.createElement("canvas");
  c.width = Math.round(source.image.width * scale);
  c.height = Math.round(source.image.height * scale);
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source.bitmap, 0, 0, c.width, c.height);
  return canvasToRaster(c);
}

const ratio = (r: Raster) => r.image.width / r.image.height;

async function loadLogos(concept: LogoConcept): Promise<Record<keyof BrandLogos, Raster>> {
  const byKind = new Map<LockupKind, Raster>();
  for (const asset of concept.assets) {
    if (byKind.has(asset.kind)) continue;
    // An image that cannot be processed is left out; fallbacks below cover it.
    const png = await assetLogoPng(asset.assetId);
    if (png) byKind.set(asset.kind, { ...(await rasterFromBlob(png)), assetId: asset.assetId });
  }

  const primary = byKind.get("primary") ?? byKind.get("secondary") ?? byKind.get("horizontal") ?? [...byKind.values()][0];
  if (!primary) throw new Error("The approved concept has no logo images to build the stationery from.");

  const wide = [byKind.get("horizontal"), byKind.get("secondary"), primary]
    .filter((r): r is Raster => !!r)
    .sort((a, b) => ratio(b) - ratio(a))[0];
  const symbol = byKind.get("symbol") ?? byKind.get("small") ?? primary;

  // Prefer the drawn knockout, but only if it really is light artwork with the primary's shape.
  const drawnReversed = byKind.get("reversed");
  const reversed =
    drawnReversed &&
    visibleLuminance(drawnReversed.bitmap) > 0.7 &&
    Math.abs(ratio(drawnReversed) / ratio(primary) - 1) < 0.15
      ? drawnReversed
      : await whiten(primary);

  return {
    primary,
    wide,
    symbol,
    reversed,
    wideReversed: wide === primary ? reversed : await whiten(wide),
    symbolReversed: await whiten(symbol),
  };
}

/* ------------------------------------------------------------------ */
/* Fonts                                                               */
/* ------------------------------------------------------------------ */

async function fetchFont(family: string, weight: number): Promise<Uint8Array | null> {
  try {
    const res = await fetch(`/api/fonts?${new URLSearchParams({ family, weight: String(weight) })}`);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function loadFonts(project: Project): Promise<{ heading: FontFile; body: FontFile }> {
  const spec = kitFonts(project.brandKit!);
  const cache = new Map<string, Promise<Uint8Array | null>>();
  const get = (family: string, weight: number) => {
    const key = `${family}:${weight}`;
    if (!cache.has(key)) cache.set(key, fetchFont(family, weight));
    return cache.get(key)!;
  };

  const [hRegular, hBold, hDisplay, bRegular, bBold] = await Promise.all([
    get(spec.heading.family, 400),
    get(spec.heading.family, 700),
    get(spec.heading.family, spec.heading.weight),
    get(spec.body.family, 400),
    get(spec.body.family, 700),
  ]);
  return {
    heading: { family: spec.heading.family, regular: hRegular, bold: hBold, display: hDisplay ?? hBold ?? hRegular },
    body: { family: spec.body.family, regular: bRegular, bold: bBold, display: bRegular },
  };
}

/** Register the faces for canvas drawing under private names; fall back to generic families. */
async function canvasFonts(heading: FontFile, body: FontFile) {
  const register = async (alias: string, bytes: Uint8Array | null, fallback: string) => {
    if (!bytes) return fallback;
    try {
      const face = new FontFace(alias, bytes.slice().buffer);
      await face.load();
      document.fonts.add(face);
      return `"${alias}", ${fallback}`;
    } catch {
      return fallback;
    }
  };
  return {
    headingFont: await register("SigilKitHeading", heading.display, "Arial, sans-serif"),
    bodyFont: await register("SigilKitBody", body.regular, "Arial, sans-serif"),
  };
}

/* ------------------------------------------------------------------ */
/* Build                                                               */
/* ------------------------------------------------------------------ */

const WEIGHT_LABELS: Record<number, string> = {
  100: "Thin",
  200: "ExtraLight",
  300: "Light",
  500: "Medium",
  600: "SemiBold",
  800: "ExtraBold",
  900: "Black",
};

/** Print resolution of the logo on the card front, which fills 60% × 42% of the card at most. */
function cardLogoDpi(logo: LogoImage, letter: boolean): number {
  const [w, h] = letter ? [3.5, 2] : [85 / 25.4, 55 / 25.4];
  const inchesPerPixel = Math.min((w * 0.6) / logo.width, (h * 0.42) / logo.height);
  return Math.round(1 / inchesPerPixel);
}

const personSlug = (p: StationeryPerson, i: number) => slugify(p.name) || `person-${i + 1}`;

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function approvedConcept(project: Project): LogoConcept | undefined {
  const id = project.approvals.final.conceptId ?? project.approvals.client.conceptId;
  return project.concepts.find((c) => c.id === id);
}

export async function buildStationery(project: Project): Promise<KitFile[]> {
  const kit = project.brandKit;
  const concept = approvedConcept(project);
  if (!kit || !concept) throw new Error("Generate the brand kit first: the stationery uses its colours and typefaces.");

  const [rasters, fonts, pdf, { letterheadDocx }, { invoiceXlsx }, { presentationPptx }, signature, { socialImages }] =
    await Promise.all([
      loadLogos(concept),
      loadFonts(project),
      import("./pdf"),
      import("./letterhead"),
      import("./invoice"),
      import("./presentation"),
      import("./signature"),
      import("./social"),
    ]);

  // Large enough for 300 dpi on a business card, small enough to keep files light.
  const sized = {
    primary: await limit(rasters.primary, 2000),
    wide: await limit(rasters.wide, 2000),
    symbol: await limit(rasters.symbol, 1200),
    reversed: await limit(rasters.reversed, 2000),
    wideReversed: await limit(rasters.wideReversed, 2000),
    symbolReversed: await limit(rasters.symbolReversed, 1200),
  };

  // Vector traces of the artwork the print files use; a lockup that did not trace cleanly stays raster.
  const vectorOf = async (r: Raster) => {
    if (!r.assetId) return null;
    const result = await traceAsset(r.assetId);
    return result.ok ? result.set : null;
  };
  const [primaryVector, wideVector, symbolVector] = await Promise.all([
    vectorOf(rasters.primary),
    vectorOf(rasters.wide),
    vectorOf(rasters.symbol),
  ]);
  const withVector = (image: LogoImage, file: { svg: string; pdf: Uint8Array } | undefined): LogoImage =>
    file ? { ...image, vector: { svg: file.svg, pdf: file.pdf } } : image;

  const details = stationeryDetails(project);
  const brand: Brand = {
    companyName: concept.typography.exactCompanyName || project.companyName,
    colours: pickColours(kit.palette),
    heading: fonts.heading,
    body: fonts.body,
    logos: {
      primary: withVector(sized.primary.image, primaryVector?.colour),
      wide: withVector(sized.wide.image, wideVector?.colour),
      symbol: withVector(sized.symbol.image, symbolVector?.colour),
      // White versions of the traces: the same geometry as the colour logos.
      reversed: withVector(sized.reversed.image, primaryVector?.white),
      wideReversed: withVector(sized.wideReversed.image, wideVector?.white),
      symbolReversed: withVector(sized.symbolReversed.image, symbolVector?.white),
    },
    details,
  };

  const slug = slugify(project.companyName);
  const letter = details.paper === "letter";
  const files: KitFile[] = [];

  files.push({ path: `letterhead/${slug}-letterhead.docx`, data: await letterheadDocx(brand) });
  files.push({ path: `invoice/${slug}-invoice.xlsx`, data: await invoiceXlsx(brand) });

  const people = details.people.length ? details.people : [{ id: "blank", name: "", title: "", phone: "", email: "" }];
  for (const [i, person] of people.entries()) {
    const name = person.name.trim() ? personSlug(person, i) : "company";
    files.push({ path: `business-cards/${slug}-business-card-${name}.pdf`, data: await pdf.businessCardPdf(brand, person) });
  }
  files.push({ path: `envelope/${slug}-envelope-${letter ? "no10" : "dl"}.pdf`, data: await pdf.envelopePdf(brand) });
  files.push({ path: `compliment-slip/${slug}-compliment-slip.pdf`, data: await pdf.complimentSlipPdf(brand) });
  files.push({ path: `presentation/${slug}-presentation.pptx`, data: await presentationPptx(brand) });

  // Email signature: a 2× logo for sharp rendering on high-density screens.
  const sigLogo = await limit(rasters.wide, 400);
  const sigHeight = signature.SIGNATURE_LOGO_HEIGHT;
  const sigWidth = Math.min(200, Math.round((sigLogo.image.width / sigLogo.image.height) * sigHeight));
  const sigSize = { width: sigWidth, height: Math.round((sigLogo.image.height / sigLogo.image.width) * sigWidth) };
  const sigBlob = new Blob([sigLogo.image.png.slice()], { type: "image/png" });
  const publicUrl = details.signatureLogoUrl.trim();
  const logoSrc = publicUrl || (await blobToDataUrl(sigBlob));
  const blocks = people.map((person, i) => ({
    name: person.name.trim() || `Signature ${i + 1}`,
    html: signature.signatureHtml(brand, person, logoSrc, sigSize),
  }));
  files.push({ path: "email-signature/index.html", data: signature.signaturePage(brand, blocks, !publicUrl) });
  files.push({ path: "email-signature/logo.png", data: sigBlob });

  const assets = {
    logos: {
      primary: sized.primary.bitmap,
      wide: sized.wide.bitmap,
      symbol: sized.symbol.bitmap,
      reversed: sized.reversed.bitmap,
      wideReversed: sized.wideReversed.bitmap,
      symbolReversed: sized.symbolReversed.bitmap,
    },
    ...(await canvasFonts(fonts.heading, fonts.body)),
  };
  for (const image of await socialImages(brand, assets)) {
    files.push({ path: `social-and-video/${image.path}`, data: image.blob });
  }

  const headingWeight = kitFonts(kit).heading.weight;
  const faces: Array<[FontFile, string, Uint8Array | null]> = [
    [fonts.heading, "Regular", fonts.heading.regular],
    [fonts.heading, "Bold", fonts.heading.bold],
    [fonts.body, "Regular", fonts.body.regular],
    [fonts.body, "Bold", fonts.body.bold],
  ];
  if (headingWeight !== 400 && headingWeight !== 700) {
    faces.push([fonts.heading, WEIGHT_LABELS[headingWeight] ?? String(headingWeight), fonts.heading.display]);
  }
  for (const [face, weight, bytes] of faces) {
    const path = `fonts/${face.family.replace(/\s+/g, "")}-${weight}.ttf`;
    if (bytes && !files.some((f) => f.path === path)) files.push({ path, data: bytes });
  }

  files.push({
    path: "README.txt",
    data: stationeryReadme(brand, {
      fontsEmbedded: !!(fonts.body.regular && fonts.heading.display),
      cardLogoDpi: primaryVector ? null : cardLogoDpi(sized.reversed.image, letter),
      signatureEmbedded: !publicUrl,
    }),
  });

  return files;
}

/** Add the kit to an existing ZIP under `folder`. */
export async function addStationery(zip: JSZip, project: Project, folder = "stationery"): Promise<void> {
  const files = await buildStationery(project);
  const dir = zip.folder(folder)!;
  for (const file of files) dir.file(file.path, file.data);
}
