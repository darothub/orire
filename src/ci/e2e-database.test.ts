import { describe, expect, it } from "vitest";
import { e2eDatabaseUrl } from "../../e2e/database";

describe("disposable E2E database boundary", () => {
  it.each(["localhost", "127.0.0.1", "[::1]"])("accepts explicit test databases on %s", (host) => {
    const url = `postgresql://test:test@${host}:55488/orire_e2e_pr188?schema=public`;
    expect(e2eDatabaseUrl(url)).toBe(url);
  });

  it.each([
    "", "invalid", "postgresql://test:test@production.example/orire_e2e",
    "postgresql://test:test@localhost/orire", "postgresql://test:test@localhost/postgres",
    "postgresql://test:test@localhost/orire_e2e?host=production.example",
    "https://localhost/orire_e2e",
  ])("rejects unsafe or implicit database target %s", (url) => {
    expect(() => e2eDatabaseUrl(url)).toThrow();
  });
});
