export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureReady } = await import("./lib/db");
    try {
      await ensureReady();
    } catch (error) {
      console.error("[startup] database initialisation failed", error);
    }
  }
}
