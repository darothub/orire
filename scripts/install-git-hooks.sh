#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
chmod +x .githooks/pre-push
git config --local core.hooksPath .githooks
echo "Orire pre-push checks installed. They lint changed JS/TS files and run related unit tests; no build is run."
