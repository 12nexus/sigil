import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFImage, StandardFonts, rgb, type PDFEmbeddedPage, type PDFFont, type PDFPage } from "pdf-lib";
import { addressLines, displayWebsite, hexToRgb, type Brand, type LogoImage } from "./brand";

/**
 * Print PDFs: business cards and envelopes.
 *
 * Sizes follow the paper setting: A4 regions get 85 × 55 mm cards and DL
 * envelopes, Letter regions 3.5 × 2 in cards and #10 envelopes. Cards carry
 * bleed with the TrimBox and BleedBox set, which is what online printers ask
 * for. Brand typefaces are embedded when Google Fonts has them; otherwise
 * Helvetica stands in.
 */

const MM = 72 / 25.4;
const IN = 72;

const colour = (hex: string) => {
  const [r, g, b] = hexToRgb(hex);
  return rgb(r / 255, g / 255, b / 255);
};

interface Fonts {
  heading: PDFFont;
  body: PDFFont;
  bodyBold: PDFFont;
  /** Standard fonts only encode WinAnsi; anything else must be dropped first. */
  standard: boolean;
}

async function embedFonts(doc: PDFDocument, brand: Brand): Promise<Fonts> {
  doc.registerFontkit(fontkit);
  const tryEmbed = async (bytes: Uint8Array | null) => {
    if (!bytes) return null;
    try {
      // Full embedding: subsetting breaks glyphs in some fonts.
      return await doc.embedFont(bytes, { subset: false });
    } catch {
      return null;
    }
  };
  const body = await tryEmbed(brand.body.regular);
  const bodyBold = (await tryEmbed(brand.body.bold)) ?? body;
  const heading = (await tryEmbed(brand.heading.display)) ?? (await tryEmbed(brand.heading.bold)) ?? bodyBold;
  if (body && bodyBold && heading) return { heading, body, bodyBold, standard: false };

  return {
    heading: await doc.embedFont(StandardFonts.HelveticaBold),
    body: await doc.embedFont(StandardFonts.Helvetica),
    bodyBold: await doc.embedFont(StandardFonts.HelveticaBold),
    standard: true,
  };
}

function text(fonts: Fonts, value: string): string {
  // Typographic punctuation is in WinAnsi; other scripts are not.
  return fonts.standard ? value.replace(/[^\x20-\x7E -ÿ–—‘’“”•…]/g, "") : value;
}

/** Draw text, shrinking it to fit `maxWidth`. Returns the size used. */
function fitText(
  page: PDFPage,
  font: PDFFont,
  value: string,
  opts: { x: number; y: number; size: number; maxWidth: number; colour: string; align?: "left" | "right" },
): number {
  let size = opts.size;
  while (size > 4 && font.widthOfTextAtSize(value, size) > opts.maxWidth) size -= 0.25;
  const width = font.widthOfTextAtSize(value, size);
  page.drawText(value, {
    x: opts.align === "right" ? opts.x - width : opts.x,
    y: opts.y,
    size,
    font,
    color: colour(opts.colour),
  });
  return size;
}

interface Placed {
  art: PDFImage | PDFEmbeddedPage;
  width: number;
  height: number;
}

/** Embed a logo: its vector trace as a PDF page when there is one, else the PNG. */
async function embedLogo(doc: PDFDocument, logo: LogoImage): Promise<Placed> {
  if (logo.vector) {
    try {
      const [page] = await doc.embedPdf(logo.vector.pdf, [0]);
      return { art: page, width: page.width, height: page.height };
    } catch {
      // Fall through to the image.
    }
  }
  return { art: await doc.embedPng(logo.png), width: logo.width, height: logo.height };
}

/** Fit a logo inside a box: centred on (cx, cy), or with its left edge at `left`. */
function drawLogo(page: PDFPage, logo: Placed, box: { cx: number; cy: number; w: number; h: number; left?: number }) {
  const scale = Math.min(box.w / logo.width, box.h / logo.height);
  const w = logo.width * scale;
  const h = logo.height * scale;
  const at = { x: box.left ?? box.cx - w / 2, y: box.cy - h / 2, width: w, height: h };
  if (logo.art instanceof PDFImage) page.drawImage(logo.art, at);
  else page.drawPage(logo.art, at);
  return at;
}

/* ------------------------------------------------------------------ */
/* Business cards                                                      */
/* ------------------------------------------------------------------ */

interface CardPerson {
  name: string;
  title: string;
  phone: string;
  email: string;
}

/** One PDF per person: page 1 is the front, page 2 the back. */
export async function businessCardPdf(brand: Brand, person: CardPerson): Promise<Uint8Array> {
  const letter = brand.details.paper === "letter";
  const trimW = letter ? 3.5 * IN : 85 * MM;
  const trimH = letter ? 2 * IN : 55 * MM;
  const bleed = letter ? 0.125 * IN : 3 * MM;
  const safe = letter ? 0.1875 * IN : 5 * MM;
  const pageW = trimW + bleed * 2;
  const pageH = trimH + bleed * 2;
  const { colours, details } = brand;

  const doc = await PDFDocument.create();
  doc.setTitle(`${brand.companyName} business card${person.name ? ` — ${person.name}` : ""}`);
  doc.setCreator("SIGIL");
  const fonts = await embedFonts(doc, brand);
  const reversed = await embedLogo(doc, brand.logos.reversed);
  const symbol = await embedLogo(doc, brand.logos.symbol);

  const setBoxes = (page: PDFPage) => {
    page.setBleedBox(0, 0, pageW, pageH);
    page.setTrimBox(bleed, bleed, trimW, trimH);
  };

  // Front: the reversed logo, centred on the dark brand colour.
  const front = doc.addPage([pageW, pageH]);
  setBoxes(front);
  front.drawRectangle({ x: 0, y: 0, width: pageW, height: pageH, color: colour(colours.dark) });
  drawLogo(front, reversed, {
    cx: pageW / 2,
    cy: pageH / 2,
    w: trimW * 0.6,
    h: trimH * 0.42,
  });

  // Back: contact details on white, the symbol top right, a brand bar at the foot.
  const back = doc.addPage([pageW, pageH]);
  setBoxes(back);
  back.drawRectangle({ x: 0, y: 0, width: pageW, height: pageH, color: rgb(1, 1, 1) });
  const barH = (letter ? 0.07 * IN : 2 * MM) + bleed;
  back.drawRectangle({ x: 0, y: 0, width: pageW, height: barH, color: colour(colours.brand) });

  const left = bleed + safe;
  const top = bleed + trimH - safe;
  const symbolSize = trimH * 0.24;
  drawLogo(back, symbol, {
    cx: bleed + trimW - safe - symbolSize / 2,
    cy: top - symbolSize / 2,
    w: symbolSize,
    h: symbolSize,
  });
  const textWidth = trimW - safe * 2 - symbolSize - 3 * MM;

  let y = top - 9;
  if (person.name.trim()) {
    fitText(back, fonts.heading, text(fonts, person.name.trim()), {
      x: left, y, size: 10.5, maxWidth: textWidth, colour: colours.ink,
    });
    y -= 10.5;
  } else {
    fitText(back, fonts.heading, text(fonts, brand.companyName), {
      x: left, y, size: 10.5, maxWidth: textWidth, colour: colours.ink,
    });
    y -= 10.5;
  }
  if (person.title.trim()) {
    fitText(back, fonts.body, text(fonts, person.title.trim()), {
      x: left, y, size: 7.5, maxWidth: textWidth, colour: colours.brand,
    });
  }

  // Contact block, bottom-aligned above the bar.
  const lines = [
    person.phone.trim() || details.phone.trim(),
    person.email.trim() || details.email.trim(),
    displayWebsite(details.website),
    ...addressLines(details),
  ].filter(Boolean);
  const leading = 8.6;
  let cy = barH + safe * 0.7 + (lines.length - 1) * leading;
  for (const line of lines) {
    fitText(back, fonts.body, text(fonts, line), {
      x: left, y: cy, size: 6.8, maxWidth: trimW - safe * 2, colour: colours.ink,
    });
    cy -= leading;
  }

  return doc.save();
}

/* ------------------------------------------------------------------ */
/* Envelope                                                            */
/* ------------------------------------------------------------------ */

/** DL (220 × 110 mm) or #10 (9.5 × 4.125 in), logo and return address top left. */
export async function envelopePdf(brand: Brand): Promise<Uint8Array> {
  const letter = brand.details.paper === "letter";
  const w = letter ? 9.5 * IN : 220 * MM;
  const h = letter ? 4.125 * IN : 110 * MM;
  const margin = letter ? 0.5 * IN : 12 * MM;
  const { colours, details } = brand;

  const doc = await PDFDocument.create();
  doc.setTitle(`${brand.companyName} envelope (${letter ? "#10" : "DL"})`);
  doc.setCreator("SIGIL");
  const fonts = await embedFonts(doc, brand);
  const logo = await embedLogo(doc, brand.logos.wide);

  const page = doc.addPage([w, h]);
  const logoH = letter ? 0.42 * IN : 11 * MM;
  const drawn = drawLogo(page, logo, { left: margin, cx: 0, cy: h - margin - logoH / 2, w: w * 0.32, h: logoH });

  let y = drawn.y - 14;
  for (const line of addressLines(details)) {
    fitText(page, fonts.body, text(fonts, line), { x: margin, y, size: 8, maxWidth: w * 0.4, colour: colours.muted });
    y -= 10;
  }

  // A short brand rule along the bottom edge, clear of the address window.
  page.drawRectangle({ x: 0, y: 0, width: w, height: letter ? 0.06 * IN : 1.5 * MM, color: colour(colours.brand) });

  return doc.save();
}

/* ------------------------------------------------------------------ */
/* Compliment slip                                                     */
/* ------------------------------------------------------------------ */

/** A third of the page (DL / one-third Letter): logo, "With compliments", contact line. */
export async function complimentSlipPdf(brand: Brand): Promise<Uint8Array> {
  const letter = brand.details.paper === "letter";
  const w = letter ? 8.5 * IN : 210 * MM;
  const h = letter ? (11 / 3) * IN : 99 * MM;
  const margin = letter ? 0.6 * IN : 15 * MM;
  const { colours, details } = brand;

  const doc = await PDFDocument.create();
  doc.setTitle(`${brand.companyName} compliment slip`);
  doc.setCreator("SIGIL");
  const fonts = await embedFonts(doc, brand);
  const logo = await embedLogo(doc, brand.logos.wide);

  const page = doc.addPage([w, h]);
  const logoH = letter ? 0.5 * IN : 13 * MM;
  drawLogo(page, logo, { left: margin, cx: 0, cy: h - margin - logoH / 2, w: w * 0.35, h: logoH });

  fitText(page, fonts.heading, text(fonts, "With compliments"), {
    x: w - margin, y: h - margin - 16, size: 15, maxWidth: w * 0.45, colour: colours.brand, align: "right",
  });

  const footer = [addressLines(details).join(", "), [details.phone, details.email, displayWebsite(details.website)].filter((s) => s.trim()).join("   ")]
    .map((s) => s.trim())
    .filter(Boolean);
  let y = margin + (footer.length - 1) * 11;
  for (const line of footer) {
    fitText(page, fonts.body, text(fonts, line), { x: margin, y, size: 8, maxWidth: w - margin * 2, colour: colours.muted });
    y -= 11;
  }
  page.drawRectangle({ x: margin, y: margin + footer.length * 11 + 2, width: w - margin * 2, height: 0.75, color: colour(colours.brand) });

  return doc.save();
}
