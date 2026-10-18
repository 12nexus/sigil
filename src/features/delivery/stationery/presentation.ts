import PptxGenJS from "pptxgenjs";
import { addressLine, contrast, displayWebsite, type Brand, type LogoImage } from "./brand";

/**
 * A PowerPoint template: four slide masters (title, section, content,
 * closing) built on the brand colours and typefaces, and a short sample deck
 * that uses each one. New slides added in PowerPoint pick from the same
 * masters, so the deck stays on brand as it grows.
 */

const W = 13.333;
const H = 7.5;
const hex = (value: string) => value.replace("#", "").toUpperCase();

export function base64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** An image object fitted inside a box, aligned left or centred. */
function logoObject(logo: LogoImage, box: { x: number; y: number; w: number; h: number }, align: "left" | "center" | "right") {
  const scale = Math.min(box.w / logo.width, box.h / logo.height);
  const w = logo.width * scale;
  const h = logo.height * scale;
  const x = align === "left" ? box.x : align === "right" ? box.x + box.w - w : box.x + (box.w - w) / 2;
  return { image: { x, y: box.y + (box.h - h) / 2, w, h, data: `image/png;base64,${base64(logo.png)}` } };
}

export async function presentationPptx(brand: Brand): Promise<Uint8Array> {
  const { colours, details } = brand;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.company = brand.companyName;
  pptx.title = `${brand.companyName} presentation template`;
  pptx.theme = { headFontFace: brand.heading.family, bodyFontFace: brand.body.family };

  const heading = { fontFace: brand.heading.family, bold: true, align: "left" as const };
  const body = { fontFace: brand.body.family, align: "left" as const };
  const margin = 0.7;

  pptx.defineSlideMaster({
    title: "Title",
    background: { color: hex(colours.dark) },
    objects: [
      logoObject(brand.logos.wideReversed, { x: margin, y: 0.6, w: 3.4, h: 0.75 }, "left"),
      { rect: { x: margin, y: 5.9, w: 1.1, h: 0.08, fill: { color: hex(contrast(colours.accent, colours.dark) >= 2 ? colours.accent : "#FFFFFF") } } },
      {
        placeholder: {
          options: { name: "title", type: "title", x: margin, y: 2.5, w: W - margin * 2, h: 1.6, ...heading, fontSize: 44, color: "FFFFFF", valign: "bottom" },
          text: "",
        },
      },
      {
        placeholder: {
          options: { name: "subtitle", type: "body", x: margin, y: 4.2, w: W - margin * 2, h: 1.2, ...body, fontSize: 20, color: "D9D9D9", valign: "top" },
          text: "",
        },
      },
    ],
  });

  pptx.defineSlideMaster({
    title: "Section",
    background: { color: hex(colours.dark) },
    objects: [
      logoObject(brand.logos.symbolReversed, { x: W - margin - 0.9, y: H - margin - 0.9, w: 0.9, h: 0.9 }, "right"),
      {
        placeholder: {
          options: { name: "title", type: "title", x: margin, y: 2.6, w: W - margin * 2, h: 1.6, ...heading, fontSize: 40, color: "FFFFFF", valign: "middle" },
          text: "",
        },
      },
    ],
  });

  pptx.defineSlideMaster({
    title: "Content",
    background: { color: "FFFFFF" },
    objects: [
      logoObject(brand.logos.wide, { x: W - margin - 2.2, y: 0.45, w: 2.2, h: 0.42 }, "right"),
      { rect: { x: 0, y: H - 0.12, w: W, h: 0.12, fill: { color: hex(colours.brand) } } },
      { text: { text: brand.companyName, options: { x: margin, y: H - 0.62, w: 6, h: 0.3, ...body, fontSize: 10, color: hex(colours.muted) } } },
      {
        placeholder: {
          options: { name: "title", type: "title", x: margin, y: 0.4, w: W - margin * 2 - 2.6, h: 0.9, ...heading, fontSize: 28, color: hex(colours.ink), valign: "middle" },
          text: "",
        },
      },
      {
        placeholder: {
          options: { name: "body", type: "body", x: margin, y: 1.6, w: W - margin * 2, h: 4.9, ...body, fontSize: 18, color: hex(colours.ink), valign: "top" },
          text: "",
        },
      },
    ],
    slideNumber: { x: W - margin - 0.6, y: H - 0.62, w: 0.6, h: 0.3, ...body, fontSize: 10, color: hex(colours.muted), align: "right" },
  });

  pptx.defineSlideMaster({
    title: "Closing",
    background: { color: hex(colours.dark) },
    objects: [
      logoObject(brand.logos.reversed, { x: W / 2 - 2.5, y: 2.2, w: 5, h: 1.6 }, "center"),
      {
        text: {
          text: [addressLine(details), [details.phone, details.email, displayWebsite(details.website)].map((v) => v.trim()).filter(Boolean).join("   ·   ")]
            .filter(Boolean)
            .join("\n"),
          options: { x: margin, y: 5.2, w: W - margin * 2, h: 0.9, ...body, fontSize: 14, color: "D9D9D9", align: "center", valign: "top" },
        },
      },
    ],
  });

  const title = pptx.addSlide({ masterName: "Title" });
  title.addText("Presentation title", { placeholder: "title" });
  title.addText(details.tagline.trim() || "Subtitle, presenter name or date", { placeholder: "subtitle" });

  const agenda = pptx.addSlide({ masterName: "Content" });
  agenda.addText("Agenda", { placeholder: "title" });
  agenda.addText(
    ["Where we are", "What we propose", "How it works", "Next steps"].map((t) => ({ text: t, options: { bullet: true } })),
    { placeholder: "body" },
  );

  const section = pptx.addSlide({ masterName: "Section" });
  section.addText("Section title", { placeholder: "title" });

  const content = pptx.addSlide({ masterName: "Content" });
  content.addText("Slide title", { placeholder: "title" });
  content.addText(
    [
      { text: "Use the Content layout for most slides. Titles and body text are set in the brand typefaces.", options: { bullet: true } },
      { text: "Add new slides from Home → New Slide and pick one of the four layouts.", options: { bullet: true } },
      { text: "Keep the brand colours for emphasis rather than large fills.", options: { bullet: true } },
    ],
    { placeholder: "body" },
  );

  pptx.addSlide({ masterName: "Closing" });

  return (await pptx.write({ outputType: "uint8array" })) as Uint8Array;
}
