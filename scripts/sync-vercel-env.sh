#!/usr/bin/env bash
# sync-vercel-env.sh — push SOPS-encrypted config into Vercel's env store.
#
# Vercel can't run SOPS at build/runtime, so this decrypts the canonical
# central-config bundle locally and mirrors each variable into Vercel for a
# chosen target environment. SOPS stays the single source of truth; Vercel
# holds a synced snapshot. Re-run this whenever a value changes in SOPS.
#
# Usage:
#   scripts/sync-vercel-env.sh [production|preview|development]
#   scripts/sync-vercel-env.sh production
#
# Requires:
#   - vercel CLI installed and the project linked (`vercel link`) — i.e. a
#     .vercel/project.json exists in this repo.
#   - the central-config repo checked out (sibling ../central-config by default,
#     or set CENTRAL_CONFIG_DIR) with the matching age key available so its
#     scripts/pull.sh can decrypt (see central-config/scripts/bootstrap.sh).
#
# Env knobs:
#   CENTRAL_CONFIG_DIR   path to the central-config checkout (default: ../central-config)
#   PROJECT              central-config project name (default: orire)
#   SOPS_ENV             which SOPS env bundle to pull (default: mirrors the
#                        Vercel target; production→prod, preview/development→dev)
set -euo pipefail

TARGET="${1:-production}"
case "$TARGET" in
  production|preview|development) ;;
  *) echo "error: target must be production, preview or development (got '$TARGET')" >&2; exit 1 ;;
esac

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CENTRAL_CONFIG_DIR="${CENTRAL_CONFIG_DIR:-$REPO_ROOT/../central-config}"
PROJECT="${PROJECT:-orire}"

# Map the Vercel target to a SOPS env bundle unless overridden.
if [[ -z "${SOPS_ENV:-}" ]]; then
  case "$TARGET" in
    production) SOPS_ENV="prod" ;;
    *)          SOPS_ENV="dev" ;;
  esac
fi

if ! command -v vercel >/dev/null 2>&1; then
  echo "error: vercel CLI not found. Install it: npm i -g vercel" >&2
  exit 1
fi
if [[ ! -f "$REPO_ROOT/.vercel/project.json" ]]; then
  echo "error: this repo isn't linked to a Vercel project yet." >&2
  echo "  Run:  vercel link    (from $REPO_ROOT)" >&2
  exit 1
fi
if [[ ! -x "$CENTRAL_CONFIG_DIR/scripts/pull.sh" ]]; then
  echo "error: central-config not found at $CENTRAL_CONFIG_DIR" >&2
  echo "  Clone it or set CENTRAL_CONFIG_DIR=/path/to/central-config" >&2
  exit 1
fi

# Decrypt the merged bundle (shared + project, project wins) to a temp file.
TMP_ENV="$(mktemp -t orire-vercel-env.XXXXXX)"
cleanup() { rm -f "$TMP_ENV"; }
trap cleanup EXIT

echo "→ decrypting $PROJECT/$SOPS_ENV from $CENTRAL_CONFIG_DIR …"
sh "$CENTRAL_CONFIG_DIR/scripts/pull.sh" "$PROJECT" "$SOPS_ENV" >"$TMP_ENV"

# NEXT_PUBLIC_* are inlined at build time, so they must exist in Vercel BEFORE
# the build runs — this script handles that by pushing them like any other var.
pushed=0
skipped=0
while IFS= read -r line || [[ -n "$line" ]]; do
  # Skip blanks and comments.
  [[ -z "${line// }" ]] && continue
  [[ "$line" == \#* ]] && continue
  # Split on the FIRST '=' only; values may legitimately contain '='.
  key="${line%%=*}"
  value="${line#*=}"
  key="${key// /}"
  [[ -z "$key" ]] && continue
  # Strip one layer of surrounding quotes if present.
  value="${value%\"}"; value="${value#\"}"
  value="${value%\'}"; value="${value#\'}"

  # Don't ship dev-only Mailpit SMTP vars to a production target.
  if [[ "$TARGET" == "production" && "$key" == MAIL_SMTP_* ]]; then
    skipped=$((skipped + 1)); continue
  fi

  # Skip empty values — vercel env add requires a non-empty stdin.
  if [[ -z "$value" ]]; then
    skipped=$((skipped + 1)); continue
  fi

  # Replace any existing value, then add the current one.
  vercel env rm "$key" "$TARGET" --yes >/dev/null 2>&1 || true
  # NEXT_PUBLIC_* variables must be explicitly marked as config (public).
  type_flag=""
  if [[ "$key" == NEXT_PUBLIC_* ]]; then
    type_flag="--type config"
  fi
  # shellcheck disable=SC2086
  printf '%s' "$value" | vercel env add "$key" "$TARGET" $type_flag --yes >/dev/null 2>&1
  echo "  ✓ $key"
  pushed=$((pushed + 1))
done <"$TMP_ENV"

echo "✓ synced $pushed vars to Vercel ($TARGET); skipped $skipped."
echo "  Trigger a redeploy for the changes to take effect:  vercel --prod"
