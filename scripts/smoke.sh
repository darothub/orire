#!/usr/bin/env bash
# smoke.sh — quick smoke test against a RUNNING orire server (local or prod).
#
# Confirms the server is up, the public/SEO/legal routes render, the health
# check passes, and protected API routes reject unauthenticated calls. The
# genuinely interactive flows (upload, rebrand, export, Stripe checkout) need a
# browser + DB + Stripe and are listed as a manual checklist at the end.
#
# Usage:
#   scripts/smoke.sh                      # defaults to http://localhost:3000
#   BASE_URL=https://orire.app scripts/smoke.sh
#   scripts/smoke.sh https://orire.app
set -u

BASE_URL="${1:-${BASE_URL:-http://localhost:3000}}"
BASE_URL="${BASE_URL%/}"   # strip trailing slash
PASS=0; FAIL=0

# check <METHOD> <path> <expected-codes-csv> <label>
check() {
  method="$1"; path="$2"; expected="$3"; label="$4"
  code=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" --max-time 20 "$BASE_URL$path" 2>/dev/null)
  case ",$expected," in
    *",$code,"*) printf '  \033[32mPASS\033[0m  %-5s %-34s %s (%s)\n' "$method" "$path" "$code" "$label"; PASS=$((PASS+1));;
    *)           printf '  \033[31mFAIL\033[0m  %-5s %-34s %s (want %s — %s)\n' "$method" "$path" "$code" "$expected" "$label"; FAIL=$((FAIL+1));;
  esac
}

echo "orire smoke test → $BASE_URL"
echo

echo "Health:"
check GET /api/health 200 "DB reachable (503 = DB down)"

echo "Public + content pages:"
check GET /                                      200 "landing"
check GET /templates                             200 "gallery index"
check GET /templates/aurora                       200 "template detail"
check GET /templates/does-not-exist              404 "unknown template 404s"
check GET /guides                                200 "guides index"
check GET /guides/tailor-cv-to-job-description   200 "guide article"
check GET /privacy                               200 "privacy policy"
check GET /terms                                 200 "terms of service"

echo "SEO:"
check GET /robots.txt                            200 "robots"
check GET /sitemap.xml                           200 "sitemap"

echo "Protected APIs reject unauthenticated calls:"
check POST /api/parse                            400,401 "parse validates/guards"
check POST /api/ai/refine                        400,401,403 "refine guarded"

echo
echo "Result: $PASS passed, $FAIL failed."
echo
echo "Manual checklist (needs a browser + DB + Stripe test mode):"
cat <<'EOF'
  [ ] Sign up + email verification completes
  [ ] Upload a messy multi-page PDF — parses into sections
  [ ] Upload a DOCX — parses into sections
  [ ] Rebrand / refine run produces output (no invented facts)
  [ ] Export PDF — opens, text is selectable (ATS-parseable)
  [ ] Cookie banner: Accept loads analytics; Decline keeps them off
  [ ] Stripe checkout with test card 4242 4242 4242 4242 → Pro unlocks
  [ ] Prod only: APP_URL is https://orire.app (robots/sitemap/canonical)
EOF

[ "$FAIL" -eq 0 ]
