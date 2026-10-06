import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Load .env for Prisma CLI commands. When a prisma.config.ts exists, Prisma no
// longer auto-loads .env, so we do it here. (The Next.js app loads .env on its
// own; this only affects `prisma` CLI invocations like migrate/generate.)
loadEnv();

// DIRECT_URL is the non-pooled connection Prisma uses for migrations. For local
// Postgres it is always identical to DATABASE_URL, so default it here instead of
// forcing every machine to set the same value twice. Pooled hosts (e.g. Neon)
// still set DIRECT_URL explicitly to the non-"-pooler" host and it is respected.
if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
});
