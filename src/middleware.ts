import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getSessionSecretOrNull } from "@/lib/session-config";

const PUBLIC_PATHS = new Set([
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/logo.png",
  "/favicon.ico"
]);

/**
 * Paths only a super admin may reach. The same rule is enforced again inside
 * every handler (which reads the role from the database), so hiding a menu item
 * is never the only thing keeping an admin out.
 */
const SUPER_ADMIN_PREFIXES = [
  "/users",
  "/settings",
  "/api/users",
  "/api/settings",
  "/api/logo/upload",
  "/api/logo/reset"
];

type Session = {
  adminId: number;
  role: string | null;
};

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

  const session = await readSession(request);
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  const restricted = SUPER_ADMIN_PREFIXES.find(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  // A token issued before roles existed carries no role claim. Let it through
  // here; the handler re-reads the role from the database and decides.
  if (restricted && session.role !== null && session.role !== "super_admin") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Only a super admin can do that." },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

async function readSession(request: NextRequest): Promise<Session | null> {
  const token = request.cookies.get("session")?.value;
  const secret = getSessionSecretOrNull();
  if (!token || !secret) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    const adminId = Number(payload.sub);
    if (!Number.isInteger(adminId) || adminId <= 0) return null;
    return {
      adminId,
      role: typeof payload.role === "string" ? payload.role : null
    };
  } catch {
    return null;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
