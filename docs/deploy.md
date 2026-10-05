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

## 1. Provision Postgres and capture DATABASE_URL

Create a Postgres instance (Neon recommended). Copy its pooled connection
string. Store it in SOPS prod so it stays canonical:

```bash
cd ../central-config
export SOPS_AGE_KEY_FILE="$HOME/.config/sops/age/keys.txt"
sops set projects/orire/prod.env '["DATABASE_URL"]' '"postgresql://USER:PASS@HOST/DB?sslmode=require"'
```

> Neon tip: use the **pooled** (`-pooler`) host for the app runtime. Prisma
> `migrate deploy` (run in the Vercel build) needs a **direct** connection — if
> you hit pooler errors during migrate, add a `directUrl` in `schema.prisma`
> and store `DIRECT_URL` too.

## 2. Add the remaining prod-only secrets to SOPS

Already set for you: `AUTH_SECRET` (generated), `AUTH_URL`, `NEXTAUTH_URL`
(both `https://orire.app`). Still needed from you:

```bash
# Google OAuth (prod credentials — see §5)
sops set projects/orire/prod.env '["AUTH_GOOGLE_ID"]' '"...apps.googleusercontent.com"'
sops set projects/orire/prod.env '["AUTH_GOOGLE_SECRET"]' '"GOCSPX-..."'
```

Resend, Stripe, Turnstile and the email vars are already in prod from earlier.

## 3. Link the repo to a Vercel project

```bash
cd /path/to/orire
vercel link          # creates .vercel/project.json (gitignored)
```

## 4. Sync config into Vercel, then deploy

```bash
npm run vercel:env           # pushes SOPS prod → Vercel "production"
vercel --prod                # first production deploy
```

`scripts/sync-vercel-env.sh` decrypts the merged bundle and mirrors every var
(including `NEXT_PUBLIC_*`, which must exist **before** the build so they inline
correctly). It skips dev-only `MAIL_SMTP_*` for production. Re-run
`npm run vercel:env` any time a value changes in SOPS, then redeploy.

Database migrations run automatically: `vercel.json` sets the build command to
`prisma migrate deploy && next build`.

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

---

## Checklist

- [ ] Managed Postgres created; `DATABASE_URL` in SOPS prod
- [ ] `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` (prod) in SOPS + redirect URI added
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
