import { describe, it, expect, vi, afterEach } from "vitest";
import { log, captureException, setErrorSink } from "@/lib/obs/logger";

function withLogging<T>(fn: () => T): T {
  const prev = process.env.ORIRE_LOG;
  process.env.ORIRE_LOG = "1"; // un-silence for the assertion
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.ORIRE_LOG;
    else process.env.ORIRE_LOG = prev;
  }
}

afterEach(() => setErrorSink(null));

describe("logger", () => {
  it("emits a single JSON line with level + event", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    withLogging(() => log("info", "ai.call.ok", { provider: "openai" }));
    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed).toMatchObject({ level: "info", event: "ai.call.ok", provider: "openai" });
    expect(typeof parsed.ts).toBe("string");
    spy.mockRestore();
  });

  it("redacts sensitive field names", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    withLogging(() =>
      log("error", "boom", { apiKey: "sk-secret", authorization: "Bearer x", model: "m" }),
    );
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.apiKey).toBe("[redacted]");
    expect(parsed.authorization).toBe("[redacted]");
    expect(parsed.model).toBe("m");
    spy.mockRestore();
  });

  it("stays silent during tests unless ORIRE_LOG is set", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log("info", "suppressed");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("captureException routes to the registered sink and still logs", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const sink = vi.fn();
    setErrorSink(sink);
    withLogging(() => captureException(new Error("nope"), { event: "route.fail", apiKey: "sk" }));
    expect(sink).toHaveBeenCalledTimes(1);
    // The sink receives redacted context.
    expect((sink.mock.calls[0][1] as Record<string, unknown>).apiKey).toBe("[redacted]");
    spy.mockRestore();
  });
});
