/**
 * Logs the real cause of a route failure. The generic message the client sees
 * is produced separately by `publicErrorMessage`, so the stack never leaks to
 * end users in production.
 */
export function logRouteError(scope: string, error: unknown): void {
  if (error instanceof Error) {
    console.error(`[${scope}] ${error.message}`);
    if (error.stack) console.error(error.stack);
    const cause = (error as Error & { cause?: unknown }).cause;
    if (cause instanceof Error) {
      console.error(`[${scope}] caused by: ${cause.message}`);
      if (cause.stack) console.error(cause.stack);
    }
    return;
  }
  console.error(`[${scope}]`, error);
}

/**
 * The message returned to the browser. Real details are only exposed outside
 * production so a broken deployment can be diagnosed from the response.
 */
export function publicErrorMessage(fallback: string, error: unknown): string {
  if (process.env.NODE_ENV === "production") return fallback;
  return error instanceof Error ? `${fallback} (${error.message})` : fallback;
}

export function firstIssue(error: { issues: ReadonlyArray<{ message: string }> }): string {
  return error.issues[0]?.message ?? "Invalid input";
}
