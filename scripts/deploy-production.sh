#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${DEPLOY_APP_DIR:-/opt/bitrix24-reporting/app}"
DATA_DIR="${DEPLOY_DATA_DIR:-/opt/bitrix24-reporting/data}"
REPO_URL="${DEPLOY_REPO:?DEPLOY_REPO is required}"
DEPLOY_REF="${DEPLOY_REF:?DEPLOY_REF is required}"
COMPOSE_PROJECT="${DEPLOY_COMPOSE_PROJECT:-bitrix24-reporting}"
HEALTH_URL="${DEPLOY_HEALTH_URL:-https://dashboardpriv.claricont.com/api/health}"
DASHBOARD_URL="${DEPLOY_DASHBOARD_URL:-https://dashboardpriv.claricont.com/api/dashboard}"
BACKUP_ROOT="${DEPLOY_BACKUP_ROOT:-/opt/bitrix24-reporting/backups/deploy}"

log() {
  printf '[deploy] %s\n' "$*"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

wait_for_http_code() {
  local url="$1"
  local expected="$2"
  local code

  for _ in $(seq 1 30); do
    code="$(curl -fsS -o /dev/null -w '%{http_code}' "$url" || true)"
    if [ "$code" = "$expected" ]; then
      return 0
    fi
    sleep 2
  done

  printf 'Expected %s from %s, got %s\n' "$expected" "$url" "${code:-none}" >&2
  return 1
}

build_compose_project() {
  local ref="$1"
  local build_status=0

  printf '%s\n' "$ref" > .docker-source-revision
  docker compose -p "$COMPOSE_PROJECT" build \
    --build-arg SOURCE_REVISION="$ref" \
    app || build_status=$?
  rm -f .docker-source-revision

  if [ "$build_status" -ne 0 ]; then
    return "$build_status"
  fi

  docker compose -p "$COMPOSE_PROJECT" up -d --remove-orphans app
}

verify_image_revision() {
  local expected_ref="$1"
  local allow_missing="${2:-false}"
  local actual_ref

  actual_ref="$(
    docker compose -p "$COMPOSE_PROJECT" exec -T app \
      sh -c "cat /app/.build-revision 2>/dev/null || true" | tr -d "\r\n"
  )"

  if [ -z "$actual_ref" ] && [ "$allow_missing" = "true" ]; then
    log "Warning: running image has no build revision marker; accepting legacy rollback image"
    return 0
  fi

  if [ "$actual_ref" != "$expected_ref" ]; then
    printf 'Expected running image revision %s, got %s\n' "$expected_ref" "${actual_ref:-missing}" >&2
    return 1
  fi
}

clone_or_update_repo() {
  install -d -m 755 "$(dirname "$APP_DIR")"

  if [ ! -d "$APP_DIR/.git" ]; then
    local backup=""
    local env_backup=""

    if [ -d "$APP_DIR" ] && [ "$(find "$APP_DIR" -mindepth 1 -maxdepth 1 | head -n 1)" ]; then
      install -d -m 700 "$BACKUP_ROOT"
      backup="$BACKUP_ROOT/app-before-git-$(date +%Y%m%d%H%M%S)"
      log "Moving existing non-git app directory to $backup"
      mv "$APP_DIR" "$backup"
      if [ -f "$backup/.env.production" ]; then
        env_backup="$backup/.env.production"
      fi
    fi

    log "Cloning repository"
    git clone "$REPO_URL" "$APP_DIR"

    if [ -n "$env_backup" ]; then
      cp "$env_backup" "$APP_DIR/.env.production"
      chmod 600 "$APP_DIR/.env.production"
    fi
  fi
}

verify_runtime() {
  local expected_ref="$1"
  local allow_missing_revision="${2:-false}"

  verify_image_revision "$expected_ref" "$allow_missing_revision"
  wait_for_http_code "$HEALTH_URL" 200

  local dashboard_code
  dashboard_code="$(curl -fsS -o /dev/null -w '%{http_code}' "$DASHBOARD_URL" || true)"
  if [ "$dashboard_code" != "401" ]; then
    printf 'Expected unauthenticated dashboard to return 401, got %s\n' "$dashboard_code" >&2
    return 1
  fi

  local app_uid
  app_uid="$(docker compose -p "$COMPOSE_PROJECT" exec -T app id -u)"
  if [ "$app_uid" = "0" ]; then
    printf 'App container is running as root\n' >&2
    return 1
  fi

  local published
  published="$(docker compose -p "$COMPOSE_PROJECT" ps --format json | grep -E '"PublishedPort":8787|"URL":"127.0.0.1"' || true)"
  if [ -z "$published" ]; then
    log "Warning: could not confirm localhost-only published port from compose JSON"
  fi
}

main() {
  require_command git
  require_command docker
  require_command curl

  install -d -o 10001 -g 10001 -m 700 "$DATA_DIR"
  clone_or_update_repo

  cd "$APP_DIR"

  if [ ! -f .env.production ]; then
    printf '%s/.env.production is missing\n' "$APP_DIR" >&2
    exit 1
  fi
  chmod 600 .env.production

  local previous_ref=""
  previous_ref="$(git rev-parse HEAD 2>/dev/null || true)"

  log "Fetching $DEPLOY_REF"
  git fetch --prune origin
  git checkout -B main "$DEPLOY_REF"
  git reset --hard "$DEPLOY_REF"
  git clean -fdx -e .env.production

  log "Building and starting compose project"
  if ! build_compose_project "$DEPLOY_REF"; then
    if [ -n "$previous_ref" ]; then
      log "Build/start failed, rolling back to $previous_ref"
      git reset --hard "$previous_ref"
      git clean -fdx -e .env.production
      build_compose_project "$previous_ref"
    fi
    exit 1
  fi

  if ! verify_runtime "$DEPLOY_REF"; then
    if [ -n "$previous_ref" ]; then
      log "Runtime verification failed, rolling back to $previous_ref"
      git reset --hard "$previous_ref"
      git clean -fdx -e .env.production
      build_compose_project "$previous_ref"
      verify_runtime "$previous_ref" true
    fi
    exit 1
  fi

  git rev-parse HEAD > .deploy-last-good
  log "Deployed $(git rev-parse --short HEAD)"
}

main "$@"
