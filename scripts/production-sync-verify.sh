#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/bitrix24-reporting/app}"
DATA_DIR="${DATA_DIR:-/opt/bitrix24-reporting/data}"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-bitrix24-reporting}"
PRODUCTION_URL="${PRODUCTION_URL:-https://dashboardpriv.claricont.com}"
ADMIN_LOGIN="${ADMIN_LOGIN:-admin}"
ADMIN_PASSWORD_FILE="${ADMIN_PASSWORD_FILE:-/root/bitrix24-reporting-admin-password.txt}"

PAPERCLIP_ISSUE="${PAPERCLIP_ISSUE:?PAPERCLIP_ISSUE is required, e.g. BIT-73}"
MODULE="${MODULE:?MODULE is required}"
DEAL_IDS="${DEAL_IDS:?DEAL_IDS is required, comma-separated numeric IDs}"
STAGE_ID="${STAGE_ID:?STAGE_ID is required}"
FIELD_ID="${FIELD_ID:?FIELD_ID is required}"
EXPECTED_COMMIT="${EXPECTED_COMMIT:-}"

log() {
  printf '[production-sync-verify] %s\n' "$*" >&2
}

validate_inputs() {
  if [[ ! "$PAPERCLIP_ISSUE" =~ ^BIT-[0-9]+$ ]]; then
    printf 'Invalid PAPERCLIP_ISSUE\n' >&2
    exit 64
  fi

  if [ "$MODULE" != "attraction" ]; then
    printf 'Only MODULE=attraction is currently allowed\n' >&2
    exit 64
  fi

  if [[ ! "$STAGE_ID" =~ ^C10:[A-Z0-9_]+$ ]]; then
    printf 'Only attraction category 10 stage IDs are currently allowed\n' >&2
    exit 64
  fi

  if [[ ! "$FIELD_ID" =~ ^UF_CRM_[0-9]+$ ]]; then
    printf 'FIELD_ID must be a Bitrix UF_CRM_* field id\n' >&2
    exit 64
  fi

  IFS=',' read -r -a ids <<< "$DEAL_IDS"
  if [ "${#ids[@]}" -eq 0 ] || [ "${#ids[@]}" -gt 50 ]; then
    printf 'DEAL_IDS must contain 1..50 IDs\n' >&2
    exit 64
  fi

  for id in "${ids[@]}"; do
    if [[ ! "$id" =~ ^[0-9]+$ ]]; then
      printf 'DEAL_IDS must be numeric only\n' >&2
      exit 64
    fi
  done

  if [ -n "$EXPECTED_COMMIT" ] && [[ ! "$EXPECTED_COMMIT" =~ ^[0-9a-f]{7,40}$ ]]; then
    printf 'EXPECTED_COMMIT must be a git SHA prefix or full SHA\n' >&2
    exit 64
  fi
}

resolve_container() {
  local container_id
  container_id="$(docker compose -p "$COMPOSE_PROJECT" ps -q app)"
  if [ -z "$container_id" ]; then
    printf 'App container not found for compose project %s\n' "$COMPOSE_PROJECT" >&2
    exit 70
  fi
  printf '%s\n' "$container_id"
}

verify_commit() {
  cd "$APP_DIR"
  local current
  current="$(git rev-parse HEAD)"
  log "app commit: $current"

  if [ -n "$EXPECTED_COMMIT" ]; then
    git cat-file -e "${EXPECTED_COMMIT}^{commit}"
    if ! git merge-base --is-ancestor "$EXPECTED_COMMIT" "$current"; then
      printf 'Production commit %s does not include expected commit %s\n' "$current" "$EXPECTED_COMMIT" >&2
      exit 70
    fi
  fi
}

make_backup() {
  local source="$DATA_DIR/bitrix24-attraction.db"
  local backup_dir="$DATA_DIR/backups/production-ops"
  local backup

  if [ ! -f "$source" ]; then
    printf 'Attraction database not found: %s\n' "$source" >&2
    exit 70
  fi

  install -d -m 700 "$backup_dir"
  backup="$backup_dir/bitrix24-attraction-${PAPERCLIP_ISSUE}-$(date -u +%Y%m%dT%H%M%SZ).db"
  cp -p "$source" "$backup"
  log "backup created: $backup"
}

container_node() {
  local container="$1"
  shift
  docker exec -i "$container" node "$@"
}

login_and_sync() {
  local container="$1"
  local cookie_file csrf_file body_file sync_file password login_json
  cookie_file="$(mktemp)"
  csrf_file="$(mktemp)"
  body_file="$(mktemp)"
  sync_file="$(mktemp)"
  trap 'rm -f "$cookie_file" "$csrf_file" "$body_file" "$sync_file"' RETURN

  if [ ! -r "$ADMIN_PASSWORD_FILE" ]; then
    printf 'Admin password file is not readable: %s\n' "$ADMIN_PASSWORD_FILE" >&2
    exit 70
  fi

  password="$(tr -d '\r\n' < "$ADMIN_PASSWORD_FILE")"
  login_json="$(
    {
      printf '%s\n' "$ADMIN_LOGIN"
      printf '%s' "$password"
    } | container_node "$container" -e '
const input = require("node:fs").readFileSync(0, "utf8");
const separator = input.indexOf("\n");
if (separator === -1) process.exit(2);
const login = input.slice(0, separator);
const password = input.slice(separator + 1);
process.stdout.write(JSON.stringify({ login, password }));
'
  )"

  curl -fsS \
    -c "$cookie_file" \
    -H 'Content-Type: application/json' \
    --data-binary "$login_json" \
    "$PRODUCTION_URL/api/auth/login" > "$body_file"

  container_node "$container" -e '
const body = JSON.parse(require("node:fs").readFileSync(0, "utf8"));
if (!body.csrfToken) {
  process.exit(2);
}
process.stdout.write(body.csrfToken);
' < "$body_file" > "$csrf_file"

  curl -fsS \
    --max-time 900 \
    -b "$cookie_file" \
    -H "X-CSRF-Token: $(cat "$csrf_file")" \
    -H 'Accept: application/json' \
    -X POST \
    "$PRODUCTION_URL/api/sync" > "$sync_file"

  container_node "$container" -e '
const summary = JSON.parse(require("node:fs").readFileSync(0, "utf8"));
const sanitized = {
  syncRunId: summary.syncRunId ?? null,
  mode: summary.mode ?? null,
  finishedAt: summary.finishedAt ?? null,
  changes: summary.changes ?? null,
  diagnosticsCount: Array.isArray(summary.diagnostics) ? summary.diagnostics.length : 0
};
console.log(JSON.stringify({ sync: sanitized }, null, 2));
' < "$sync_file"
}

verify_snapshot() {
  local container="$1"
  docker exec \
    -e "PROD_VERIFY_DEAL_IDS=$DEAL_IDS" \
    -e "PROD_VERIFY_STAGE_ID=$STAGE_ID" \
    -e "PROD_VERIFY_FIELD_ID=$FIELD_ID" \
    -e "PROD_VERIFY_ISSUE=$PAPERCLIP_ISSUE" \
    -e "PROD_VERIFY_MODULE=$MODULE" \
    "$container" \
    sh -lc 'cd /app/apps/api && node --input-type=module' <<'NODE'
import Database from "better-sqlite3";

const ids = String(process.env.PROD_VERIFY_DEAL_IDS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const expectedStageId = process.env.PROD_VERIFY_STAGE_ID;
const expectedFieldId = process.env.PROD_VERIFY_FIELD_ID;
const db = new Database("/app/data/bitrix24-attraction.db", {
  readonly: true,
  fileMustExist: true
});
const rows = db
  .prepare(
    `SELECT
      id AS dealId,
      category_id AS categoryId,
      stage_id AS stageId,
      refusal_reason_value AS refusalReasonValue
    FROM deal_snapshots
    WHERE id IN (${ids.map(() => "?").join(",")})
    ORDER BY CAST(id AS INTEGER) ASC`
  )
  .all(...ids);
db.close();

const result = {
  operation: "production-sync-verify",
  issue: process.env.PROD_VERIFY_ISSUE,
  module: process.env.PROD_VERIFY_MODULE,
  expected: {
    fieldId: expectedFieldId,
    categoryId: "10",
    stageId: expectedStageId,
    requestedDealIds: ids
  },
  counts: {
    requested: ids.length,
    rows: rows.length,
    category10: rows.filter((row) => String(row.categoryId) === "10").length,
    expectedStage: rows.filter((row) => row.stageId === expectedStageId).length,
    nonEmptyReasons: rows.filter((row) =>
      String(row.refusalReasonValue ?? "").trim()
    ).length
  },
  rows: rows.map((row) => ({
    dealId: String(row.dealId),
    categoryId: row.categoryId,
    stageId: row.stageId,
    hasReason: Boolean(String(row.refusalReasonValue ?? "").trim()),
    refusalReasonValue: row.refusalReasonValue
  }))
};

const ok =
  result.counts.rows === ids.length &&
  result.counts.category10 === ids.length &&
  result.counts.expectedStage === ids.length &&
  result.counts.nonEmptyReasons === ids.length;

console.log(JSON.stringify(result, null, 2));
if (!ok) {
  process.exit(2);
}
NODE
}

verify_health() {
  local container="$1"
  curl -fsS "$PRODUCTION_URL/api/health" | container_node "$container" -e '
const body = JSON.parse(require("node:fs").readFileSync(0, "utf8"));
if (body.ok !== true) process.exit(2);
console.log(JSON.stringify({ health: "ok" }, null, 2));
'
}

main() {
  validate_inputs
  verify_commit
  local container
  container="$(resolve_container)"
  log "container: $container"
  make_backup
  login_and_sync "$container"
  verify_snapshot "$container"
  verify_health "$container"
}

main "$@"
