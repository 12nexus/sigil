/**
 * Background removal and tight cropping for exported logo files.
 *
 * Image models return opaque images on a flat background. A delivered logo is
 * expected to be a transparent PNG cropped to the artwork, so every exported
 * image runs through `cutout()` first. Pure pixel maths, no DOM, so the same
 * code can be exercised outside the browser.
 */

export interface Pixels {
  data: Uint8ClampedArray<ArrayBuffer>;
  width: number;
  height: number;
}

export interface CutoutOptions {
  /**
   * Only clear background that is connected to the image edge. Use for app
   * icons and favicons, where the artwork sits on its own tile and shapes
   * inside the tile must stay opaque. By default every background-coloured
   * pixel is cleared, so letter counters and holes in the mark go transparent.
   */
  keepEnclosed?: boolean;
}

type RGB = [number, number, number];

/** Colour distance treated as background (absorbs JPEG noise). */
const NOISE = 14;
/** Colour distance at which a pixel is fully opaque artwork. */
const SOLID = 96;
/** Alpha below which a pixel does not count toward the crop. */
const VISIBLE = 24;

function distance(d: Uint8ClampedArray, i: number, c: RGB): number {
  const r = d[i] - c[0];
  const g = d[i + 1] - c[1];
  const b = d[i + 2] - c[2];
  return Math.sqrt(r * r + g * g + b * b);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** The background colour: the median of small patches in the four corners. */
export function backgroundColour({ data, width, height }: Pixels): RGB {
  const size = Math.max(2, Math.round(Math.min(width, height) * 0.01));
  const channels: [number[], number[], number[]] = [[], [], []];
  for (const [x0, y0] of [
    [0, 0],
    [width - size, 0],
    [0, height - size],
    [width - size, height - size],
  ]) {
    for (let y = y0; y < y0 + size; y++) {
      for (let x = x0; x < x0 + size; x++) {
        const i = (y * width + x) * 4;
        channels[0].push(data[i]);
        channels[1].push(data[i + 1]);
        channels[2].push(data[i + 2]);
      }
    }
  }
  return [median(channels[0]), median(channels[1]), median(channels[2])];
}

/** Pixels within SOLID of the background that touch the edge, directly or through each other. */
function edgeConnected({ data, width, height }: Pixels, bg: RGB): Uint8Array {
  const reached = new Uint8Array(width * height);
  const stack = new Int32Array(width * height);
  let top = 0;
  const visit = (p: number) => {
    if (!reached[p] && distance(data, p * 4, bg) < SOLID) {
      reached[p] = 1;
      stack[top++] = p;
    }
  };
  for (let x = 0; x < width; x++) {
    visit(x);
    visit((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    visit(y * width);
    visit(y * width + width - 1);
  }
  while (top > 0) {
    const p = stack[--top];
    const x = p % width;
    if (x > 0) visit(p - 1);
    if (x < width - 1) visit(p + 1);
    if (p >= width) visit(p - width);
    if (p < width * (height - 1)) visit(p + width);
  }
  return reached;
}

/** How far around a background pixel anti-aliased edge pixels can sit. */
const EDGE = 2;
/** How far from an edge pixel to look for the artwork colour it was blended from. */
const REACH = 3;

/**
 * Turn the background transparent. An anti-aliased edge pixel is a blend of
 * the background and the artwork next to it, so its alpha is how far it sits
 * along that line and its colour is the artwork's. That leaves no light or
 * dark fringe when the logo is placed on another colour.
 */
function keyOut(px: Pixels, bg: RGB, keepEnclosed: boolean): void {
  const { data, width, height } = px;
  const total = width * height;
  const mask = keepEnclosed ? edgeConnected(px, bg) : null;
  const dist = new Float32Array(total);
  for (let p = 0; p < total; p++) dist[p] = distance(data, p * 4, bg);

  // Background: close to the background colour (and, for icons, reachable from the edge).
  const isBg = new Uint8Array(total);
  for (let p = 0; p < total; p++) {
    if (dist[p] <= NOISE && (!mask || mask[p])) isBg[p] = 1;
  }

  // Edge band: artwork pixels within EDGE of the background.
  const band = new Uint8Array(total);
  for (let p = 0; p < total; p++) {
    if (!isBg[p]) continue;
    const x0 = p % width;
    const y0 = (p - x0) / width;
    for (let y = Math.max(0, y0 - EDGE); y <= Math.min(height - 1, y0 + EDGE); y++) {
      for (let x = Math.max(0, x0 - EDGE); x <= Math.min(width - 1, x0 + EDGE); x++) {
        const q = y * width + x;
        if (!isBg[q]) band[q] = 1;
      }
    }
  }

  const alpha = new Float32Array(total).fill(1);
  for (let p = 0; p < total; p++) {
    if (isBg[p]) {
      alpha[p] = 0;
      continue;
    }
    if (!band[p]) {
      // Near-background pixels deep in tight corners, out of reach of the band.
      if (dist[p] < SOLID && (!mask || mask[p])) {
        alpha[p] = (dist[p] - NOISE) / (SOLID - NOISE);
      }
      continue;
    }

    // The artwork colour this pixel was blended from: the nearby pixel furthest from the background.
    const x0 = p % width;
    const y0 = (p - x0) / width;
    let f = p;
    for (let y = Math.max(0, y0 - REACH); y <= Math.min(height - 1, y0 + REACH); y++) {
      for (let x = Math.max(0, x0 - REACH); x <= Math.min(width - 1, x0 + REACH); x++) {
        const q = y * width + x;
        if (dist[q] > dist[f]) f = q;
      }
    }

    const i = p * 4;
    const j = f * 4;
    let dot = 0;
    let len = 0;
    for (let c = 0; c < 3; c++) {
      const toPixel = data[i + c] - bg[c];
      const toArt = data[j + c] - bg[c];
      dot += toPixel * toArt;
      len += toArt * toArt;
    }
    // Artwork barely distinguishable from the background: fall back to a distance ramp.
    const a =
      len > SOLID * SOLID
        ? Math.min(1, Math.max(0, dot / len))
        : Math.min(1, (dist[p] - NOISE) / (SOLID - NOISE));
    alpha[p] = a;
    if (a > 0) {
      for (let c = 0; c < 3; c++) data[i + c] = bg[c] + (data[i + c] - bg[c]) / a;
    }
  }

  for (let p = 0; p < total; p++) {
    data[p * 4 + 3] = Math.round(data[p * 4 + 3] * alpha[p]);
  }
}

/** Crop to the visible artwork, with no margin. */
function trim({ data, width, height }: Pixels): Pixels {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] >= VISIBLE) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { data, width, height };

  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const start = ((minY + y) * width + minX) * 4;
    out.set(data.subarray(start, start + w * 4), y * w * 4);
  }
  return { data: out, width: w, height: h };
}

/** Transparent background, cropped edge to edge. The input is not modified. */
export function cutout(px: Pixels, options: CutoutOptions = {}): Pixels {
  const copy: Pixels = { data: new Uint8ClampedArray(px.data), width: px.width, height: px.height };
  keyOut(copy, backgroundColour(copy), options.keepEnclosed ?? false);
  return trim(copy);
}
