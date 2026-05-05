#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${DEPLOY_APP_DIR:-/opt/bitrix24-reporting/app}"
COMPOSE_PROJECT="${DEPLOY_COMPOSE_PROJECT:-bitrix24-reporting}"
HEALTH_URL="${DEPLOY_HEALTH_URL:-https://dashboardpriv.claricont.com/api/health}"
TARGET_REF="${1:-}"

if [ -z "$TARGET_REF" ]; then
  printf 'Usage: %s <commit-or-ref>\n' "$0" >&2
  exit 1
fi

cd "$APP_DIR"
git fetch --prune origin
git checkout -B main "$TARGET_REF"
git reset --hard "$TARGET_REF"
git clean -fdx -e .env.production

resolved_ref="$(git rev-parse HEAD)"
build_status=0
printf '%s\n' "$resolved_ref" > .docker-source-revision
docker compose -p "$COMPOSE_PROJECT" build \
  --build-arg SOURCE_REVISION="$resolved_ref" \
  app || build_status=$?
rm -f .docker-source-revision

if [ "$build_status" -ne 0 ]; then
  exit "$build_status"
fi

docker compose -p "$COMPOSE_PROJECT" up -d --remove-orphans app

for _ in $(seq 1 30); do
  if curl -fsS "$HEALTH_URL" >/dev/null; then
    image_ref="$(
      docker compose -p "$COMPOSE_PROJECT" exec -T app \
        sh -c "cat /app/.build-revision 2>/dev/null || true" | tr -d "\r\n"
    )"
    if [ -n "$image_ref" ] && [ "$image_ref" != "$resolved_ref" ]; then
      printf 'Expected running image revision %s, got %s\n' "$resolved_ref" "$image_ref" >&2
      exit 1
    fi
    git rev-parse HEAD > .deploy-last-good
    printf 'Rolled back to %s\n' "$(git rev-parse --short HEAD)"
    exit 0
  fi
  sleep 2
done

printf 'Rollback container started, but health check failed: %s\n' "$HEALTH_URL" >&2
exit 1
