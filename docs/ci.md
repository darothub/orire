# CI & merge gating

Continuous integration runs in GitHub Actions (`.github/workflows/ci.yml`) on
every pull request and on pushes to `main`. Three jobs:

- **Lint · Typecheck · Unit tests** — `npm ci` (which runs `prisma generate` via
  postinstall, so the Prisma client types are fresh), `npm run lint`,
  `npx next typegen`, `npx tsc --noEmit`, `npm test` (vitest).
- **Production build** — a full `next build`.
- **E2E · Playwright** — the hermetic smoke suite (stubs `/api/ai/*`, no real
  DB/SMTP); runs only after the first two are green.

No real database is touched — a dummy `DATABASE_URL` is enough for
`prisma generate` and `next build`, which don't open a connection. Deploys are
separate (Vercel's GitHub integration; see `deploy.md`).

## Require CI to pass before a merge

The workflow runs the checks, but **GitHub branch protection** is what blocks a
merge until they pass. It's a repo setting, so a repo admin enables it once —
either via the script or the UI.

### Option A — script (recommended)

```sh
gh auth login            # once, as a repo admin
sh scripts/setup-branch-protection.sh
```

This requires all three CI jobs to pass and the PR branch to be up to date with
`main` before merging (`strict`). It does not require a reviewer (solo repo —
the gate is CI, not review) and does not enforce on admins (the owner can bypass
in a genuine emergency). Edit the script to change either.

### Option B — GitHub UI

**Settings → Branches → Add branch ruleset** (or classic *Branch protection
rules*) for `main`:

1. **Require status checks to pass before merging** — add:
   `Lint · Typecheck · Unit tests`, `Production build`, `E2E · Playwright`.
2. **Require branches to be up to date before merging** (strict).
3. Leave "Require a pull request before merging / approvals" to taste — for a
   solo repo, requiring an approval would block your own merges.

> The required check names must match the CI jobs' `name:` fields verbatim. If
> you rename a job in `ci.yml`, update the protected contexts (and the script).
