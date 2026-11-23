import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { SESSION_COOKIE, SESSION_MAX_AGE, getSessionSecretOrNull } from "./session-config";

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

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export type SessionPayload = {
  adminId: number;
  username: string;
};

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ username: payload.username, role: "admin" })
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
      username: typeof payload.username === "string" ? payload.username : ""
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
