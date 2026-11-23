import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getSessionSecretOrNull } from "@/lib/session-config";

const PUBLIC_PATHS = new Set([
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/clear",
  "/logo.png",
  "/favicon.ico"
]);

/**
 * Middleware runs on the Edge runtime, so it **cannot query the database**. It
 * therefore only answers one question: is there a signed session cookie?
 *
 * It deliberately does not decide anything from the role. Roles and account
 * status are read from the database by `requireUser()` in `src/lib/auth.ts`,
 * which every page, layout and API route calls. Deciding the role here (from a
 * cookie claim) is what used to bounce a super admin to `/` when the cookie had
 * been issued before the account was promoted: the token kept saying `admin`
 * for the whole 7-day lifetime of the cookie.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/icon") ||
    pathname.startsWith("/apple-icon") ||
    pathname.startsWith("/opengraph-image")
  ) {
    // /login is handled by the page itself: only a session whose account is
    // still active redirects away. Deciding here (edge, no database) would
    // bounce a deactivated user between / and /login forever, because their
    // cookie still verifies.
    return NextResponse.next();
  }

  const adminId = await readSessionUserId(request);
  if (adminId === null) {
    console.error(
      `[auth] access denied: user=anonymous role=none reason=no valid session cookie path=${pathname}`
    );
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

/** Verifies the signature and returns the user id stored in the cookie. */
async function readSessionUserId(request: NextRequest): Promise<number | null> {
  const token = request.cookies.get("session")?.value;
  const secret = getSessionSecretOrNull();
  if (!token || !secret) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    const adminId = Number(payload.sub);
    if (!Number.isInteger(adminId) || adminId <= 0) return null;
    return adminId;
  } catch {
    return null;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
