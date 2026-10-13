// orire — seed manual-testing accounts, one per plan.
//
// Creates (or updates) three verified email/password accounts whose server-side
// entitlement is pinned to each plan, so you can sign in and exercise the plan
// gates without going through Stripe Checkout. Idempotent: re-running refreshes
// the password, verification and plan.
//
// Password and emails come from env vars — nothing secret is baked into this
// (public) repo, so it is safe to point at production. The password is REQUIRED:
// the script refuses to run without SEED_TEST_PASSWORD, so you can never
// accidentally create accounts with a repo-visible password.
//
// Env vars:
//   SEED_TEST_PASSWORD        (required) password for every seeded account.
//                             Use a strong one; it bypasses the signup validator
//                             (direct DB write), so weak = a weak live login.
//   SEED_TEST_EMAIL           (optional) base address; plan accounts are derived
//                             by plus-addressing, e.g. SEED_TEST_EMAIL=orireapp@gmail.com
//                             → orireapp+free@…, orireapp+pro@…, orireapp+career@…
//                             (all land in the one inbox).
//   SEED_TEST_EMAIL_FREE      (optional) explicit per-plan overrides; each takes
//   SEED_TEST_EMAIL_PRO       precedence over the derived address for that plan.
//   SEED_TEST_EMAIL_CAREER
//
// If no email vars are set, it falls back to local-only *.orire.test addresses
// (undeliverable, fine for a dev DB; do not use against prod).
//
// Run with:
//   SEED_TEST_PASSWORD='…' node --env-file=.env scripts/seed-testdata.mjs
//
// Against production, point DATABASE_URL at the prod database (careful) and give
// real, deliverable addresses so the accounts can receive mail:
//   DATABASE_URL="postgres://…" SEED_TEST_PASSWORD='…' SEED_TEST_EMAIL='orireapp@gmail.com' \
//     node scripts/seed-testdata.mjs
//
// Pass --clean to remove the seeded accounts instead (same email vars select
// which accounts are removed):
//   SEED_TEST_EMAIL='orireapp@gmail.com' node scripts/seed-testdata.mjs --clean

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ok = (s) => `\x1b[32m✓\x1b[0m ${s}`;
const bad = (s) => `\x1b[31m✗\x1b[0m ${s}`;
const info = (s) => `\x1b[36m•\x1b[0m ${s}`;

// Plus-address a base email for one plan: foo@bar.com → foo+pro@bar.com.
function plusAddress(base, tag) {
  const at = base.lastIndexOf("@");
  if (at === -1) return base; // not an address we recognise; use as-is
  return `${base.slice(0, at)}+${tag}@${base.slice(at + 1)}`;
}

// Resolve the address for a plan: explicit per-plan var wins, then a derived
// plus-address from SEED_TEST_EMAIL, then the local-only *.orire.test fallback.
function emailFor(plan) {
  const explicit = process.env[`SEED_TEST_EMAIL_${plan.toUpperCase()}`];
  if (explicit) return explicit.trim();
  const base = process.env.SEED_TEST_EMAIL;
  if (base) return plusAddress(base.trim(), plan);
  return `${plan}@orire.test`;
}

const ACCOUNTS = [
  { email: emailFor("free"), name: "Free Tester", plan: "free" },
  { email: emailFor("pro"), name: "Pro Tester", plan: "pro" },
  { email: emailFor("career"), name: "Career Tester", plan: "career" },
];

function requirePassword() {
  const pw = process.env.SEED_TEST_PASSWORD;
  if (!pw) {
    console.error(bad("SEED_TEST_PASSWORD is not set."));
    console.error(
      info("Set a strong password before seeding, e.g.:\n" +
        "    SEED_TEST_PASSWORD='choose-a-strong-one' node --env-file=.env scripts/seed-testdata.mjs"),
    );
    process.exit(1);
  }
  if (pw.length < 10) {
    console.error(bad("SEED_TEST_PASSWORD is too short (min 10 chars) — these are real logins."));
    process.exit(1);
  }
  return pw;
}

async function clean() {
  const emails = ACCOUNTS.map((a) => a.email);
  const res = await prisma.user.deleteMany({ where: { email: { in: emails } } });
  console.log(ok(`Removed ${res.count} seeded test account(s).`));
}

async function seed() {
  const password = requirePassword();
  const passwordHash = await bcrypt.hash(password, 10);
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
  console.log(info("Password: the SEED_TEST_PASSWORD you provided (not stored by this script)."));
  console.log(info("All emails are pre-verified, so downloads/writes are unlocked."));
}

async function main() {
  const mode = process.argv.includes("--clean") ? "clean" : "seed";
  if (mode === "clean") await clean();
  else await seed();
}

main()
  .catch((err) => {
    console.error(bad(err.message));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
