import type { Brand } from "./brand";

export function stationeryReadme(
  brand: Brand,
  facts: { fontsEmbedded: boolean; cardLogoDpi: number | null; signatureEmbedded: boolean },
): string {
  const letter = brand.details.paper === "letter";
  const card = letter ? "3.5 × 2 in" : "85 × 55 mm";
  const bleed = letter ? "0.125 in" : "3 mm";
  const envelope = letter ? "#10 (9.5 × 4.125 in)" : "DL (220 × 110 mm)";
  const paper = letter ? "US Letter" : "A4";

  return `${brand.companyName.toUpperCase()} — STATIONERY KIT
${"=".repeat(brand.companyName.length + 18)}

Ready-to-use files built from the approved logo, the brand colours and the
brand typefaces (${brand.heading.family} for headings, ${brand.body.family} for text).
Paper size: ${paper}.

letterhead/        Word letterhead. Type your letter in the body; the logo,
                   contact details and footer sit in the header and footer.
                   Page 2 onwards gets a smaller header and page numbers.
invoice/           Excel invoice. Fill in quantities and rates; line amounts,
                   subtotal, tax and total are formulas. Prints on one page.
                   Also opens in Google Sheets and Numbers.
business-cards/    Print-ready PDFs, one per person. Page 1 is the front, page
                   2 the back. ${card} with ${bleed} bleed on every side; the
                   trim box is set, so upload them as they are.
envelope/          ${envelope}: logo and return address, for printing on
                   envelopes or sending to a printer.
compliment-slip/   A third-of-a-page compliment slip.
presentation/      PowerPoint template with four layouts (Title, Section,
                   Content, Closing) and a sample deck. Add slides with
                   Home → New Slide → pick a layout. Opens in Google Slides
                   and Keynote too.
email-signature/   Open index.html in a browser and follow the steps on the page.
social-and-video/  Profile pictures (1080 × 1080, safe for circular crops),
                   LinkedIn, X, Facebook and YouTube banners at their exact
                   sizes, a link-preview image, and light and dark backgrounds
                   for Zoom, Teams and Google Meet.
fonts/             The brand typefaces. Install them (double-click → Install)
                   so Word, Excel and PowerPoint show the right fonts.

FONTS
-----
${
  facts.fontsEmbedded
    ? `The PDFs embed the brand typefaces, so they print correctly anywhere.
The Word letterhead embeds them too (Word on Windows and Mac honours this).
Excel and PowerPoint cannot embed fonts: install the files in fonts/ on
every computer that edits the invoice or presentation.`
    : `The brand typefaces are not on Google Fonts, so they could not be
downloaded. The PDFs use Helvetica instead. Word, Excel and PowerPoint name
the brand typefaces and fall back to a default font until they are
installed. Licence the typefaces and install them before printing.`
}

PRINTING
--------
${
  facts.cardLogoDpi === null
    ? `- The business cards, envelope and compliment slip use the vector logo, so
  they print sharp at any size. The letterhead uses it too (Word 2016 and
  later; older versions show a high-resolution image instead).
`
    : `- The logo did not trace cleanly to vector, so the print files use the
  image: on the business cards it prints at about ${facts.cardLogoDpi} dpi.${
        facts.cardLogoDpi < 300 ? " Printers ask for\n  300 dpi: get the logo redrawn as vector artwork before a large print run." : ""
      }
`
}- Colours in the PDFs are RGB. Most online printers convert automatically;
  for offset printing, ask the printer for a CMYK proof.

${
  facts.signatureEmbedded
    ? `EMAIL SIGNATURE
---------------
The logo is embedded in the signatures. Gmail strips embedded images: upload
email-signature/logo.png to your website, enter its address in SIGIL
(Delivery → Stationery → "Logo URL for email signatures") and download again.

`
    : ""
}LOGO ARTWORK
------------
The logos come from the approved AI-generated artwork. Where it traced
cleanly, the print files use the vector trace; the PowerPoint, invoice,
signature and social images use the image, which is right for screens. A
trace reproduces the artwork exactly, including any malformed letters in the
wordmark: check the lettering before a large print run.
`;
}
