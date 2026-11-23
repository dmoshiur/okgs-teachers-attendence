export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
export const DEV_SESSION_SECRET = "dev-only-insecure-session-secret-change-me";

/**
 * Edge-safe secret lookup. Returns null in production when SESSION_SECRET is
 * missing so middleware can deny requests instead of crashing.
 */
export function getSessionSecretOrNull(): Uint8Array | null {
  const secret =
    process.env.SESSION_SECRET ||
    (process.env.NODE_ENV === "production" ? null : DEV_SESSION_SECRET);
  return secret ? new TextEncoder().encode(secret) : null;
}
