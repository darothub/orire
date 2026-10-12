// orire — pin an EXISTING account's plan by email (manual QA / comps).
//
// Unlike seed-testdata.mjs (which creates fixed *.test logins with a shared,
// repo-visible password — local only), this never creates login credentials.
// It only sets the server-side entitlement for an account that has already
// signed up through the normal flow, so nothing secret lives in the repo and
// it is safe to run against production.
//
// Use it for prod test users: sign up real accounts first (plus-addressing
// keeps them in one inbox, e.g. orireapp+pro@gmail.com), then pin each plan.
//
// Run with:
//   node --env-file=.env scripts/set-plan.mjs <email> <free|pro|career>
//
// Against production, point DATABASE_URL at the prod database (careful):
//   DATABASE_URL="postgres://…" node scripts/set-plan.mjs orireapp+career@gmail.com career
//
// Show an account's current plan without changing it:
//   node --env-file=.env scripts/set-plan.mjs <email> --show

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ok = (s) => `\x1b[32m✓\x1b[0m ${s}`;
const bad = (s) => `\x1b[31m✗\x1b[0m ${s}`;
const info = (s) => `\x1b[36m•\x1b[0m ${s}`;

const PLANS = new Set(["free", "pro", "career"]);

function usage(msg) {
  if (msg) console.error(bad(msg));
  console.error("Usage: node --env-file=.env scripts/set-plan.mjs <email> <free|pro|career|--show>");
  process.exit(1);
}

async function main() {
  const [emailArg, planArg] = process.argv.slice(2);
  if (!emailArg || !planArg) usage("Need an email and a plan.");
  const email = emailArg.trim().toLowerCase();
  const show = planArg === "--show";
  if (!show && !PLANS.has(planArg)) usage(`Unknown plan "${planArg}". Use free, pro or career.`);

  const user = await prisma.user.findUnique({
    where: { email },
    include: { entitlement: true },
  });
  if (!user) {
    usage(`No account with email "${email}". Sign up through the app first, then re-run.`);
  }

  if (show) {
    const plan = user.entitlement?.plan ?? "free";
    const status = user.entitlement?.status ?? "—";
    console.log(info(`${email}: plan=${plan} status=${status}`));
    return;
  }

  // Paid plans read as live subscriptions in the UI (active + a future period
  // end); no Stripe customer is attached, so "Manage billing" stays disabled —
  // these are plan-gate test users, not billing test users.
  const isPaid = planArg !== "free";
  const periodEnd = isPaid ? new Date(Date.now() + 31 * 24 * 60 * 60 * 1000) : null;

  await prisma.entitlement.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      plan: planArg,
      status: isPaid ? "active" : null,
      currentPeriodEnd: periodEnd,
    },
    update: {
      plan: planArg,
      status: isPaid ? "active" : null,
      currentPeriodEnd: periodEnd,
    },
  });

  console.log(ok(`${email} → ${planArg}${isPaid ? " (active)" : ""}`));
}

main()
  .catch((err) => {
    console.error(bad(err.message));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
