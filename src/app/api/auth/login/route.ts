import type { NextRequest } from "next/server";
import {
  configuredCredentials,
  createSessionToken,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  verifyCredentials,
} from "@/services/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!configuredCredentials()) {
    console.error("[sigil/auth] SIGIL_AUTH_USERNAME / SIGIL_AUTH_PASSWORD are not set");
    return Response.json(
      {
        error: {
          code: "AUTH_NOT_CONFIGURED",
          message: "Sign-in is not configured on this server.",
        },
      },
      { status: 503 },
    );
  }

  let username = "";
  let password = "";
  try {
    const body = (await req.json()) as { username?: unknown; password?: unknown };
    username = typeof body.username === "string" ? body.username : "";
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    /* malformed body is treated as wrong credentials */
  }

  if (!(await verifyCredentials(username, password))) {
    // A flat delay blunts online guessing; nginx rate-limits this route too.
    await new Promise((resolve) => setTimeout(resolve, 750));
    return Response.json(
      { error: { code: "INVALID_CREDENTIALS", message: "Incorrect username or password." } },
      { status: 401 },
    );
  }

  const response = Response.json({ ok: true });
  const secure = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  response.headers.append(
    "Set-Cookie",
    [
      `${SESSION_COOKIE}=${await createSessionToken()}`,
      "Path=/",
      `Max-Age=${SESSION_TTL_SECONDS}`,
      "HttpOnly",
      "SameSite=Lax",
      secure ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; "),
  );
  return response;
}
