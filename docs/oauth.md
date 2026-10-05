# OAuth sign-in setup

orire uses [Auth.js (NextAuth v5)](https://authjs.dev) with the Prisma adapter
and a **database session** strategy. Three sign-in methods are wired in
`src/lib/auth/auth.ts`:

| Method | When it turns on |
| --- | --- |
| Magic-link email | Always on. Without SMTP the link is printed to the server terminal (dev). |
| **Google** | Automatically, when `AUTH_GOOGLE_ID` **and** `AUTH_GOOGLE_SECRET` are set. |
| **GitHub** | Automatically, when `AUTH_GITHUB_ID` **and** `AUTH_GITHUB_SECRET` are set. |

No code change is needed to enable OAuth — provision the apps, set the env vars,
restart. The sign-in overlay's provider buttons light up for whichever
providers the server has configured.

---

## Prerequisites

1. A reachable base URL for each environment:
   - Local: `http://localhost:3001`
   - Production: `https://your-domain.com`
2. The database is up and migrated (sessions/accounts persist via Prisma):
   ```sh
   npm run db:up
   npx prisma migrate deploy
   ```
3. `AUTH_SECRET` is set (`npx auth secret`) and, in production, `AUTH_TRUST_HOST=true`.
4. In production also set the canonical origin so callback URLs resolve:
   ```sh
   AUTH_URL=https://your-domain.com
   ```

### Callback (redirect) URLs

Auth.js derives these automatically. Register them **exactly** in each provider:

| Provider | Authorized redirect URI |
| --- | --- |
| Google | `http://localhost:3001/api/auth/callback/google` (dev) · `https://your-domain.com/api/auth/callback/google` (prod) |
| GitHub | `http://localhost:3001/api/auth/callback/github` (dev) · `https://your-domain.com/api/auth/callback/github` (prod) |

---

## Google

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and
   select (or create) a project.
2. **APIs & Services → OAuth consent screen**:
   - User type: **External** (or Internal for a Workspace org).
   - Fill app name, support email, developer contact. Add the scopes
     `openid`, `email`, `profile` (the defaults Auth.js requests).
   - While in **Testing**, add your own Google account under **Test users**.
     Publish the app for general availability.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized JavaScript origins**: `http://localhost:3001` and
     `https://your-domain.com`.
   - **Authorized redirect URIs**: the two Google URIs from the table above.
4. Copy the **Client ID** and **Client secret** into `.env`:
   ```sh
   AUTH_GOOGLE_ID=xxxxxxxx.apps.googleusercontent.com
   AUTH_GOOGLE_SECRET=xxxxxxxx
   ```

---

## GitHub

1. Go to **GitHub → Settings → Developer settings →
   [OAuth Apps](https://github.com/settings/developers) → New OAuth App**
   (or create one under an organization's settings for a team-owned app).
2. Fill in:
   - **Homepage URL**: `https://your-domain.com` (use `http://localhost:3001` for a dev app).
   - **Authorization callback URL**: the matching GitHub URI from the table above.
     A single OAuth app allows **one** callback URL — create separate apps for
     dev and production.
3. **Generate a new client secret**, then copy both values into `.env`:
   ```sh
   AUTH_GITHUB_ID=Iv1.xxxxxxxx
   AUTH_GITHUB_SECRET=xxxxxxxx
   ```

---

## Verify

1. Restart the server so new env is read (env is read once at boot):
   ```sh
   PORT=3001 npm run dev
   ```
2. Open the app, trigger the sign-in overlay, and confirm the **Continue with
   Google / GitHub** buttons are enabled (disabled buttons mean the server
   didn't see that provider's id/secret).
3. Complete a round trip. On success a `User`, `Account`, and `Session` row are
   created in Postgres (check with `npm run db:studio`).

### Common failures

- **`redirect_uri_mismatch`** — the URI registered with the provider doesn't
  byte-for-byte match `<origin>/api/auth/callback/<provider>`. Watch for
  `http` vs `https`, a trailing slash, or the wrong port.
- **Buttons stay disabled** — the id/secret env vars weren't present at boot, or
  only one of the pair is set. Both are required.
- **Works locally, fails in prod** — set `AUTH_URL` and `AUTH_TRUST_HOST=true`,
  and register the production callback URL (GitHub needs a separate app).
- **Google "access blocked / app not verified"** — the consent screen is still
  in Testing with your account not added as a test user, or the app needs
  publishing/verification for external users.

---

## Production checklist

- [ ] `AUTH_SECRET` set (strong, unique per environment)
- [ ] `AUTH_URL=https://your-domain.com`
- [ ] `AUTH_TRUST_HOST=true`
- [ ] Google OAuth client with production origin + redirect URI; consent screen published
- [ ] GitHub production OAuth app with production callback URL
- [ ] `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` / `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` set
- [ ] Database migrated and reachable (`DATABASE_URL`)
- [ ] Round-trip sign-in verified for each provider
