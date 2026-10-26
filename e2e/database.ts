/** Refuse implicit .env credentials and any database outside the local E2E namespace. */
export function e2eDatabaseUrl(value = process.env.DATABASE_URL): string {
  if (!value) throw new Error("Set DATABASE_URL explicitly to a disposable local orire_e2e database.");
  const url = new URL(value);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    !/^\/orire_e2e(?:_[a-z0-9_]+)?$/.test(url.pathname) ||
    [...url.searchParams.keys()].some((key) => !["schema", "connection_limit", "pool_timeout", "connect_timeout"].includes(key))
  ) {
    throw new Error("E2E requires a loopback PostgreSQL URL with a disposable orire_e2e database name.");
  }
  return value;
}
