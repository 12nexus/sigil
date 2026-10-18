/**
 * Vector versions of the final logos, traced on the server (see src/server/vectorcraft.ts).
 *
 * A trace copies whatever it is given, and it can also simplify: a gradient becomes a few flat
 * bands. So every trace is checked against the image it came from before anything uses it, and
 * one that does not match is reported, not shipped as the logo.
 */

export interface VectorFile {
  svg: string;
  pdf: Uint8Array;
  eps: Uint8Array;
}

export interface VectorSet {
  colour: VectorFile;
  white: VectorFile;
  black: VectorFile;
  /** Share of the artwork's interior whose colour differs visibly from the source image, 0–1. */
  mismatch: number;
}

export type VectorResult =
  | { ok: true; set: VectorSet }
  | { ok: false; reason: string; unavailable?: boolean };

/** A trace wrong on more than this share of the artwork's interior is not used. */
export const MAX_MISMATCH = 0.02;

const cache = new Map<string, Promise<VectorResult>>();

const bytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/**
 * Trace a transparent logo PNG. `key` identifies the source (asset ids never change), so each
 * logo is traced once per page load however many exports use it.
 */
export function vectorizeLogo(key: string, png: Blob): Promise<VectorResult> {
  let pending = cache.get(key);
  if (!pending) {
    pending = run(png);
    cache.set(key, pending);
    // A failure from a passing problem should not stick for the rest of the session.
    void pending.then((r) => {
      if (!r.ok && !r.unavailable) cache.delete(key);
    });
  }
  return pending;
}

async function run(png: Blob): Promise<VectorResult> {
  let res: Response;
  try {
    res = await fetch("/api/vector/trace?variants=colour,white,black", {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: png,
    });
  } catch {
    return { ok: false, reason: "The server could not be reached." };
  }
  const body = (await res.json().catch(() => null)) as
    | { variants?: Record<string, { svg: string; pdf: string; eps: string }>; error?: { code: string; message: string } }
    | null;
  if (!res.ok || !body?.variants) {
    return {
      ok: false,
      reason: body?.error?.message ?? `Tracing failed (HTTP ${res.status}).`,
      unavailable: body?.error?.code === "VECTOR_UNAVAILABLE",
    };
  }

  const file = (name: string): VectorFile => {
    const v = body.variants![name];
    return { svg: v.svg, pdf: bytes(v.pdf), eps: bytes(v.eps) };
  };
  const colour = file("colour");
  let fidelity: { wrong: number; meanError: number };
  try {
    fidelity = await compare(png, colour.svg);
  } catch {
    return { ok: false, reason: "The trace could not be checked against the image." };
  }
  if (fidelity.meanError > MAX_MEAN_ERROR) {
    return {
      ok: false,
      reason: "The trace flattened the image's colours: gradients, shading or texture do not trace to flat vector shapes.",
    };
  }
  if (fidelity.wrong > MAX_MISMATCH) {
    return {
      ok: false,
      reason: `The trace differs from the image on ${Math.round(fidelity.wrong * 100)}% of the artwork: shapes were lost or added.`,
    };
  }
  return { ok: true, set: { colour, white: file("white"), black: file("black"), mismatch: fidelity.wrong } };
}

/* ------------------------------------------------------------------ */
/* Fidelity                                                            */
/* ------------------------------------------------------------------ */

/** Longest side both images are compared at. */
const SIZE = 256;
/** Colour distance (RGB, 0–441) between neighbours below which a source pixel is interior. */
const FLAT = 12;
/** Colour distance at which an interior pixel counts as wrong. */
const WRONG = 32;
/** Mean colour error over interior pixels above which a trace has simplified the colours. */
export const MAX_MEAN_ERROR = 6;

async function pixels(source: CanvasImageSource, w: number, h: number): Promise<Uint8ClampedArray> {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h).data;
}

async function loadSvg(svg: string): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** A pixel composited over white, as RGB. */
function over(d: Uint8ClampedArray, i: number): [number, number, number] {
  const a = d[i + 3] / 255;
  return [d[i] * a + 255 * (1 - a), d[i + 1] * a + 255 * (1 - a), d[i + 2] * a + 255 * (1 - a)];
}

const distance = (p: number[], q: number[]) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

/**
 * Compare the trace with its source on the source's interior pixels: those whose neighbours are
 * the same colour. Anti-aliased edges, which every trace redraws slightly differently, are left
 * out; a missing or extra shape, or a gradient flattened into bands, shows up across interiors.
 * Returns the share of interior pixels that are wrong and the mean colour error.
 */
async function compare(png: Blob, svg: string): Promise<{ wrong: number; meanError: number }> {
  const bitmap = await createImageBitmap(png);
  const scale = SIZE / Math.max(bitmap.width, bitmap.height);
  const w = Math.max(3, Math.round(bitmap.width * scale));
  const h = Math.max(3, Math.round(bitmap.height * scale));
  const a = await pixels(bitmap, w, h);
  const b = await pixels(await loadSvg(svg), w, h);

  let interior = 0;
  let wrong = 0;
  let total = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      if (a[i + 3] < 26 && b[i + 3] < 26) continue;
      const colour = over(a, i);
      let flat = true;
      for (let dy = -1; dy <= 1 && flat; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const j = ((y + dy) * w + x + dx) * 4;
          if (Math.abs(a[j + 3] - a[i + 3]) > 25 || distance(over(a, j), colour) > FLAT) {
            flat = false;
            break;
          }
        }
      }
      if (!flat) continue;
      interior += 1;
      const error = distance(colour, over(b, i));
      total += error;
      if (error > WRONG) wrong += 1;
    }
  }
  if (!interior) return { wrong: 1, meanError: Infinity };
  return { wrong: wrong / interior, meanError: total / interior };
}
