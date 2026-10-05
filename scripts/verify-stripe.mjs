// CLI-free Stripe verification. Run with:
//   node --env-file=.env scripts/verify-stripe.mjs
// Validates the secret key, inspects configured price IDs, lists available
// recurring prices, and (when prices are valid) creates a real test-mode
// Checkout Session to prove the exact app flow works. No Stripe CLI required.
import Stripe from "stripe";

const ok = (s) => `\x1b[32m✓\x1b[0m ${s}`;
const bad = (s) => `\x1b[31m✗\x1b[0m ${s}`;
const info = (s) => `\x1b[36m•\x1b[0m ${s}`;

const secret = process.env.STRIPE_SECRET_KEY;
const priceEnv = {
  pro: process.env.STRIPE_PRICE_PRO,
  career: process.env.STRIPE_PRICE_CAREER,
};

if (!secret) {
  console.error(bad("STRIPE_SECRET_KEY is not set in .env"));
  process.exit(1);
}

const stripe = new Stripe(secret);
const money = (p) =>
  p.unit_amount != null
    ? `${(p.unit_amount / 100).toFixed(2)} ${p.currency.toUpperCase()}/${p.recurring?.interval ?? "one-time"}`
    : "metered";

async function main() {
  // 1) Key validity + mode
  let livemode = null;
  try {
    const bal = await stripe.balance.retrieve();
    livemode = bal.livemode;
    console.log(ok(`Secret key valid — mode: ${livemode ? "LIVE" : "TEST"}`));
    if (livemode) console.log(bad("This is a LIVE key. Use a TEST key (sk_test_...) for verification."));
  } catch (e) {
    console.error(bad(`Secret key rejected: ${e.message}`));
    process.exit(1);
  }

  // 2) Inspect configured price IDs
  const looksLikePrice = (v) => typeof v === "string" && v.startsWith("price_");
  const resolved = {};
  for (const [plan, id] of Object.entries(priceEnv)) {
    if (!id) {
      console.log(bad(`STRIPE_PRICE_${plan.toUpperCase()} is not set`));
      continue;
    }
    if (!looksLikePrice(id)) {
      console.log(bad(`STRIPE_PRICE_${plan.toUpperCase()}="${id}" is not a Stripe price id (expected price_...)`));
      continue;
    }
    try {
      const price = await stripe.prices.retrieve(id, { expand: ["product"] });
      const problems = [];
      if (!price.active) problems.push("inactive");
      if (!price.recurring) problems.push("not recurring (subscription needs a recurring price)");
      const label = `STRIPE_PRICE_${plan.toUpperCase()} → ${price.id} (${money(price)}, ${price.product?.name ?? "product"})`;
      if (problems.length) console.log(bad(`${label} — ${problems.join(", ")}`));
      else {
        console.log(ok(label));
        resolved[plan] = price;
      }
    } catch (e) {
      console.log(bad(`STRIPE_PRICE_${plan.toUpperCase()}="${id}" — ${e.message}`));
    }
  }

  // 3) List recurring prices in the account (helps find the right IDs)
  console.log("\n" + info("Recurring prices available in this account:"));
  const prices = await stripe.prices.list({ active: true, type: "recurring", limit: 20, expand: ["data.product"] });
  if (!prices.data.length) {
    console.log("  (none — create two subscription products in the Stripe dashboard, test mode)");
  } else {
    for (const p of prices.data) {
      console.log(`  ${p.id}  —  ${money(p)}  —  ${p.product?.name ?? p.product}`);
    }
  }

  // 4) Create a Checkout Session for each valid plan (proves the app flow)
  const planCount = Object.keys(resolved).length;
  if (planCount) {
    console.log("\n" + info("Creating test Checkout Session(s) (same call the app makes):"));
    const customer = await stripe.customers.create({
      email: "verify@orire.local",
      metadata: { orire_verification: "true" },
    });
    try {
      for (const [plan, price] of Object.entries(resolved)) {
        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          customer: customer.id,
          line_items: [{ price: price.id, quantity: 1 }],
          success_url: "http://localhost:3001/?billing=success",
          cancel_url: "http://localhost:3001/?billing=cancelled",
        });
        console.log(ok(`${plan}: session ${session.id} created`));
        console.log(`    checkout URL: ${session.url}`);
      }
    } finally {
      await stripe.customers.del(customer.id);
      console.log(info("cleaned up test customer"));
    }
  } else {
    console.log("\n" + bad("No valid plan prices resolved — fix STRIPE_PRICE_PRO / STRIPE_PRICE_CAREER above, then re-run."));
  }
}

main().catch((e) => {
  console.error(bad(e.message));
  process.exit(1);
});
