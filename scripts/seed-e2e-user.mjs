/**
 * Seed the synthetic Auth.js JWT subject in CI's isolated Postgres database.
 * The browser cookie is stateless, but document/export writes have real
 * foreign keys to User. Never run against production.
 */
import { PrismaClient } from "@prisma/client";

if (process.env.CI !== "true" || process.env.ORIRE_E2E_BYPASS !== "1") {
  console.error("E2E seeding requires CI=true and ORIRE_E2E_BYPASS=1.");
  process.exit(1);
}
const databaseUrl = process.env.DATABASE_URL ?? "";
let hostname;
try {
  hostname = new URL(databaseUrl).hostname;
} catch {
  console.error("Refusing to seed an invalid database URL.");
  process.exit(1);
}
if (hostname !== "localhost" && hostname !== "127.0.0.1") {
  console.error("Refusing to seed a nonlocal database.");
  process.exit(1);
}
const prisma = new PrismaClient();
try {
  await prisma.user.upsert({
    where: { id: "e2e-user" },
    update: { name: "E2E Tester", email: "e2e@orire.test" },
    create: { id: "e2e-user", name: "E2E Tester", email: "e2e@orire.test" },
  });
  console.log("Synthetic E2E user fixture ready.");
} finally {
  await prisma.$disconnect();
}
