/**
 * Client-side raster derivations.
 *
 * These produce honest previews — a true greyscale conversion, a real
 * downscale — rather than CSS filters, so what the designer evaluates in
 * comparison mode matches what the asset actually does.
 */

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode image"));
    img.src = src;
  });
}

function canvasFrom(img: HTMLImageElement, size?: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const scale = size ? size / Math.max(img.width, img.height) : 1;
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function toGrayscaleUrl(src: string): Promise<string> {
  const img = await loadImage(src);
  const canvas = canvasFrom(img);
  const ctx = canvas.getContext("2d")!;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const luma = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
    px[i] = px[i + 1] = px[i + 2] = luma;
  }
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL("image/png");
}

/** High-contrast one-bit render — the real black-and-white viability test. */
export async function toOneBitUrl(src: string, threshold = 170): Promise<string> {
  const img = await loadImage(src);
  const canvas = canvasFrom(img);
  const ctx = canvas.getContext("2d")!;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const luma = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
    const value = luma > threshold ? 255 : 0;
    px[i] = px[i + 1] = px[i + 2] = value;
  }
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL("image/png");
}

/** Invert for a knockout preview on dark surfaces. */
export async function toInvertedUrl(src: string): Promise<string> {
  const img = await loadImage(src);
  const canvas = canvasFrom(img);
  const ctx = canvas.getContext("2d")!;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    px[i] = 255 - px[i];
    px[i + 1] = 255 - px[i + 1];
    px[i + 2] = 255 - px[i + 2];
  }
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL("image/png");
}

/** Genuine downscale — the honest small-size test. */
export async function toSmallUrl(src: string, size = 32): Promise<string> {
  const img = await loadImage(src);
  return canvasFrom(img, size).toDataURL("image/png");
}

export async function toPngBlob(src: string, size?: number): Promise<Blob> {
  const img = await loadImage(src);
  const canvas = canvasFrom(img, size);
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b ?? new Blob()), "image/png"),
  );
}
