import type { StationeryPerson } from "@/types";
import { displayWebsite, websiteHref, type Brand } from "./brand";

/**
 * Email signatures, one per person, all in one HTML page with copy
 * instructions. Mail clients only keep inline styles and tables, so that is
 * all the signature uses. The logo is linked from a public URL when one is set;
 * otherwise it is embedded, which Outlook and Apple Mail accept but Gmail
 * does not.
 */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Display height of the signature logo, in CSS pixels. */
export const SIGNATURE_LOGO_HEIGHT = 48;

export function signatureHtml(
  brand: Brand,
  person: Pick<StationeryPerson, "name" | "title" | "phone" | "email">,
  logoSrc: string,
  logoSize: { width: number; height: number },
): string {
  const { colours, details } = brand;
  const font = `'${esc(brand.body.family)}', Arial, Helvetica, sans-serif`;
  const phone = person.phone.trim() || details.phone.trim();
  const email = person.email.trim() || details.email.trim();
  const website = details.website.trim();
  const link = `color:${colours.ink};text-decoration:none;`;

  const contact = [
    phone ? `<a href="tel:${esc(phone.replace(/[^+\d]/g, ""))}" style="${link}">${esc(phone)}</a>` : "",
    email ? `<a href="mailto:${esc(email)}" style="${link}">${esc(email)}</a>` : "",
    website ? `<a href="${esc(websiteHref(website))}" style="color:${colours.brand};text-decoration:none;">${esc(displayWebsite(website))}</a>` : "",
  ].filter(Boolean);

  return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:${font};color:${colours.ink};">
  <tr>
    <td style="padding:0 14px 0 0;border-right:2px solid ${colours.brand};vertical-align:middle;">
      <img src="${esc(logoSrc)}" width="${logoSize.width}" height="${logoSize.height}" alt="${esc(brand.companyName)}" style="display:block;border:0;width:${logoSize.width}px;height:${logoSize.height}px;">
    </td>
    <td style="padding:0 0 0 14px;vertical-align:middle;">
      <div style="font-size:14px;font-weight:bold;line-height:20px;color:${colours.ink};">${esc(person.name.trim() || brand.companyName)}</div>
      ${person.title.trim() ? `<div style="font-size:12px;line-height:18px;color:${colours.brand};">${esc(person.title.trim())}</div>` : ""}
      ${contact.length ? `<div style="font-size:12px;line-height:18px;color:${colours.muted};">${contact.join(` <span style="color:${colours.muted};">&nbsp;|&nbsp;</span> `)}</div>` : ""}
    </td>
  </tr>
</table>`;
}

export function signaturePage(brand: Brand, blocks: Array<{ name: string; html: string }>, embedded: boolean): string {
  const note = embedded
    ? `<p class="warn">The logo is embedded in these signatures. Outlook and Apple Mail keep it; <strong>Gmail does not</strong>. For Gmail, upload <code>logo.png</code> (in this folder) to your website, put its address in SIGIL under Delivery → Stationery → "Logo URL for email signatures", and download the kit again.</p>`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(brand.companyName)} — email signatures</title>
<style>
  body { font-family: system-ui, sans-serif; color: #222; max-width: 760px; margin: 40px auto; padding: 0 24px; line-height: 1.5; }
  h1 { font-size: 20px; } h2 { font-size: 15px; margin-top: 36px; }
  .sig { border: 1px solid #ddd; border-radius: 8px; padding: 24px; margin: 12px 0; background: #fff; }
  .warn { background: #fff7e0; border: 1px solid #f0d58a; padding: 12px 16px; border-radius: 8px; }
  ol { padding-left: 20px; } code { background: #f2f2f2; padding: 1px 4px; border-radius: 3px; }
</style>
</head>
<body>
<h1>${esc(brand.companyName)} — email signatures</h1>
<p>To install a signature: select everything inside its box (drag from the logo to the last line), copy, and paste it into your mail client's signature editor.</p>
<ol>
  <li><strong>Gmail:</strong> Settings → See all settings → General → Signature → Create new, paste, then Save changes at the bottom.</li>
  <li><strong>Outlook (web and new Outlook):</strong> Settings → Account → Signatures → New signature, paste, Save.</li>
  <li><strong>Apple Mail:</strong> Mail → Settings → Signatures → +, untick "Always match my default message font", paste.</li>
</ol>
${note}
${blocks.map((b) => `<h2>${esc(b.name)}</h2>\n<div class="sig">\n${b.html}\n</div>`).join("\n")}
</body>
</html>
`;
}
