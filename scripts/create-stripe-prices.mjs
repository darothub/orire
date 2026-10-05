// Create (idempotently) the orire Pro/Career subscription products + recurring
// prices in Stripe TEST mode, then print the price ids. Run with:
//   node --env-file=.env scripts/create-stripe-prices.mjs
import Stripe from "stripe";

const secret = process.env.STRIPE_SECRET_KEY;
if (!secret) {
  console.error("STRIPE_SECRET_KEY not set");
  process.exit(1);
}
const stripe = new Stripe(secret);

const PLANS = [
  { key: "pro", name: "orire Pro", amount: 1200, lookup: "orire_pro_monthly" },
  { key: "career", name: "orire Career", amount: 2900, lookup: "orire_career_monthly" },
];

async function ensurePrice({ key, name, amount, lookup }) {
  // Reuse an existing price with this lookup_key if present (idempotent re-run).
  const existing = await stripe.prices.list({ lookup_keys: [lookup], active: true, limit: 1 });
  if (existing.data.length) {
    const p = existing.data[0];
    return { key, id: p.id, reused: true, amount: p.unit_amount };
  }
  const product = await stripe.products.create({
    name,
    metadata: { orire_plan: key },
  });
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
  console.log(`${r.reused ? "reused" : "created"} ${plan.name}: ${r.id} ($${(r.amount / 100).toFixed(2)}/mo)`);
}

console.log("\n--- paste into .env ---");
console.log(`STRIPE_PRICE_PRO=${out.pro}`);
console.log(`STRIPE_PRICE_CAREER=${out.career}`);
