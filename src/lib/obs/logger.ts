/**
 * orire — structured logging (dependency-free).
 *
 * Emits one JSON line per event to stdout/stderr, which Vercel (and most hosts)
 * capture and index. This gives us server-side signal in production without
 * pulling in a logging framework. Fields are explicit and redaction is the
 * caller's job for free-form text — but this module NEVER logs API keys or raw
 * prompt/CV content: callers pass only safe, structured metadata.
 *
 * `captureException` is a seam for an error tracker (e.g. Sentry). It is a
 * no-op until a sink is registered via `setErrorSink`, so wiring Sentry later
 * is a one-line change with zero churn here.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

type ErrorSink = (err: unknown, context?: LogFields) => void;

let errorSink: ErrorSink | null = null;

/** Register an error-tracking sink (e.g. Sentry's captureException). */
export function setErrorSink(sink: ErrorSink | null): void {
  errorSink = sink;
}

/** Tests and local noise control: suppress log output unless explicitly on. */
function silenced(): boolean {
  if (process.env.ORIRE_LOG === "1") return false;
  return process.env.VITEST === "true" || process.env.NODE_ENV === "test";
}

const SECRET_KEY = /(key|token|secret|authorization|password|cookie)/i;

/** Shallow-redact fields whose name looks sensitive. Defense in depth. */
function redact(fields: LogFields): LogFields {
  const out: LogFields = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = SECRET_KEY.test(k) ? "[redacted]" : v;
  }
  return out;
}

export function log(level: LogLevel, event: string, fields: LogFields = {}): void {
  if (silenced()) return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...redact(fields),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (event: string, fields?: LogFields) => log("debug", event, fields),
  info: (event: string, fields?: LogFields) => log("info", event, fields),
  warn: (event: string, fields?: LogFields) => log("warn", event, fields),
  error: (event: string, fields?: LogFields) => log("error", event, fields),
};

/**
 * Report an exception to the registered error sink (if any) and always log it.
 * Safe to call from any route catch block.
 */
export function captureException(err: unknown, context: LogFields = {}): void {
  try {
    errorSink?.(err, redact(context));
  } catch {
    // An error tracker must never take down the request path.
  }
  const message = err instanceof Error ? err.message : String(err);
  log("error", context.event ? String(context.event) : "exception", { ...context, message });
}
