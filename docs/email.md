# Email & password reset

orire sends transactional email (today: the **password-reset** link) through one
tiny abstraction, [`src/lib/email/mailer.ts`](../src/lib/email/mailer.ts). The
transport is chosen by environment — no code changes between dev and prod:

| Environment | Transport | Setup cost |
| --- | --- | --- |
| **Dev / local** | SMTP → [Mailpit](https://mailpit.axllent.org) sink | one Docker container, no account, offline |
| **Production** | [Resend](https://resend.com) HTTP API | free tier: 3,000/mo, 100/day; a few DNS records |

Selection rule: if `RESEND_API_KEY` is set the app uses Resend; otherwise it
sends over SMTP to `MAIL_SMTP_HOST:MAIL_SMTP_PORT` (default `localhost:1025`).

---

## Local development (Mailpit)

Nothing leaves your machine — every message is captured in a web inbox.

```bash
npm run mail:dev        # starts Mailpit (SMTP :1025, UI :8025)
npm run dev
```

Then trigger a reset (see the flow below) and read the captured email at
**http://localhost:8025**. No account, password, or API key is required.

Relevant env (already in `.env` / `.env.example`):

```ini
EMAIL_FROM="orire <noreply@orire.app>"
APP_URL=http://localhost:3001
MAIL_SMTP_HOST=localhost
MAIL_SMTP_PORT=1025
```

If you don't have Docker, point `MAIL_SMTP_HOST`/`MAIL_SMTP_PORT` at any SMTP
sink (e.g. an [Ethereal](https://ethereal.email) test account, which also needs
`MAIL_SMTP_USER`/`MAIL_SMTP_PASS`).

---

## Production (Resend + Cloudflare DNS)

Cloudflare **cannot** send outbound email on the free plan (Email Routing is
inbound-only; the old MailChannels free relay shut down in 2024). So Cloudflare
provides DNS only; Resend does the actual sending.

### 1. Create the Resend account & add the domain

1. Sign up at <https://resend.com> and add the domain **`orire.app`**.
2. Resend shows a set of DNS records to add (SPF, DKIM, and a return-path/MX).

### 2. Add the DNS records in Cloudflare

In the Cloudflare dashboard for `orire.app` → **DNS → Records**, add exactly what
Resend lists. It's typically:

| Type | Name | Value | Proxy |
| --- | --- | --- | --- |
| `TXT` | `send` (or `@`) | `v=spf1 include:amazonses.com ~all` | DNS only |
| `TXT` | `resend._domainkey` | (long DKIM public key from Resend) | DNS only |
| `MX` | `send` | `feedback-smtp.<region>.amazonses.com` (priority 10) | DNS only |

Set **all** of these to **DNS only** (grey cloud) — proxying breaks mail records.

**DMARC** (recommended, add once): a `TXT` on `_dmarc` with
`v=DMARC1; p=none; rua=mailto:dmarc@orire.app` — start at `p=none`, tighten to
`quarantine`/`reject` after you've confirmed delivery.

### 3. Verify & set the key

1. Back in Resend, click **Verify** on the domain (propagation can take minutes).
2. Create an API key and store it as `RESEND_API_KEY` in the **SOPS
   central-config** (shared tier) — never commit it.
3. Deploy. With `RESEND_API_KEY` present, `sendMail()` automatically switches to
   Resend and sends `From: EMAIL_FROM` (must be on the verified domain).

---

## The password-reset flow

```
/forgot  ──POST /api/auth/forgot──▶  create single-use token, email link
   │                                   (always returns ok: true — no email enumeration)
   ▼
email → /reset?token=…  ──POST /api/auth/reset──▶  consume token, set new passwordHash
```

- Tokens are random 32-byte values; only their SHA-256 hash is stored
  (`PasswordResetToken` model). They're **single-use** and expire after **1 hour**
  (`src/lib/auth/reset.ts`).
- `/api/auth/forgot` never reveals whether an email exists, and only emails
  accounts that actually have a password (Google-only accounts are skipped).
- Real delivery failures (SMTP/Resend down) are returned verbatim to the caller
  so they're never silently swallowed.

### Enabling the UI

Email/password sign-in (and the "Forgot password?" link) is hidden behind a
flag. Once email delivery works end-to-end, set:

```ini
NEXT_PUBLIC_PASSWORD_AUTH=true
```

and restart the dev server (`NEXT_PUBLIC_*` is inlined at build time).
