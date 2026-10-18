import type { BrandKit, ColorSwatch, Project, StationeryDetails } from "@/types";
import { newId } from "@/utils/id";

/**
 * The brand as the stationery generators see it: a handful of named colours
 * picked from the kit's palette by role, the two typefaces, the logo files and
 * the contact details. Every generator works from this, so the letterhead, the
 * cards and the slides agree with each other.
 */

export interface LogoImage {
  /** Transparent PNG, cropped edge to edge. */
  png: Uint8Array;
  width: number;
  height: number;
  /** The same artwork traced to vector, when it traced cleanly. Print files use this. */
  vector?: { svg: string; pdf: Uint8Array };
}

export interface BrandLogos {
  /** The approved lockup, for light backgrounds. */
  primary: LogoImage;
  /** The widest lockup available, for headers and signatures. */
  wide: LogoImage;
  /** The symbol alone, for icons and avatars. Falls back to the primary. */
  symbol: LogoImage;
  /** The primary lockup in white, for dark backgrounds. */
  reversed: LogoImage;
  /** The wide lockup in white. */
  wideReversed: LogoImage;
  /** The symbol in white, for dark backgrounds. */
  symbolReversed: LogoImage;
}

export interface FontFile {
  family: string;
  /** Weight 400 and 700: the faces Word and PowerPoint know as regular and bold. */
  regular: Uint8Array | null;
  bold: Uint8Array | null;
  /** The weight the kit names, for PDFs and images, which can use any weight. */
  display: Uint8Array | null;
}

export interface BrandColours {
  /** The main brand colour. */
  brand: string;
  /** Text colour. */
  ink: string;
  /** Secondary text. */
  muted: string;
  /** A second colour for small highlights. */
  accent: string;
  /** A light neutral for backgrounds. */
  paper: string;
  /** The background reversed logos sit on: the brand colour if dark enough, else ink. */
  dark: string;
}

export interface Brand {
  companyName: string;
  colours: BrandColours;
  heading: FontFile;
  body: FontFile;
  logos: BrandLogos;
  details: StationeryDetails;
}

/* ------------------------------------------------------------------ */
/* Colour                                                              */
/* ------------------------------------------------------------------ */

export function normaliseHex(value: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!m) return null;
  const hex = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return `#${hex.toUpperCase()}`;
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function saturation(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const out = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/**
 * Pick the stationery colours from the palette. Roles are free text written
 * by the model, so they are read as hints: "primary" wins the brand colour,
 * otherwise the most saturated colour that is neither near-white nor near-black.
 */
export function pickColours(palette: ColorSwatch[]): BrandColours {
  const swatches = palette
    .map((s) => ({ ...s, hex: normaliseHex(s.hex) }))
    .filter((s): s is ColorSwatch & { hex: string } => s.hex !== null);

  const roleOf = (s: ColorSwatch) => `${s.role} ${s.name}`.toLowerCase();
  const chromatic = swatches.filter((s) => {
    const l = luminance(s.hex);
    return l > 0.02 && l < 0.8 && saturation(s.hex) > 0.15;
  });
  const bySaturation = [...chromatic].sort((a, b) => saturation(b.hex) - saturation(a.hex));

  const darkest = [...swatches].sort((a, b) => luminance(a.hex) - luminance(b.hex))[0];
  const lightest = [...swatches].sort((a, b) => luminance(b.hex) - luminance(a.hex))[0];

  const ink = darkest && luminance(darkest.hex) < 0.05 ? darkest.hex : "#1A1A1A";
  const primary =
    swatches.find((s) => /primary|main|core|hero/.test(roleOf(s)) && luminance(s.hex) < 0.8) ??
    bySaturation[0];
  const brand = primary?.hex ?? ink;
  const accent =
    swatches.find((s) => s.hex !== brand && /accent|secondary|highlight/.test(roleOf(s)) && luminance(s.hex) < 0.8)
      ?.hex ??
    bySaturation.find((s) => s.hex !== brand)?.hex ??
    brand;
  const paper = lightest && luminance(lightest.hex) > 0.85 ? lightest.hex : "#F5F5F3";

  return {
    brand,
    ink,
    muted: mix(ink, "#FFFFFF", 0.42),
    accent,
    paper,
    dark: contrast(brand, "#FFFFFF") >= 4.5 ? brand : ink,
  };
}

/* ------------------------------------------------------------------ */
/* Typography                                                          */
/* ------------------------------------------------------------------ */

const WEIGHT_NAMES: Array<[RegExp, number]> = [
  [/thin|hairline/, 100],
  [/extra\s*light|ultra\s*light/, 200],
  [/light/, 300],
  [/medium/, 500],
  [/semi\s*bold|demi\s*bold/, 600],
  [/extra\s*bold|ultra\s*bold/, 800],
  [/black|heavy/, 900],
  [/bold/, 700],
  [/regular|normal|book|roman/, 400],
];

/** "SemiBold 600", "600", "Bold" → 600 / 600 / 700. */
export function parseWeight(text: string | undefined, fallback: number): number {
  if (!text) return fallback;
  const number = /\b([1-9]00)\b/.exec(text);
  if (number) return Number(number[1]);
  const lower = text.toLowerCase();
  return WEIGHT_NAMES.find(([re]) => re.test(lower))?.[1] ?? fallback;
}

/** "Inter, sans-serif" or "Inter (Google Fonts)" → "Inter". */
export function cleanFamily(family: string | undefined): string {
  return (family ?? "").split(/[,(/]/)[0].replace(/["']/g, "").trim();
}

/* ------------------------------------------------------------------ */
/* Details                                                             */
/* ------------------------------------------------------------------ */

function defaultPaper(): "a4" | "letter" {
  if (typeof navigator === "undefined") return "a4";
  return /^en-(US|CA)|^es-(MX|US)|^fr-CA/.test(navigator.language) ? "letter" : "a4";
}

/** Stationery details for a project, starting from what the project already knows. */
export function stationeryDetails(project: Project): StationeryDetails {
  if (project.stationery) return project.stationery;
  return {
    paper: defaultPaper(),
    tagline: project.brief?.company.tagline ?? "",
    address: "",
    phone: "",
    email: project.client.email,
    website: "",
    paymentDetails: "",
    signatureLogoUrl: "",
    people: project.client.contactName
      ? [
          {
            id: newId("person"),
            name: project.client.contactName,
            title: "",
            phone: "",
            email: project.client.email,
          },
        ]
      : [],
  };
}

/** The address on one line, for footers. */
export function addressLine(details: StationeryDetails): string {
  return details.address
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join(", ");
}

export function addressLines(details: StationeryDetails): string[] {
  return details.address
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/** "https://www.acme.com/" → "www.acme.com". */
export function displayWebsite(website: string): string {
  return website.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

export function websiteHref(website: string): string {
  const w = website.trim();
  return /^https?:\/\//i.test(w) ? w : `https://${w}`;
}

/** Company contact lines, in display order, empty ones dropped. */
export function contactParts(details: StationeryDetails): string[] {
  return [addressLine(details), details.phone.trim(), details.email.trim(), displayWebsite(details.website)].filter(
    Boolean,
  );
}

export function kitFonts(kit: BrandKit): { heading: { family: string; weight: number }; body: { family: string } } {
  return {
    heading: {
      family: cleanFamily(kit.typography.primary.family) || "Helvetica",
      weight: parseWeight(kit.typography.primary.weight, 700),
    },
    body: { family: cleanFamily(kit.typography.secondary.family) || cleanFamily(kit.typography.primary.family) || "Helvetica" },
  };
}
