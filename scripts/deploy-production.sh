#!/usr/bin/env bash
# Use this path for manual production deployments. Git-triggered Vercel deploys
# bypass this local gate; see docs/deploy.md for that limitation.
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "$(git branch --show-current)" != "main" ]]; then
  echo "ERROR: deploy from main, not a feature branch." >&2; exit 1
fi
if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: working tree is not clean." >&2; exit 1
fi
git fetch origin main --quiet
if [[ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]]; then
  echo "ERROR: local main is not the current origin/main." >&2; exit 1
fi
npm run config:check:prod
vercel --prod
