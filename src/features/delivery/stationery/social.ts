import type { Brand, BrandLogos } from "./brand";

/**
 * Images at the exact sizes the platforms ask for: profile pictures, cover
 * banners, a link-preview image and video-call backgrounds. Drawn on a canvas
 * in the browser. Each banner keeps the logo inside the platform's safe area,
 * clear of where the profile picture overlaps or mobile crops the sides.
 */

export interface CanvasAssets {
  logos: Record<keyof BrandLogos, ImageBitmap>;
  /** CSS font-family names registered with document.fonts, or fallbacks. */
  headingFont: string;
  bodyFont: string;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  return { c, ctx };
}

function fit(ctx: CanvasRenderingContext2D, img: ImageBitmap, box: Box, align: "center" | "right" = "center") {
  const scale = Math.min(box.w / img.width, box.h / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  const x = align === "right" ? box.x + box.w - w : box.x + (box.w - w) / 2;
  ctx.drawImage(img, x, box.y + (box.h - h) / 2, w, h);
  return { x, y: box.y + (box.h - h) / 2, w, h };
}

const toPng = (c: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode PNG"))), "image/png"),
  );

/** Dark banner: a faint oversized symbol, the reversed logo in the safe box, the tagline beneath. */
async function banner(brand: Brand, assets: CanvasAssets, w: number, h: number, safe: Box): Promise<Blob> {
  const { c, ctx } = canvas(w, h);
  ctx.fillStyle = brand.colours.dark;
  ctx.fillRect(0, 0, w, h);

  ctx.globalAlpha = 0.045;
  const mark = assets.logos.symbolReversed;
  const markH = h * 1.3;
  ctx.drawImage(mark, -markH * 0.25, (h - markH) / 2, (mark.width / mark.height) * markH, markH);
  ctx.globalAlpha = 1;

  const tagline = brand.details.tagline.trim();
  const logoBox = tagline ? { ...safe, h: safe.h * 0.62 } : safe;
  const drawn = fit(ctx, assets.logos.wideReversed, logoBox);
  if (tagline) {
    let size = Math.round(safe.h * 0.13);
    ctx.font = `${size}px ${assets.bodyFont}`;
    while (size > 10 && ctx.measureText(tagline).width > safe.w) {
      size -= 1;
      ctx.font = `${size}px ${assets.bodyFont}`;
    }
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(tagline, safe.x + safe.w / 2, drawn.y + drawn.h + safe.h * 0.1);
  }

  ctx.fillStyle = brand.colours.brand === brand.colours.dark ? brand.colours.accent : brand.colours.brand;
  ctx.fillRect(0, h - Math.max(4, h * 0.012), w, Math.max(4, h * 0.012));
  return toPng(c);
}

async function profile(brand: Brand, assets: CanvasAssets, dark: boolean): Promise<Blob> {
  const size = 1080;
  const { c, ctx } = canvas(size, size);
  ctx.fillStyle = dark ? brand.colours.dark : "#FFFFFF";
  ctx.fillRect(0, 0, size, size);
  // 56% keeps the symbol inside the circular crop every platform applies.
  const s = size * 0.56;
  fit(ctx, dark ? assets.logos.symbolReversed : assets.logos.symbol, { x: (size - s) / 2, y: (size - s) / 2, w: s, h: s });
  return toPng(c);
}

async function linkPreview(brand: Brand, assets: CanvasAssets): Promise<Blob> {
  const { c, ctx } = canvas(1200, 630);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, 1200, 630);
  fit(ctx, assets.logos.primary, { x: 240, y: 150, w: 720, h: 300 });
  ctx.fillStyle = brand.colours.brand;
  ctx.fillRect(0, 618, 1200, 12);
  return toPng(c);
}

/** Video-call background: logo top right, where it stays clear of the speaker. */
async function callBackground(brand: Brand, assets: CanvasAssets, dark: boolean): Promise<Blob> {
  const { c, ctx } = canvas(1920, 1080);
  const gradient = ctx.createLinearGradient(0, 0, 1920, 1080);
  if (dark) {
    gradient.addColorStop(0, brand.colours.dark);
    gradient.addColorStop(1, shade(brand.colours.dark, -0.35));
  } else {
    gradient.addColorStop(0, "#FFFFFF");
    gradient.addColorStop(1, brand.colours.paper);
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1920, 1080);
  fit(ctx, dark ? assets.logos.reversed : assets.logos.wide, { x: 1920 - 72 - 380, y: 64, w: 380, h: 110 }, "right");
  ctx.fillStyle = brand.colours.brand === brand.colours.dark && dark ? brand.colours.accent : brand.colours.brand;
  ctx.fillRect(0, 1064, 1920, 16);
  return toPng(c);
}

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount),
  );
  return `rgb(${ch.join(",")})`;
}

export async function socialImages(brand: Brand, assets: CanvasAssets): Promise<Array<{ path: string; blob: Blob }>> {
  return [
    { path: "profile-picture.png", blob: await profile(brand, assets, true) },
    { path: "profile-picture-light.png", blob: await profile(brand, assets, false) },
    // The profile picture overlaps the bottom left of LinkedIn and X banners.
    { path: "linkedin-banner-1584x396.png", blob: await banner(brand, assets, 1584, 396, { x: 560, y: 70, w: 900, h: 256 }) },
    { path: "x-header-1500x500.png", blob: await banner(brand, assets, 1500, 500, { x: 520, y: 90, w: 860, h: 300 }) },
    // Facebook crops the sides on mobile.
    { path: "facebook-cover-1640x624.png", blob: await banner(brand, assets, 1640, 624, { x: 420, y: 130, w: 800, h: 330 }) },
    // YouTube's safe area for every device is the centred 1546 × 423.
    { path: "youtube-banner-2560x1440.png", blob: await banner(brand, assets, 2560, 1440, { x: 507, y: 509, w: 1546, h: 423 }) },
    { path: "link-preview-1200x630.png", blob: await linkPreview(brand, assets) },
    { path: "video-call-background-light.png", blob: await callBackground(brand, assets, false) },
    { path: "video-call-background-dark.png", blob: await callBackground(brand, assets, true) },
  ];
}
