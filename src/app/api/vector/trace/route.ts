import type { NextRequest } from "next/server";
import { jsonError } from "@/server/http";
import {
  TraceFailedError,
  VectorUnavailableError,
  traceLogo,
  type VectorVariant,
} from "@/server/vectorcraft";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST a transparent logo PNG; get back its vector trace as SVG, PDF and EPS (base64), in the
 * colour, white and black versions asked for (`?variants=colour,white,black`).
 * `?ignoreWhite=0` keeps white areas as white shapes instead of holes.
 */

const MAX_BYTES = 25 << 20;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const VARIANTS: VectorVariant[] = ["colour", "white", "black"];

export async function POST(req: NextRequest) {
  const asked = (req.nextUrl.searchParams.get("variants") ?? "colour").split(",");
  const variants = VARIANTS.filter((v) => asked.includes(v));
  if (!variants.length) return jsonError(400, "BAD_REQUEST", "Ask for colour, white or black variants.");

  const body = Buffer.from(await req.arrayBuffer());
  if (body.length > MAX_BYTES) return jsonError(413, "TOO_LARGE", "The image is larger than 25 MB.");
  if (!body.subarray(0, 8).equals(PNG_SIGNATURE)) return jsonError(400, "BAD_REQUEST", "Send a PNG image.");

  try {
    const outcome = await traceLogo(body, {
      ignoreWhite: req.nextUrl.searchParams.get("ignoreWhite") !== "0",
      variants,
    });
    return Response.json({
      paths: outcome.paths,
      anchors: outcome.anchors,
      colors: outcome.colors,
      variants: Object.fromEntries(
        Object.entries(outcome.variants).map(([name, files]) => [
          name,
          { svg: files.svg, pdf: files.pdf.toString("base64"), eps: files.eps.toString("base64") },
        ]),
      ),
    });
  } catch (err) {
    if (err instanceof VectorUnavailableError) return jsonError(503, "VECTOR_UNAVAILABLE", err.message);
    if (err instanceof TraceFailedError) return jsonError(422, "TRACE_FAILED", err.message);
    console.error(`[sigil/vector] ${(err as Error)?.stack ?? err}`);
    return jsonError(500, "TRACE_ERROR", "The logo could not be traced.");
  }
}
