import ExcelJS from "exceljs";
import { addressLines, displayWebsite, type Brand } from "./brand";

/**
 * The invoice as an Excel workbook, because an invoice is arithmetic: line
 * amounts, the subtotal, tax and total are formulas, so filling in quantities
 * and rates is all it takes. Opens in Excel, Numbers and Google Sheets, and
 * prints to one page.
 */

const argb = (hex: string) => `FF${hex.replace("#", "").toUpperCase()}`;
const LINE_ROWS = 12;

export async function invoiceXlsx(brand: Brand): Promise<Uint8Array> {
  const { colours, details } = brand;
  const wb = new ExcelJS.Workbook();
  wb.creator = brand.companyName;
  wb.title = `${brand.companyName} invoice`;

  const ws = wb.addWorksheet("Invoice", {
    properties: { defaultRowHeight: 18 },
    views: [{ showGridLines: false }],
    pageSetup: {
      // PaperSize is a const enum, which isolated modules cannot read: Letter is 1, A4 is 9.
      paperSize: (details.paper === "letter" ? 1 : 9) as ExcelJS.PageSetup["paperSize"],
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      horizontalCentered: true,
      margins: { left: 0.6, right: 0.6, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
    },
  });
  ws.columns = [
    { key: "a", width: 3 },
    { key: "desc", width: 46 },
    { key: "qty", width: 10 },
    { key: "rate", width: 14 },
    { key: "amount", width: 16 },
    { key: "f", width: 3 },
  ];

  const font = (opts: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> => ({
    name: brand.body.family,
    size: 10,
    color: { argb: argb(colours.ink) },
    ...opts,
  });
  const heading = (opts: Partial<ExcelJS.Font> = {}) => font({ name: brand.heading.family, bold: true, ...opts });
  const muted = (opts: Partial<ExcelJS.Font> = {}) => font({ color: { argb: argb(colours.muted) }, size: 9, ...opts });
  const set = (ref: string, value: ExcelJS.CellValue, f: Partial<ExcelJS.Font>, align?: Partial<ExcelJS.Alignment>) => {
    const cell = ws.getCell(ref);
    cell.value = value;
    cell.font = f;
    if (align) cell.alignment = align;
    return cell;
  };
  const right = { horizontal: "right" } as const;

  // Brand bar across the top.
  ws.getRow(1).height = 8;
  for (const col of ["A", "B", "C", "D", "E", "F"]) {
    ws.getCell(`${col}1`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(colours.brand) } };
  }

  // Logo, top left. Image sizes are in pixels; rows 3–6 are 18pt each.
  const logo = brand.logos.wide;
  const logoH = 64;
  const logoW = Math.min(300, (logo.width / logo.height) * logoH);
  const imageId = wb.addImage({ buffer: logo.png as unknown as ExcelJS.Buffer, extension: "png" });
  ws.addImage(imageId, {
    tl: { col: 1, row: 2.2 },
    ext: { width: logoW, height: (logo.height / logo.width) * logoW },
    editAs: "oneCell",
  });

  // Company details, top right.
  const companyLines = [
    brand.companyName,
    ...addressLines(details),
    details.phone.trim(),
    details.email.trim(),
    displayWebsite(details.website),
  ].filter(Boolean);
  companyLines.forEach((line, i) => {
    ws.mergeCells(`C${3 + i}:E${3 + i}`);
    set(`C${3 + i}`, line, i === 0 ? heading({ size: 11 }) : muted(), right);
  });

  let r = Math.max(9, 4 + companyLines.length);
  set(`B${r}`, "INVOICE", heading({ size: 22, color: { argb: argb(colours.brand) } }));
  ws.getRow(r).height = 32;
  r += 2;

  // Bill to (left) and invoice facts (right).
  const factsTop = r;
  set(`B${r}`, "BILL TO", heading({ size: 9, color: { argb: argb(colours.muted) } }));
  ["Client Name", "Company", "Street Address", "City, Postcode", "client@example.com"].forEach((line, i) => {
    set(`B${r + 1 + i}`, line, font());
  });
  const today = new Date();
  const due = new Date(today.getTime() + 30 * 86_400_000);
  const facts: Array<[string, ExcelJS.CellValue, string?]> = [
    ["Invoice no.", "INV-0001"],
    ["Date", today, "d mmm yyyy"],
    ["Due date", due, "d mmm yyyy"],
    ["Reference", "PO / project"],
  ];
  facts.forEach(([label, value, fmt], i) => {
    ws.mergeCells(`C${factsTop + 1 + i}:D${factsTop + 1 + i}`);
    set(`C${factsTop + 1 + i}`, label, muted(), right);
    const cell = set(`E${factsTop + 1 + i}`, value, font({ bold: i === 0 }), right);
    if (fmt) cell.numFmt = fmt;
  });
  r = factsTop + 7;

  // Line items.
  const head = r;
  const headers: Array<[string, string]> = [
    ["B", "Description"],
    ["C", "Qty"],
    ["D", "Rate"],
    ["E", "Amount"],
  ];
  ws.getRow(head).height = 22;
  for (const [col, label] of headers) {
    const cell = set(`${col}${head}`, label, heading({ size: 10, color: { argb: "FFFFFFFF" } }), {
      horizontal: col === "B" ? "left" : "right",
      vertical: "middle",
      indent: col === "B" ? 1 : 0,
    });
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(colours.brand) } };
  }
  const money = "#,##0.00";
  const thin = { style: "thin", color: { argb: "FFE2E2E2" } } as const;
  for (let i = 0; i < LINE_ROWS; i++) {
    const row = head + 1 + i;
    ws.getRow(row).height = 20;
    set(`B${row}`, i === 0 ? "Service or product description" : null, font(), { indent: 1, vertical: "middle" });
    set(`C${row}`, i === 0 ? 1 : null, font(), { horizontal: "right", vertical: "middle" });
    const rate = set(`D${row}`, i === 0 ? 0 : null, font(), { horizontal: "right", vertical: "middle" });
    rate.numFmt = money;
    const amount = set(
      `E${row}`,
      { formula: `IF(OR(C${row}="",D${row}=""),"",C${row}*D${row})` } as ExcelJS.CellFormulaValue,
      font(),
      { horizontal: "right", vertical: "middle" },
    );
    amount.numFmt = money;
    for (const col of ["B", "C", "D", "E"]) ws.getCell(`${col}${row}`).border = { bottom: thin };
  }
  r = head + LINE_ROWS + 2;

  // Totals.
  const first = head + 1;
  const last = head + LINE_ROWS;
  ws.mergeCells(`C${r}:D${r}`);
  set(`C${r}`, "Subtotal", muted({ size: 10 }), right);
  set(`E${r}`, { formula: `SUM(E${first}:E${last})` } as ExcelJS.CellFormulaValue, font(), right).numFmt = money;
  ws.mergeCells(`C${r + 1}:D${r + 1}`);
  set(`C${r + 1}`, "Tax rate", muted({ size: 10 }), right);
  set(`E${r + 1}`, 0, font(), right).numFmt = "0.0%";
  ws.mergeCells(`C${r + 2}:D${r + 2}`);
  set(`C${r + 2}`, "Tax", muted({ size: 10 }), right);
  set(`E${r + 2}`, { formula: `E${r}*E${r + 1}` } as ExcelJS.CellFormulaValue, font(), right).numFmt = money;
  ws.mergeCells(`C${r + 3}:D${r + 3}`);
  ws.getRow(r + 3).height = 24;
  const totalLabel = set(`C${r + 3}`, "Total due", heading({ size: 11 }), { horizontal: "right", vertical: "middle" });
  const total = set(
    `E${r + 3}`,
    { formula: `E${r}+E${r + 2}` } as ExcelJS.CellFormulaValue,
    heading({ size: 12, color: { argb: argb(colours.brand) } }),
    { horizontal: "right", vertical: "middle" },
  );
  total.numFmt = money;
  for (const cell of [totalLabel, total, ws.getCell(`D${r + 3}`)]) {
    cell.border = { top: { style: "medium", color: { argb: argb(colours.brand) } } };
  }

  // Payment details and notes.
  r += 6;
  set(`B${r}`, "PAYMENT DETAILS", heading({ size: 9, color: { argb: argb(colours.muted) } }));
  const payment = details.paymentDetails.trim()
    ? details.paymentDetails.split("\n").map((l) => l.trim()).filter(Boolean)
    : ["Bank name", "Account name", "Account number / IBAN", "Sort code / SWIFT"];
  payment.forEach((line, i) => set(`B${r + 1 + i}`, line, font()));
  r += payment.length + 2;
  set(`B${r}`, "Payment is due within 30 days. Thank you for your business.", muted({ italic: true }));

  // Footer rule.
  r += 2;
  for (const col of ["B", "C", "D", "E"]) {
    ws.getCell(`${col}${r}`).border = { top: { style: "thin", color: { argb: argb(colours.brand) } } };
  }
  ws.mergeCells(`B${r}:E${r}`);
  set(`B${r}`, [brand.companyName, displayWebsite(details.website)].filter(Boolean).join("  ·  "), muted(), {
    horizontal: "center",
  });

  ws.pageSetup.printArea = `A1:F${r}`;
  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}
