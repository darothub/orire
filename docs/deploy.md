# Deploying orire to Vercel

orire is a standard Next.js app, so Vercel hosts it well. The one wrinkle is
config: Vercel can't run SOPS, so the canonical encrypted config in
`central-config` is **mirrored** into Vercel's env store with a one-command
sync. SOPS stays the single source of truth; Vercel holds a synced snapshot.

> Migrating off Vercel later (Fly/Docker/VM) is easy — see "Migrating away"
> at the bottom. Nothing here locks you in except where the secrets live.

---

## 0. Prerequisites (one-time)

- A Vercel account + the CLI: `npm i -g vercel`
- The `central-config` repo checked out as a sibling (`../central-config`) with
  the **prod** age key installed so `pull.sh orire prod` can decrypt
  (see `central-config/scripts/bootstrap.sh`).
- A **managed Postgres** — Vercel doesn't run your Docker Postgres. Use
  [Neon](https://neon.tech) (has a native Vercel integration) or Supabase.

## 1. Provision Postgres and capture DATABASE_URL  ✅ done

A Neon Postgres is provisioned. Stored in SOPS prod:

- `DATABASE_URL` → Neon **pooled** host (`…-pooler…`) for the app runtime.
- `DIRECT_URL` → Neon **direct** host (no `-pooler`) for Prisma Migrate.

`prisma/schema.prisma` declares both (`url` + `directUrl`). Migrations run in the
Vercel build (`prisma migrate deploy`) against the direct URL; serverless
functions use the pooled URL at runtime.

> Note: Neon only accepts connections on **:5432**, which is often blocked on
> local/corporate networks — so you may not be able to reach it from a laptop.
> That's fine: the Vercel build network reaches Neon and applies migrations
> there. To run migrations locally, do it from an unblocked network.

## 2. Remaining prod secrets  ✅ done

All set in SOPS prod: `AUTH_SECRET` (generated), `AUTH_URL`/`NEXTAUTH_URL`
(`https://orire.app`), and `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` (reusing the
existing Google OAuth client — make sure its authorized redirect URI includes
`https://orire.app/api/auth/callback/google`, see §5). Resend, Stripe and
Turnstile were already present.

> If you created a **separate** prod Google OAuth client, overwrite the two
> values and re-sync:
> `sops set projects/orire/prod.env '["AUTH_GOOGLE_ID"]' '"...”'` etc.

## 3. Link the repo to a Vercel project

```bash
cd /path/to/orire
vercel link          # creates .vercel/project.json (gitignored)
```

Then connect the **GitHub** repo (`darotudeen/orire`) under Vercel → Project →
Settings → Git. With the Git integration on, Vercel deploys automatically:
every push to `main` ships production, and every pull request gets a preview
URL. There is no deploy step in CI — GitHub Actions only lints, builds and
tests (see "CI" below).

## 4. Sync config into Vercel, then deploy

```bash
npm run deploy:prod         # verify main → sync SOPS → check Vercel → deploy
```

`scripts/sync-vercel-env.sh` decrypts the merged bundle and mirrors every var
(including `NEXT_PUBLIC_*`, which must exist **before** the build so they inline
correctly). It skips dev-only `MAIL_SMTP_*` for production. It now updates
variables in place (`vercel env add --force`) rather than removing the old value
first. After **all** writes succeed, it publishes a nonsecret
`ORIRE_CONFIG_ATTESTATION` token.

The production preflight reads the effective merged central-config bundle,
checks that every nonempty managed key is listed in Vercel Production, and
checks the attestation token against that bundle. It reports only variable
names, not values, and refuses a stale or missing attestation.

Run **one command** from a clean, up-to-date `main` checkout:

```bash
npm run deploy:prod
```

The wrapper first verifies the current branch and clean working tree, fetches
`origin/main` and confirms the checkout is current. **Only after these checks**
does it synchronize merged SOPS production configuration, run the consistency
preflight, and trigger `vercel --prod`. Any failed step stops the command.
`npm run vercel:env` and `npm run config:check:prod` remain available for
targeted diagnostics.

**Important limits:** Vercel's Secret values are not retrievable after being
saved. The attestation verifies that the *last completed managed sync* used the
current merged configuration; it cannot detect someone subsequently changing
an individual Secret directly in Vercel while leaving the attestation intact,
and it does not inspect the variables captured in an already-running deployment.
Audit manual changes separately and redeploy after any environment update.
The preflight needs local SOPS/age access, a linked Vercel project, the Vercel
CLI and the `central-config` sibling checkout. Never put decryption keys or
production secrets in ordinary PR/CI environments.

**Auto-deploy caveat:** Vercel's GitHub integration deploys pushes to main
independently and currently **does not invoke** this local preflight. Use
`npm run deploy:prod` for manual deploys; enforcing the gate on *all*
production deployments requires a separate deployment approval/CI integration
with securely provisioned SOPS and Vercel access. Do not regard a green GitHub
unit-test run as a production secrets consistency check.

Database migrations run automatically: `vercel.json` sets the build command to
`prisma migrate deploy` (production only, so Preview builds never touch the prod DB) then `next build`.

## CI (GitHub Actions)

CI lives in `.github/workflows/ci.yml` and runs on every pull request and on
pushes to `main`:

- **checks** — `eslint`, `next typegen` + `tsc --noEmit`, and `vitest` unit tests
- **build** — a full production `next build`
- **e2e** — the Playwright smoke suite (runs after checks + build are green)

Deploys are **not** done in CI. Production and preview deploys are owned by
Vercel's GitHub integration (§3). CI therefore needs no `VERCEL_*` secrets.

## 5. Google OAuth for production

In Google Cloud Console → Credentials → your OAuth client, add:

- Authorized JavaScript origin: `https://orire.app`
- Authorized redirect URI: `https://orire.app/api/auth/callback/google`

Then set `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` in SOPS (§2) and re-sync.

## 6. Custom domain

In Vercel → Project → Domains, add `orire.app` (and `www`). Point Cloudflare DNS
per Vercel's instructions. `AUTH_URL`/`NEXTAUTH_URL` are already `https://orire.app`.

## 7. Stripe webhook

Create a webhook endpoint in the Stripe dashboard pointing at
`https://orire.app/api/stripe/webhook` (confirm the exact path in
`src/app/api/stripe/`). Put its signing secret in SOPS prod as
`STRIPE_WEBHOOK_SECRET` and re-sync. Use **live** keys for a real launch.

## 8. Meta Pixel (ads)

Add `NEXT_PUBLIC_META_PIXEL_ID=<numeric id from Events Manager>` to SOPS prod,
run `npm run vercel:env`, then redeploy (it is inlined at build time). Without
it no pixel loads. Events sent: `PageView`, `InitiateCheckout`,
`CompleteRegistration` (once per new account, email or Google) and `Purchase`
(on return from Checkout, de-duplicated by Stripe session id). UTM params and
`fbclid` from the landing URL are kept in localStorage for 30 days and sent as
event data. Verify with the Meta Pixel Helper extension. The social share image
is generated by `src/app/opengraph-image.tsx`; re-scrape it with Meta's
Sharing Debugger after changes.

---

## Checklist

- [x] Managed Postgres created; `DATABASE_URL` + `DIRECT_URL` in SOPS prod
- [x] `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` (prod) in SOPS
- [ ] Google redirect URI `https://orire.app/api/auth/callback/google` added
- [ ] `vercel link` done
- [ ] `npm run vercel:env` ran clean
- [ ] `vercel --prod` deployed; migrations applied
- [ ] `orire.app` domain attached
- [ ] Stripe webhook endpoint + secret set (live keys for launch)

## Migrating away from Vercel later

Because SOPS remains canonical, moving to Fly/Docker/VM is just: run
`central-config/scripts/pull.sh orire prod ./.env` at boot (or in an entrypoint)
and `next start`. No values need to be re-entered by hand — the Vercel env store
was only ever a mirror.
