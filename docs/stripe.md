# Stripe billing setup

orire's billing is **optional and env-driven** (Phase B2, `src/lib/billing/`).
With no `STRIPE_SECRET_KEY` the plan panel falls back to the local dev plan
switch, so development needs zero billing secrets. When Stripe is configured,
paid plans go through Stripe Checkout and a webhook writes the authoritative
`Entitlement` row.

## Current status

- `.env` has **no `STRIPE_*` keys**, so billing is in dev-fallback mode.
- The code path is complete; going live only needs an external Stripe account,
  products/prices, and the env vars below.

## Plans → price mapping

Two paid plans need a Stripe **recurring price**. Free needs nothing.

| Plan | Price env var |
| --- | --- |
| Pro | `STRIPE_PRICE_PRO` |
| Career | `STRIPE_PRICE_CAREER` |

Resolved in `src/lib/billing/stripe.ts` (`priceIdForPlan` / `planForPriceId`).

## Required env vars

```sh
STRIPE_SECRET_KEY=sk_test_...        # test mode first; sk_live_... for production
STRIPE_WEBHOOK_SECRET=whsec_...      # from `stripe listen` (dev) or the dashboard endpoint (prod)
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_CAREER=price_...
# Optional: origin for Checkout success/cancel redirects (defaults to request origin, then localhost:3001)
APP_URL=https://your-domain.com
```

---

## 1. Create the account

1. Sign up / sign in at [dashboard.stripe.com](https://dashboard.stripe.com).
2. Stay in **Test mode** (toggle, top-right) until the end-to-end flow is verified.
3. Grab the **Secret key** from **Developers → API keys** →
   `STRIPE_SECRET_KEY` (use the test key `sk_test_...` first).

## 2. Create products & prices

For **each** paid plan (Pro, Career):

1. **Product catalog → Add product**.
2. Name it (e.g. "orire Pro"), add a **recurring** price (monthly or yearly),
   set the amount/currency.
3. Save and copy the **Price ID** (`price_...`) into the matching env var.

## 3. Wire the webhook

The webhook keeps entitlements authoritative. It verifies the signature against
`STRIPE_WEBHOOK_SECRET` and handles:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

**Local development** — forward events with the Stripe CLI:

```sh
stripe login
stripe listen --forward-to localhost:3001/api/billing/webhook
# copy the printed whsec_... into STRIPE_WEBHOOK_SECRET, then restart the app
```

**Production** — **Developers → Webhooks → Add endpoint**:

- Endpoint URL: `https://your-domain.com/api/billing/webhook`
- Events: the four listed above (or "Select all" to be safe).
- Copy the endpoint's **Signing secret** (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`.

## 4. Verify (test mode)

1. Restart the app so env is read (env is read once at boot).
2. In the plan panel, start checkout for Pro or Career.
3. Pay with a Stripe test card: `4242 4242 4242 4242`, any future expiry, any CVC/ZIP.
4. You're redirected to `/?billing=success`. Confirm:
   - the webhook received `checkout.session.completed` (CLI output or dashboard),
   - the user's `Entitlement` row now reflects the paid plan
     (`npm run db:studio`).
5. Test downgrade/cancel and confirm `customer.subscription.deleted` reverts the
   entitlement.

---

## Go-live checklist

- [ ] External Stripe account confirmed (and business details completed for live payouts)
- [ ] Products + recurring prices created in **live** mode
- [ ] `STRIPE_SECRET_KEY` (live `sk_live_...`) set
- [ ] `STRIPE_PRICE_PRO` / `STRIPE_PRICE_CAREER` set to live price IDs
- [ ] Production webhook endpoint added; `STRIPE_WEBHOOK_SECRET` set to its signing secret
- [ ] `APP_URL` set to the production origin
- [ ] Full test-mode round trip (checkout → webhook → entitlement) verified before switching to live keys

## Notes

- Never commit real keys. `.env` is gitignored; only `.env.example` is tracked.
- Price IDs are injected per-environment, so the same code runs against test and
  live without recompiling.
- The old `STRIPE_PRICE_TEAMS` variable was removed with the Teams subsystem.
