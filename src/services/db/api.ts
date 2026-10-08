/**
 * Browser-side transport for SIGIL's storage API. Everything persistent lives
 * on the server; these helpers turn its JSON errors into thrown Errors.
 */

export class StorageError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "StorageError";
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers:
        init?.body && typeof init.body === "string"
          ? { "Content-Type": "application/json", ...init.headers }
          : init?.headers,
      cache: "no-store",
    });
  } catch {
    throw new StorageError("SIGIL's server could not be reached. Check your connection.", 0);
  }
  if (res.status === 204) return undefined as T;
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (payload as { error?: { message?: string; code?: string } } | null)?.error;
    throw new StorageError(error?.message ?? `Request failed (${res.status}).`, res.status, error?.code);
  }
  return payload as T;
}

export const json = (body: unknown): string => JSON.stringify(body);
