#!/usr/bin/env sh
# orire — bring up the local dev mail sink (Mailpit).
#
# Mailpit captures every email the app "sends" in development so nothing leaves
# your machine and no SMTP account is required. It exposes:
#   - SMTP on localhost:1025  (what the app talks to — see src/lib/email/mailer.ts)
#   - Web UI on http://localhost:8025  (open to read the captured messages)
#
# Self-healing like db-up.sh: leaves a healthy container alone, recreates a
# stale one. Captured mail is disposable.
set -e

NAME=orire-mail
IMAGE=axllent/mailpit:latest
SMTP_PORT=1025
UI_PORT=8025

if ! command -v docker >/dev/null 2>&1; then
  echo "error: docker is not installed or not on PATH." >&2
  echo "Install Docker Desktop, or point MAIL_SMTP_HOST/PORT at your own SMTP sink." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "error: the Docker daemon isn't running. Start Docker Desktop and retry." >&2
  exit 1
fi

if [ -n "$(docker ps -q -f "name=^${NAME}$")" ]; then
  echo "${NAME} already running — SMTP localhost:${SMTP_PORT}, UI http://localhost:${UI_PORT}"
  exit 0
fi

if [ -n "$(docker ps -aq -f "name=^${NAME}$")" ]; then
  echo "removing stale ${NAME} container…"
  docker rm -f "${NAME}" >/dev/null 2>&1 || true
fi

echo "starting ${NAME} (${IMAGE})…"
docker run -d --name "${NAME}" \
  -p "${SMTP_PORT}:1025" \
  -p "${UI_PORT}:8025" \
  "${IMAGE}" >/dev/null

echo "ready — SMTP localhost:${SMTP_PORT}, inbox http://localhost:${UI_PORT}"
