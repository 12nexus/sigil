import type { NextRequest } from "next/server";
import { handle, jsonError } from "@/server/http";
import { FeedbackRejectedError, addSharedFeedback, allowFeedback, parseFeedback } from "@/server/share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public: a client's approval, change request or comment, from the share link. */
export function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return handle(async () => {
    const { token } = await params;
    if (Number(req.headers.get("content-length") ?? 0) > 20_000) {
      return jsonError(413, "TOO_LARGE", "That message is too long.");
    }
    let input;
    try {
      input = parseFeedback(await req.json());
    } catch (err) {
      if (err instanceof FeedbackRejectedError) return jsonError(400, "BAD_REQUEST", err.message);
      return jsonError(400, "BAD_REQUEST", "Could not read the feedback.");
    }
    if (!allowFeedback(token)) {
      return jsonError(429, "RATE_LIMITED", "Too much feedback at once. Please try again later.");
    }
    try {
      if (!(await addSharedFeedback(token, input))) {
        return jsonError(404, "NOT_FOUND", "This presentation is not available.");
      }
    } catch (err) {
      if (err instanceof FeedbackRejectedError) return jsonError(400, "BAD_REQUEST", err.message);
      throw err;
    }
    return Response.json({ ok: true });
  });
}
