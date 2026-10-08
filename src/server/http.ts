import "server-only";
import { ConflictError, NotFoundError } from "./store";

/** Shared plumbing for the storage API routes: JSON errors with the right status. */

export function jsonError(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

export async function handle(work: () => Promise<Response>): Promise<Response> {
  try {
    return await work();
  } catch (err) {
    if (err instanceof ConflictError) return jsonError(409, "CONFLICT", err.message);
    if (err instanceof NotFoundError) return jsonError(404, "NOT_FOUND", err.message);
    if (err instanceof TypeError || err instanceof SyntaxError) {
      return jsonError(400, "BAD_REQUEST", err.message);
    }
    console.error(`[sigil/api] ${(err as Error)?.stack ?? err}`);
    return jsonError(500, "STORAGE_ERROR", "SIGIL could not reach its database. Try again shortly.");
  }
}
