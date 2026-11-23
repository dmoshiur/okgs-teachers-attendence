import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, clearedSessionCookieOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Clears the session cookie and redirects to `next` (default /login).
 *
 * A Server Component cannot write cookies, so the page guards send a visitor
 * whose account is deactivated or deleted here instead of calling
 * `clearSessionCookie()` themselves. The result is the same: the stale cookie is
 * gone and the browser lands on /login, never on the home page.
 */
export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next");
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/login";

  const response = NextResponse.redirect(new URL(target, request.url));
  response.cookies.set(SESSION_COOKIE, "", clearedSessionCookieOptions());
  return response;
}
