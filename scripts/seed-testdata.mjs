// orire — seed manual-testing accounts, one per plan.
//
// Creates (or updates) three verified email/password accounts whose server-side
// entitlement is pinned to each plan, so you can sign in and exercise the plan
// gates without going through Stripe Checkout. Idempotent: re-running refreshes
// the password, verification and plan.
//
// Run with:
//   node --env-file=.env scripts/seed-testdata.mjs
//
// Against production you'd point DATABASE_URL at the prod database (careful):
//   DATABASE_URL="postgres://…" node scripts/seed-testdata.mjs
//
// Pass --clean to remove the seeded accounts instead:
//   node --env-file=.env scripts/seed-testdata.mjs --clean

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ok = (s) => `\x1b[32m✓\x1b[0m ${s}`;
const info = (s) => `\x1b[36m•\x1b[0m ${s}`;

// Shared password — strong enough to pass the app's own validator (length ≥ 10,
// not common/sequential, mixed classes). Same for every account for convenience.
const PASSWORD = "Orire-Test-2026!";

const ACCOUNTS = [
  { email: "free@orire.test", name: "Free Tester", plan: "free" },
  { email: "pro@orire.test", name: "Pro Tester", plan: "pro" },
  { email: "career@orire.test", name: "Career Tester", plan: "career" },
];

async function clean() {
  const emails = ACCOUNTS.map((a) => a.email);
  const res = await prisma.user.deleteMany({ where: { email: { in: emails } } });
  console.log(ok(`Removed ${res.count} seeded test account(s).`));
}

async function seed() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000); // ~1 month out

  for (const acct of ACCOUNTS) {
    const user = await prisma.user.upsert({
      where: { email: acct.email },
      create: {
        email: acct.email,
        name: acct.name,
        passwordHash,
        emailVerified: now,
      },
      update: {
        name: acct.name,
        passwordHash,
        emailVerified: now,
      },
    });

    // Pin the entitlement. Paid plans get an "active" status + future period end
    // so the UI reads them as live subscriptions. No Stripe customer is attached,
    // so "Manage billing" stays disabled (these are plan-gate test accounts, not
    // billing test accounts).
    const isPaid = acct.plan !== "free";
    await prisma.entitlement.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        plan: acct.plan,
        status: isPaid ? "active" : null,
        currentPeriodEnd: isPaid ? periodEnd : null,
      },
      update: {
        plan: acct.plan,
        status: isPaid ? "active" : null,
        currentPeriodEnd: isPaid ? periodEnd : null,
      },
    });

    console.log(ok(`${acct.plan.padEnd(6)} → ${acct.email}`));
  }

  console.log("");
  console.log(info(`Password for all accounts:  ${PASSWORD}`));
  console.log(info("All emails are pre-verified, so downloads/writes are unlocked."));
}

async function main() {
  const mode = process.argv.includes("--clean") ? "clean" : "seed";
  if (mode === "clean") await clean();
  else await seed();
}

main()
  .catch((err) => {
    console.error("\x1b[31m✗\x1b[0m", err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
