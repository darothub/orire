// CLI-free Stripe webhook verification. Requires: DB up, STRIPE_SECRET_KEY +
// STRIPE_WEBHOOK_SECRET in env, and the app running (default :3001).
//   node --env-file=.env scripts/verify-webhook.mjs
// Seeds a throwaway user+entitlement, signs a customer.subscription.updated
// event with the Stripe SDK (same way the CLI would), POSTs it to the real
// webhook route, asserts HTTP 200 + the entitlement flips free→pro, then
// tests that a tampered signature is rejected (400). Cleans up after itself.
import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";

const ok = (s) => console.log(`\x1b[32m✓\x1b[0m ${s}`);
const bad = (s) => console.log(`\x1b[31m✗\x1b[0m ${s}`);
const info = (s) => console.log(`\x1b[36m•\x1b[0m ${s}`);

const secret = process.env.STRIPE_SECRET_KEY;
const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
const proPrice = process.env.STRIPE_PRICE_PRO;
const base = process.env.E2E_BASE ?? "http://localhost:3001";
if (!secret || !whSecret || !proPrice) {
  bad("Need STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_PRO in env");
  process.exit(1);
}

const stripe = new Stripe(secret);
const prisma = new PrismaClient();
const customerId = `cus_verify_${Date.now()}`;
const subId = `sub_verify_${Date.now()}`;
let userId;

function signedRequest(payloadObj) {
  const payload = JSON.stringify(payloadObj);
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: whSecret });
  return { payload, header };
}

function subscriptionEvent(status, priceId) {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: `evt_${Date.now()}`,
    object: "event",
    type: "customer.subscription.updated",
    api_version: "2024-06-20",
    created: now,
    data: {
      object: {
        id: subId,
        object: "subscription",
        customer: customerId,
        status,
        current_period_end: now + 30 * 24 * 3600,
        items: {
          object: "list",
          data: [{ id: "si_verify", object: "subscription_item", price: { id: priceId, object: "price" }, current_period_end: now + 30 * 24 * 3600 }],
        },
      },
    },
  };
}

async function main() {
  // Pre-flight: is the app reachable?
  try {
    const res = await fetch(`${base}/api/billing/webhook`, { method: "POST" });
    if (res.status === 503) {
      bad(`Webhook returns 503 — the running server didn't load STRIPE env. Restart the app so .env is re-read.`);
      process.exit(1);
    }
    info(`webhook reachable at ${base} (unsigned POST → ${res.status}, expected 400)`);
  } catch {
    bad(`App not reachable at ${base}. Start it (npm run dev) then re-run.`);
    process.exit(1);
  }

  // Seed a user + free entitlement linked to our test customer id.
  const user = await prisma.user.create({ data: { email: `verify_${Date.now()}@orire.local` } });
  userId = user.id;
  await prisma.entitlement.create({ data: { userId, plan: "free", stripeCustomerId: customerId } });
  info(`seeded user ${userId} → entitlement plan=free, customer=${customerId}`);

  // 1) Valid signed active subscription → expect 200 + plan flips to pro.
  {
    const { payload, header } = signedRequest(subscriptionEvent("active", proPrice));
    const res = await fetch(`${base}/api/billing/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": header },
      body: payload,
    });
    const body = await res.text();
    if (res.status === 200) ok(`signed subscription.updated accepted (200): ${body}`);
    else { bad(`expected 200, got ${res.status}: ${body}`); }

    const row = await prisma.entitlement.findUnique({ where: { stripeCustomerId: customerId } });
    if (row?.plan === "pro" && row.status === "active" && row.stripeSubscriptionId === subId) {
      ok(`entitlement updated: plan=${row.plan}, status=${row.status}, sub=${row.stripeSubscriptionId}`);
    } else {
      bad(`entitlement NOT updated as expected: ${JSON.stringify({ plan: row?.plan, status: row?.status, sub: row?.stripeSubscriptionId })}`);
    }
  }

  // 2) Tampered signature → expect 400.
  {
    const { payload } = signedRequest(subscriptionEvent("active", proPrice));
    const res = await fetch(`${base}/api/billing/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=deadbeef" },
      body: payload,
    });
    if (res.status === 400) ok(`tampered signature rejected (400)`);
    else bad(`expected 400 for bad signature, got ${res.status}`);
  }

  // 3) Canceled subscription → expect downgrade to free.
  {
    const { payload, header } = signedRequest(subscriptionEvent("canceled", proPrice));
    const res = await fetch(`${base}/api/billing/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": header },
      body: payload,
    });
    const row = await prisma.entitlement.findUnique({ where: { stripeCustomerId: customerId } });
    if (res.status === 200 && row?.plan === "free") ok(`canceled event downgraded plan → free`);
    else bad(`expected downgrade to free, got status=${res.status}, plan=${row?.plan}`);
  }
}

main()
  .catch((e) => bad(e.message))
  .finally(async () => {
    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
      info("cleaned up seeded user + entitlement");
    }
    await prisma.$disconnect();
  });
