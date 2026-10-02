#!/usr/bin/env sh
# orire — bring up the local dev Postgres.
#
# Portable + self-healing:
#  - Uses the Debian-based `postgres:16` image (the Alpine variant crashes on
#    some hosts with "sh: locale not found" / "received fast shutdown").
#  - If a healthy `orire-pg` is already running, leaves it alone.
#  - If a stale/broken container exists (e.g. an old Alpine one that won't
#    start), removes and recreates it rather than failing. Dev data is
#    disposable — reapply the schema with `npm run db:migrate` / `prisma
#    migrate deploy` afterwards.
set -e

NAME=orire-pg
IMAGE=postgres:16
PORT=5433

if ! command -v docker >/dev/null 2>&1; then
  echo "error: docker is not installed or not on PATH." >&2
  echo "Install Docker Desktop (or point DATABASE_URL at your own Postgres)." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "error: the Docker daemon isn't running. Start Docker Desktop and retry." >&2
  exit 1
fi

# Already running? Done.
if [ -n "$(docker ps -q -f "name=^${NAME}$")" ]; then
  echo "${NAME} already running on localhost:${PORT}"
  exit 0
fi

# Exists but stopped/broken — drop it so we can recreate cleanly.
if [ -n "$(docker ps -aq -f "name=^${NAME}$")" ]; then
  echo "removing stale ${NAME} container…"
  docker rm -f "${NAME}" >/dev/null 2>&1 || true
fi

echo "starting ${NAME} (${IMAGE}) on localhost:${PORT}…"
docker run -d --name "${NAME}" \
  -e POSTGRES_USER=orire \
  -e POSTGRES_PASSWORD=orire \
  -e POSTGRES_DB=orire \
  -p "${PORT}:5432" \
  "${IMAGE}" >/dev/null

# Wait for readiness so a following migrate/dev doesn't race the boot.
printf "waiting for postgres"
i=0
while [ "$i" -lt 30 ]; do
  if docker exec "${NAME}" pg_isready -U orire >/dev/null 2>&1; then
    echo " — ready."
    exit 0
  fi
  printf "."
  i=$((i + 1))
  sleep 1
done

echo >&2
echo "error: ${NAME} did not become ready in time. Check: docker logs ${NAME}" >&2
exit 1
