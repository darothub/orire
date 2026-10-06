/**
 * orire — server boot instrumentation.
 *
 * Next.js calls `register()` exactly once when a server instance starts, before
 * it serves any request. We use it to validate the environment up front so a
 * misconfigured deploy fails fast and legibly instead of erroring deep inside a
 * paid request path. Only hard-required vars are fatal, and only in production;
 * everywhere else we log so local dev keeps working with zero secrets.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { checkEnv, formatEnvError } = await import("@/lib/config/env");
  const { logger } = await import("@/lib/obs/logger");

  const result = checkEnv();

  for (const warning of result.warnings) {
    logger.warn("config.env.warning", { message: warning });
  }

  if (!result.ok) {
    const message = formatEnvError(result);
    if (process.env.NODE_ENV === "production") {
      logger.error("config.env.invalid", { missing: result.missing });
      throw new Error(`orire boot aborted — ${message}`);
    }
    logger.warn("config.env.invalid", { missing: result.missing });
  }
}
