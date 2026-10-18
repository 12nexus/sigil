import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  LineRuleType,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  convertMillimetersToTwip,
  type IPropertiesOptions,
  type IParagraphOptions,
} from "docx";
import { addressLine, displayWebsite, type Brand, type LogoImage } from "./brand";

type FontOptions = NonNullable<IPropertiesOptions["fonts"]>[number];

/**
 * The letterhead as an editable Word document.
 *
 * The first page carries the full letterhead (logo, contact details, footer);
 * continuation pages a small logo and page number. Body text is set in the
 * brand's body typeface through the document's default style, so whatever the
 * user types stays on brand. Both typefaces are embedded when available, so the
 * file looks right on machines that do not have them installed.
 */

/** docx sizes images in pixels at 96 dpi. */
const PX_PER_MM = 96 / 25.4;

const hex = (value: string) => value.replace("#", "");

function logoRun(logo: LogoImage, heightMm: number, maxWidthMm: number): ImageRun {
  const scale = Math.min((heightMm * PX_PER_MM) / logo.height, (maxWidthMm * PX_PER_MM) / logo.width);
  const common = {
    transformation: { width: Math.round(logo.width * scale), height: Math.round(logo.height * scale) },
    altText: { name: "Logo", title: "Logo", description: "Company logo" },
  };
  // The vector logo where there is one; Word versions without SVG support show the PNG.
  return logo.vector
    ? new ImageRun({
        type: "svg",
        data: new TextEncoder().encode(logo.vector.svg),
        fallback: { type: "png", data: logo.png },
        ...common,
      })
    : new ImageRun({ type: "png", data: logo.png, ...common });
}

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } as const;
const NO_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER } as const;

export function embeddedFonts(brand: Brand): FontOptions[] {
  const fonts: FontOptions[] = [];
  for (const face of [brand.heading, brand.body]) {
    if (!face.regular || fonts.some((f) => f.name === face.family)) continue;
    fonts.push({
      name: face.family,
      data: face.regular as unknown as Buffer,
      ...(face.bold ? { bold: face.bold as unknown as Buffer } : {}),
    });
  }
  return fonts;
}

/** Page geometry in twips for the chosen paper. */
export function pageGeometry(paper: "a4" | "letter") {
  return paper === "letter"
    ? { width: 12240, height: 15840, side: 1440 }
    : { width: 11906, height: 16838, side: convertMillimetersToTwip(22) };
}

export function documentStyles(brand: Brand) {
  return {
    default: {
      document: {
        run: { font: brand.body.family, size: 21, color: hex(brand.colours.ink) },
        paragraph: { spacing: { after: 160, line: 288, lineRule: LineRuleType.AUTO } },
      },
      heading1: {
        run: { font: brand.heading.family, size: 32, bold: true, color: hex(brand.colours.brand) },
        paragraph: { spacing: { before: 240, after: 160 } },
      },
      heading2: {
        run: { font: brand.heading.family, size: 24, bold: true, color: hex(brand.colours.ink) },
        paragraph: { spacing: { before: 200, after: 120 } },
      },
    },
  };
}

export async function letterheadDocx(brand: Brand): Promise<Blob> {
  const { colours, details } = brand;
  const page = pageGeometry(details.paper);
  const contentWidth = page.width - page.side * 2;
  const signer = details.people.find((p) => p.name.trim());

  const small = (text: string, opts: { colour?: string; bold?: boolean } = {}) =>
    new TextRun({ text, size: 16, color: hex(opts.colour ?? colours.muted), bold: opts.bold });

  const contactLines = [details.phone.trim(), details.email.trim(), displayWebsite(details.website)].filter(Boolean);

  const firstHeader = new Header({
    children: [
      new Table({
        width: { size: contentWidth, type: WidthType.DXA },
        columnWidths: [Math.round(contentWidth * 0.6), Math.round(contentWidth * 0.4)],
        borders: { ...NO_BORDERS, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                borders: NO_BORDERS,
                verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({ children: [logoRun(brand.logos.wide, 16, 80)] })],
              }),
              new TableCell({
                borders: NO_BORDERS,
                verticalAlign: VerticalAlign.CENTER,
                children: (contactLines.length ? contactLines : [""]).map(
                  (line) =>
                    new Paragraph({
                      alignment: AlignmentType.RIGHT,
                      spacing: { after: 0, line: 240, lineRule: LineRuleType.AUTO },
                      children: [small(line)],
                    }),
                ),
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const laterHeader = new Header({
    children: [new Paragraph({ children: [logoRun(brand.logos.wide, 9, 45)] })],
  });

  const rule: IParagraphOptions["border"] = {
    top: { style: BorderStyle.SINGLE, size: 8, color: hex(colours.brand), space: 6 },
  };
  const footerLine = [brand.companyName, addressLine(details)].filter(Boolean).join("  ·  ");

  const firstFooter = new Footer({
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, border: rule, spacing: { after: 0 }, children: [small(footerLine)] }),
    ],
  });
  const laterFooter = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        border: rule,
        spacing: { after: 0 },
        children: [small(`${brand.companyName}  ·  Page `), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: hex(colours.muted) })],
      }),
    ],
  });

  const date = new Date().toLocaleDateString(details.paper === "letter" ? "en-US" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const p = (text: string, opts: IParagraphOptions = {}) => new Paragraph({ ...opts, children: [new TextRun(text)] });
  const tight = { spacing: { after: 0 } };

  const body = [
    p(date, { spacing: { after: 360 } }),
    p("Recipient Name", tight),
    p("Job Title", tight),
    p("Company", tight),
    p("Street Address", tight),
    p("City, Postcode", { spacing: { after: 360 } }),
    new Paragraph({ children: [new TextRun({ text: "Subject line", bold: true })] }),
    p("Dear Recipient Name,"),
    p(
      "Type your letter here. This document is set up with the letterhead in the header and footer, so you only ever edit the body: the date, the recipient and the letter itself. The body text uses the brand typeface at 10.5 point.",
    ),
    p(
      "Further pages pick up a smaller version of the letterhead and a page number automatically. Save a copy for each letter and keep this file as the master.",
    ),
    p("Kind regards,", { spacing: { before: 240, after: 720 } }),
    new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: signer?.name || "Your Name", bold: true })] }),
    new Paragraph({
      children: [new TextRun({ text: signer?.title || "Job Title", color: hex(colours.muted) })],
    }),
  ];

  const doc = new Document({
    creator: brand.companyName,
    title: `${brand.companyName} letterhead`,
    fonts: embeddedFonts(brand),
    styles: documentStyles(brand),
    sections: [
      {
        properties: {
          titlePage: true,
          page: {
            size: { width: page.width, height: page.height },
            margin: {
              top: convertMillimetersToTwip(42),
              bottom: convertMillimetersToTwip(28),
              left: page.side,
              right: page.side,
              header: convertMillimetersToTwip(12),
              footer: convertMillimetersToTwip(10),
            },
          },
        },
        headers: { first: firstHeader, default: laterHeader },
        footers: { first: firstFooter, default: laterFooter },
        children: body,
      },
    ],
  });

  return Packer.toBlob(doc);
}
