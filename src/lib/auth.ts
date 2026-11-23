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

export type SessionPayload = {
  adminId: number;
  username: string;
  role: AdminRole;
};

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ username: payload.username, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(payload.adminId))
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
    return {
      adminId,
      username: typeof payload.username === "string" ? payload.username : "",
      role: normalizeRole(payload.role)
    };
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
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
}

/**
 * Loads the account behind the session cookie **from the database** on every
 * request. A signed token only proves who signed in; it cannot prove the
 * account still exists or is still allowed in, which is what makes
 * deactivation take effect immediately.
 */
export async function getSessionUser(): Promise<Admin | null> {
  const session = await getSession();
  if (!session) return null;

  const db = await ensureReady();
  const admin = await db.select().from(admins).where(eq(admins.id, session.adminId)).get();
  if (!admin || !admin.isActive) return null;
  return admin;
}

export type AuthResult =
  | { ok: true; user: Admin }
  | { ok: false; response: NextResponse; status: number };

function unauthorized(): AuthResult {
  return {
    ok: false,
    status: 401,
    response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  };
}

function forbidden(message = "You do not have permission to do that."): AuthResult {
  return {
    ok: false,
    status: 403,
    response: NextResponse.json({ error: message }, { status: 403 })
  };
}

/** Any active, signed-in user (admin or super_admin). */
export async function requireActiveUser(): Promise<AuthResult> {
  const user = await getSessionUser();
  return user ? { ok: true, user } : unauthorized();
}

/** Only a super_admin. */
export async function requireSuperAdmin(): Promise<AuthResult> {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!isSuperAdmin(user.role)) return forbidden("Only a super admin can do that.");
  return { ok: true, user };
}

/** Page guard: sends a signed-out visitor to /login. */
export async function requireActiveUserOrRedirect(): Promise<Admin> {
  const auth = await requireActiveUser();
  if (!auth.ok) redirect("/login");
  return auth.user;
}

/** Page guard: sends an admin back to the generator instead of a blank page. */
export async function requireSuperAdminOrRedirect(): Promise<Admin> {
  const auth = await requireSuperAdmin();
  if (!auth.ok) redirect(auth.status === 401 ? "/login" : "/");
  return auth.user;
}
