import type { NextRequest } from "next/server";
import { jsonError } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Brand typeface files for the stationery kit.
 *
 * The kit's PDFs and Word files embed the recommended typefaces, and the ZIP
 * ships them for installing. Google Fonts serves TrueType to clients that do
 * not advertise WOFF2 support, so the CSS is requested with a plain user agent
 * and the first TTF it names is fetched. Families Google does not have return
 * 404; the generators then fall back to standard fonts.
 */

const FAMILY = /^[A-Za-z0-9 ]{1,60}$/;
const CACHE_LIMIT = 40;
const cache = new Map<string, Uint8Array>();

async function fetchFont(family: string, weight: number): Promise<Uint8Array | null> {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`,
    { headers: { "User-Agent": "Wget/1.21" }, signal: AbortSignal.timeout(10_000) },
  );
  if (!css.ok) return null;
  const url = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/.exec(await css.text())?.[1];
  if (!url) return null;
  const file = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!file.ok) return null;
  return new Uint8Array(await file.arrayBuffer());
}

export async function GET(req: NextRequest) {
  const family = req.nextUrl.searchParams.get("family")?.trim() ?? "";
  const weight = Number(req.nextUrl.searchParams.get("weight") ?? 400);
  if (!FAMILY.test(family) || !Number.isInteger(weight) || weight < 100 || weight > 900 || weight % 100) {
    return jsonError(400, "BAD_REQUEST", "Give a font family and a weight from 100 to 900.");
  }

  const key = `${family.toLowerCase()}:${weight}`;
  let data = cache.get(key);
  if (!data) {
    try {
      data = (await fetchFont(family, weight)) ?? undefined;
    } catch {
      return jsonError(502, "UPSTREAM", "Google Fonts could not be reached.");
    }
    if (!data) return jsonError(404, "NOT_FOUND", `${family} ${weight} is not on Google Fonts.`);
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
    cache.set(key, data);
  }

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "font/ttf",
      "Content-Length": String(data.length),
      "Cache-Control": "private, max-age=86400",
    },
  });
}
