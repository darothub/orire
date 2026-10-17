#!/usr/bin/env sh
# orire — enable branch protection on `main` so a PR can only merge when CI is green.
#
# Run ONCE, by a repo admin, with the GitHub CLI authenticated to an account
# that can administer the repo:
#
#   gh auth login            # if not already
#   sh scripts/setup-branch-protection.sh
#
# It requires the three CI jobs (see .github/workflows/ci.yml) to pass, and
# requires the PR branch to be up to date with main before merging ("strict").
# It does NOT require a reviewer (this is a solo repo; the gate is CI, not
# review) and does NOT enforce on admins (so the owner can bypass in a genuine
# emergency). Adjust `enforce_admins` / `required_pull_request_reviews` below if
# that changes.
#
# The required contexts are the CI jobs' `name:` fields verbatim — keep them in
# sync with .github/workflows/ci.yml if you rename a job.

set -eu

REPO="${1:-darothub/orire}"
BRANCH="${2:-main}"

echo "Enabling branch protection on ${REPO}@${BRANCH}…"

gh api -X PUT "repos/${REPO}/branches/${BRANCH}/protection" --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Lint · Typecheck · Unit tests",
      "Production build",
      "E2E · Playwright"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null
}
JSON

echo "Done. A PR to ${BRANCH} now merges only when all three CI checks pass."
