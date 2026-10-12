// Create (idempotently) the orire Pro/Career subscription products + recurring
// prices in Stripe, then print the price ids. Works in test or live mode (it
// uses whatever STRIPE_SECRET_KEY is set). Run with:
//   node --env-file=.env scripts/create-stripe-prices.mjs
//
// Self-healing: if a price already exists for a plan's lookup_key but at the
// WRONG amount (e.g. a stale $12/$29 from an earlier run), it mints a new price
// at the correct amount, transfers the lookup_key to it, and archives the old
// one. You must then update STRIPE_PRICE_PRO / STRIPE_PRICE_CAREER (printed
// below) in your env (SOPS -> Vercel) and redeploy — the app references prices
// by id, not by lookup_key.
import Stripe from "stripe";

const secret = process.env.STRIPE_SECRET_KEY;
if (!secret) {
  console.error("STRIPE_SECRET_KEY not set");
  process.exit(1);
}
const stripe = new Stripe(secret);

// Amounts are in cents and MUST match src/lib/plan/plan.ts (pro $9, career $19).
const PLANS = [
  { key: "pro", name: "orire Pro", amount: 900, lookup: "orire_pro_monthly" },
  { key: "career", name: "orire Career", amount: 1900, lookup: "orire_career_monthly" },
];

async function ensurePrice({ key, name, amount, lookup }) {
  const existing = await stripe.prices.list({ lookup_keys: [lookup], active: true, limit: 1 });

  if (existing.data.length) {
    const p = existing.data[0];
    if (p.unit_amount === amount) {
      return { key, id: p.id, reused: true, amount: p.unit_amount };
    }
    // Amount drifted. Stripe prices are immutable, so mint a fresh price at the
    // correct amount, move the lookup_key onto it, and archive the stale price.
    const price = await stripe.prices.create({
      product: typeof p.product === "string" ? p.product : p.product.id,
      unit_amount: amount,
      currency: "usd",
      recurring: { interval: "month" },
      lookup_key: lookup,
      transfer_lookup_key: true,
      metadata: { orire_plan: key },
    });
    await stripe.prices.update(p.id, { active: false });
    return { key, id: price.id, reused: false, amount, replaced: p.id, replacedAmount: p.unit_amount };
  }

  const product = await stripe.products.create({ name, metadata: { orire_plan: key } });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: amount,
    currency: "usd",
    recurring: { interval: "month" },
    lookup_key: lookup,
    metadata: { orire_plan: key },
  });
  return { key, id: price.id, reused: false, amount };
}

const out = {};
for (const plan of PLANS) {
  const r = await ensurePrice(plan);
  out[plan.key] = r.id;
  if (r.replaced) {
    console.log(
      `replaced ${plan.name}: ${r.id} ($${(r.amount / 100).toFixed(2)}/mo) ` +
        `— archived stale ${r.replaced} ($${(r.replacedAmount / 100).toFixed(2)}/mo)`,
    );
  } else {
    console.log(`${r.reused ? "reused" : "created"} ${plan.name}: ${r.id} ($${(r.amount / 100).toFixed(2)}/mo)`);
  }
}

console.log("\n--- set these in your env (SOPS prod.env -> Vercel), then redeploy ---");
console.log(`STRIPE_PRICE_PRO=${out.pro}`);
console.log(`STRIPE_PRICE_CAREER=${out.career}`);
