import "server-only";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { SESSION_COOKIE, SESSION_MAX_AGE, getSessionSecretOrNull } from "./session-config";
import { eq } from "drizzle-orm";
import { ensureReady } from "./db";
import { admins, type Admin, type AdminRole } from "./schema";

function getSecret(): Uint8Array {
  const secret = getSessionSecretOrNull();
  if (!secret) {
    throw new Error(
      "SESSION_SECRET is not set. Add a long random value to your environment variables."
    );
  }
  return secret;
}

export { SESSION_COOKIE, SESSION_MAX_AGE };

export const SUPER_ADMIN: AdminRole = "super_admin";
export const ADMIN: AdminRole = "admin";

export function normalizeRole(value: unknown): AdminRole {
  return value === "super_admin" ? "super_admin" : "admin";
}

export function isSuperAdmin(role: unknown): boolean {
  return normalizeRole(role) === "super_admin";
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * The cookie carries **only the user id**. Role, display name and account status
 * are read from the database on every request, so a role change or a deactivation
 * takes effect on the next request and a stale cookie can never grant access it
 * should not have. It also means a session issued before roles existed keeps
 * working: nothing in the token depends on the old schema.
 */
export type SessionPayload = {
  adminId: number;
};

export async function createSessionToken(adminId: number): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(adminId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  if (!token) return null;
  const secret = getSessionSecretOrNull();
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    const adminId = Number(payload.sub);
    if (!Number.isInteger(adminId) || adminId <= 0) return null;
    // Deliberately ignores any other claim (older builds put username and role in
    // the token). The database is the only source of truth for those.
    return { adminId };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions());
}

/**
 * A Server Component cannot write cookies, so clearing the session from a page
 * is done by `/api/auth/clear`, which applies these options and redirects.
 */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE
  };
}

export function clearedSessionCookieOptions() {
  return { ...sessionCookieOptions(), maxAge: 0 };
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", clearedSessionCookieOptions());
}

type SessionContext = { adminId: number; user: Admin | null } | null;

/** Resolves the session cookie to its database row (or a missing/deleted row). */
async function loadSessionContext(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) return null;

  const db = await ensureReady();
  const user = await db.select().from(admins).where(eq(admins.id, session.adminId)).get();
  return { adminId: session.adminId, user: user ?? null };
}

/**
 * Loads the account behind the session cookie **from the database** on every
 * request. A signed token only proves who signed in; it cannot prove the
 * account still exists or is still allowed in, which is what makes
 * deactivation take effect immediately.
 */
export async function getSessionUser(): Promise<Admin | null> {
  const context = await loadSessionContext();
  if (!context || !context.user || !context.user.isActive) return null;
  return context.user;
}

function userLabel(user: Admin | null, adminId: number | null): string {
  const id = user ? user.id : adminId ?? "anonymous";
  const role = user ? user.role || "none" : "none";
  return `user=${id} role=${role}`;
}

/**
 * Every refusal is logged with the user id, the database role and the reason, so
 * a production lockout can be diagnosed from the Vercel function logs instead of
 * guessed at from a redirect.
 */
function logDenied(reason: string, user: Admin | null = null, adminId: number | null = null): void {
  console.error(`[auth] access denied: ${userLabel(user, adminId)} reason=${reason}`);
}

export type AuthResult =
  | { ok: true; user: Admin }
  | { ok: false; status: 401 | 403; reason: string; user: Admin | null; response: NextResponse };

function denied(
  status: 401 | 403,
  message: string,
  user: Admin | null,
  reason: string,
  adminId: number | null = null
): AuthResult {
  logDenied(reason, user, adminId);
  return {
    ok: false,
    status,
    reason,
    user,
    response: NextResponse.json({ error: message }, { status })
  };
}

/**
 * The one shared guard. Every page, layout and API route calls this (or
 * `requireSuperAdmin`, which builds on it). It loads the account by the id in the
 * cookie and trusts only the database values for `role` and `is_active`.
 *
 * A deactivated or deleted account is refused with a 401. API routes also clear
 * the cookie here; pages cannot write cookies, so they send the user to
 * `/api/auth/clear`, which does it for them and then redirects to /login.
 */
export async function requireUser(
  options: { clearCookie?: boolean } = {}
): Promise<AuthResult> {
  const clearCookie = options.clearCookie !== false;
  let context: SessionContext;
  try {
    context = await loadSessionContext();
  } catch (error) {
    console.error("[auth] could not load the session account", error);
    return {
      ok: false,
      status: 401,
      reason: "database unavailable",
      user: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    };
  }

  if (!context) {
    return denied(401, "Unauthorized", null, "no session cookie");
  }

  if (!context.user) {
    if (clearCookie) await clearSessionCookie();
    return denied(401, "Unauthorized", null, "account no longer exists", context.adminId);
  }

  if (!context.user.isActive) {
    if (clearCookie) await clearSessionCookie();
    return denied(401, "Unauthorized", context.user, "account is deactivated");
  }

  return { ok: true, user: context.user };
}

/** Only a super_admin. */
export async function requireSuperAdmin(
  options: { clearCookie?: boolean } = {}
): Promise<AuthResult> {
  const auth = await requireUser(options);
  if (!auth.ok) return auth;

  if (!isSuperAdmin(auth.user.role)) {
    return denied(
      403,
      "Only a super admin can do that.",
      auth.user,
      "super admin role required"
    );
  }

  return { ok: true, user: auth.user };
}

/**
 * Page/layout guard. A missing session (or a database error) goes straight to
 * /login; a session whose account is deactivated or deleted goes through
 * `/api/auth/clear`, which clears the cookie and then redirects to /login.
 * Never to `/`.
 */
export async function requireUserOrRedirect(): Promise<Admin> {
  const auth = await requireUser({ clearCookie: false });
  if (auth.ok) return auth.user;
  redirect(loginRedirectTarget(auth.reason));
}

/** Where a page guard should send a refused visitor. */
function loginRedirectTarget(reason: string): string {
  return reason === "account is deactivated" || reason === "account no longer exists"
    ? "/api/auth/clear"
    : "/login";
}

export type PageGuard =
  | { ok: true; user: Admin }
  | { ok: false; status: 403; user: Admin };

/**
 * Page guard for super-admin pages. A signed-out or deactivated visitor is
 * redirected to /login (through the cookie-clearing handler when needed); a
 * plain admin is returned so the page can render the "You do not have
 * permission" screen instead of silently sending the user back to the home page.
 */
export async function requireSuperAdminForPage(): Promise<PageGuard> {
  const auth = await requireSuperAdmin({ clearCookie: false });
  if (auth.ok) return { ok: true, user: auth.user };

  if (auth.status === 401) {
    redirect(loginRedirectTarget(auth.reason));
  }
  if (!auth.user) redirect("/login");

  return { ok: false, status: 403, user: auth.user };
}
