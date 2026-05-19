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
DEAL_IDS="${DEAL_IDS:-}"
STAGE_ID="${STAGE_ID:-}"
FIELD_ID="${FIELD_ID:-}"
CATEGORY_ID="${CATEGORY_ID:-}"
RANGE_FROM="${RANGE_FROM:-}"
RANGE_TO="${RANGE_TO:-}"
EXPECTED_COMMIT="${EXPECTED_COMMIT:-}"
PRODUCTION_SYNC_VERIFY_MODE="${PRODUCTION_SYNC_VERIFY_MODE:-run}"

log() {
  printf '[production-sync-verify] %s\n' "$*" >&2
}

validate_inputs() {
  if [[ ! "$PAPERCLIP_ISSUE" =~ ^BIT-[0-9]+$ ]]; then
    printf 'Invalid PAPERCLIP_ISSUE\n' >&2
    exit 64
  fi

  if [ "$MODULE" != "attraction" ] && [ "$MODULE" != "leadgen" ]; then
    printf 'MODULE must be attraction or leadgen\n' >&2
    exit 64
  fi

  if [ "$MODULE" = "attraction" ]; then
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
  fi

  if [ "$MODULE" = "leadgen" ]; then
    if [ "$CATEGORY_ID" != "28" ]; then
      printf 'Leadgen production proof is approved only for CATEGORY_ID=28\n' >&2
      exit 64
    fi

    if [ "$RANGE_FROM" != "2026-05-11T00:00:00.000Z" ] ||
      [ "$RANGE_TO" != "2026-05-17T23:59:59.999Z" ]; then
      printf 'Leadgen production proof is approved only for the frozen 2026-05-11..2026-05-17 range\n' >&2
      exit 64
    fi
  fi

  if [ -n "$EXPECTED_COMMIT" ] && [[ ! "$EXPECTED_COMMIT" =~ ^[0-9a-f]{7,40}$ ]]; then
    printf 'EXPECTED_COMMIT must be a git SHA prefix or full SHA\n' >&2
    exit 64
  fi
}

module_database_name() {
  if [ "$MODULE" = "leadgen" ]; then
    printf 'bitrix24-leadgen.db\n'
    return
  fi

  printf 'bitrix24-attraction.db\n'
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
  local database_name
  database_name="$(module_database_name)"
  local source="$DATA_DIR/$database_name"
  local backup_dir="$DATA_DIR/backups/production-ops"
  local backup

  if [ ! -f "$source" ]; then
    printf 'Module database not found: %s\n' "$source" >&2
    exit 70
  fi

  install -d -m 700 "$backup_dir"
  backup="$backup_dir/${database_name%.db}-${PAPERCLIP_ISSUE}-$(date -u +%Y%m%dT%H%M%SZ).db"
  cp -p "$source" "$backup"
  log "backup created: $backup"
}

container_node() {
  local container="$1"
  shift
  docker exec -i "$container" node "$@"
}

verify_runtime_paths() {
  local container="$1"
  docker exec \
    -e "PROD_VERIFY_MODULE=$MODULE" \
    -i \
    "$container" \
    node -e '
const platform = process.env.PLATFORM_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
const attraction = process.env.ATTRACTION_DATABASE_URL ?? "";
const leadgen = process.env.LEADGEN_DATABASE_URL ?? "";
const leadgenManagerCount = String(process.env.BITRIX24_LEADGEN_MANAGER_IDS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean).length;
const paths = { platform, attraction, leadgen };
const expected = {
  platform: "file:/app/data/bitrix24-reporting.db",
  attraction: "file:/app/data/bitrix24-attraction.db",
  leadgen: "file:/app/data/bitrix24-leadgen.db"
};
const leadgenProof = process.env.PROD_VERIFY_MODULE === "leadgen";
const comparablePaths = leadgenProof
  ? Object.values(paths)
  : [paths.platform, paths.attraction].filter(Boolean);
const distinct = new Set(comparablePaths).size === comparablePaths.length;
const matchesExpected = leadgenProof
  ? Object.entries(expected).every(([key, value]) => paths[key] === value)
  : paths.platform === expected.platform && paths.attraction === expected.attraction;
const result = {
  databaseEnvironment: {
    ...paths,
    distinct,
    matchesExpected,
    leadgenManagerCount
  }
};
console.log(JSON.stringify(result, null, 2));
if (!distinct || !matchesExpected) process.exit(2);
if (process.env.PROD_VERIFY_MODULE === "leadgen" && leadgenManagerCount <= 0) process.exit(3);
'
}

sync_endpoint() {
  if [ "$MODULE" = "leadgen" ]; then
    printf '%s/api/modules/leadgen/sync\n' "$PRODUCTION_URL"
    return
  fi

  printf '%s/api/sync\n' "$PRODUCTION_URL"
}

login_and_sync() {
  local container="$1"
  local cookie_file csrf_file body_file sync_file password login_json
  cookie_file="$(mktemp)"
  csrf_file="$(mktemp)"
  body_file="$(mktemp)"
  sync_file="$(mktemp)"
  trap "rm -f '$cookie_file' '$csrf_file' '$body_file' '$sync_file'" RETURN

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
    "$(sync_endpoint)" > "$sync_file"

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

  if [ "$MODULE" = "leadgen" ]; then
    verify_leadgen_workload_reports "$container" "$cookie_file"
  fi
}

verify_leadgen_snapshot_scope() {
  local container="$1"
  local snapshot_script='import Database from "better-sqlite3";

const rangeFrom = process.env.PROD_VERIFY_RANGE_FROM;
const rangeTo = process.env.PROD_VERIFY_RANGE_TO;
const managerIds = String(process.env.BITRIX24_LEADGEN_MANAGER_IDS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
if (managerIds.length <= 0) {
  console.log(JSON.stringify({
    leadgenSnapshotScope: {
      categoryId: "28",
      range: { from: rangeFrom, to: rangeTo },
      managerWhitelistCount: 0,
      totalRows: 0,
      categoryRows: 0,
      whitelistedRows: 0,
      outsideCategoryRows: 0,
      outsideWhitelistRows: 0
    }
  }, null, 2));
  process.exit(2);
}
const db = new Database("/app/data/bitrix24-leadgen.db", {
  readonly: true,
  fileMustExist: true
});
const placeholders = managerIds.map(() => "?").join(",");
const whereRange = "date_create >= ? AND date_create <= ?";
const row = db
  .prepare(
    `SELECT
      COUNT(*) AS totalRows,
      SUM(CASE WHEN category_id = ? THEN 1 ELSE 0 END) AS categoryRows,
      SUM(CASE WHEN assigned_by_id IN (${placeholders}) THEN 1 ELSE 0 END) AS whitelistedRows
    FROM deal_snapshots
    WHERE ${whereRange}`
  )
  .get("28", ...managerIds, rangeFrom, rangeTo);
db.close();

const totalRows = Number(row?.totalRows ?? 0);
const categoryRows = Number(row?.categoryRows ?? 0);
const whitelistedRows = Number(row?.whitelistedRows ?? 0);
const result = {
  leadgenSnapshotScope: {
    categoryId: "28",
    range: { from: rangeFrom, to: rangeTo },
    managerWhitelistCount: managerIds.length,
    totalRows,
    categoryRows,
    whitelistedRows,
    outsideCategoryRows: totalRows - categoryRows,
    outsideWhitelistRows: totalRows - whitelistedRows
  }
};
console.log(JSON.stringify(result, null, 2));
if (totalRows !== categoryRows || totalRows !== whitelistedRows) process.exit(3);'

  printf '%s\n' "$snapshot_script" | \
  docker exec \
    -e "PROD_VERIFY_RANGE_FROM=$RANGE_FROM" \
    -e "PROD_VERIFY_RANGE_TO=$RANGE_TO" \
    -i \
    "$container" \
    sh -lc 'cd /app/apps/api && node --input-type=module -'
}

verify_leadgen_workload_reports() {
  local container="$1"
  local cookie_file="$2"
  local activities_file calls_file
  activities_file="$(mktemp)"
  calls_file="$(mktemp)"

  curl -fsS \
    -b "$cookie_file" \
    -H 'Accept: application/json' \
    --get \
    --data-urlencode "from=$RANGE_FROM" \
    --data-urlencode "to=$RANGE_TO" \
    "$PRODUCTION_URL/api/modules/leadgen/reports/activities-workload" > "$activities_file"

  curl -fsS \
    -b "$cookie_file" \
    -H 'Accept: application/json' \
    --get \
    --data-urlencode "from=$RANGE_FROM" \
    --data-urlencode "to=$RANGE_TO" \
    "$PRODUCTION_URL/api/modules/leadgen/reports/calls-workload" > "$calls_file"

  {
    printf '%s\n' "$RANGE_FROM"
    printf '%s\n' "$RANGE_TO"
    cat "$activities_file"
    printf '\n'
    printf '__CALLS__\n'
    cat "$calls_file"
  } | container_node "$container" -e '
const input = require("node:fs").readFileSync(0, "utf8");
const [rangeFrom, rangeTo, ...jsonLines] = input.split("\n");
const separator = jsonLines.indexOf("__CALLS__");
if (separator === -1) throw new Error("Missing workload report separator");
const activities = JSON.parse(jsonLines.slice(0, separator).join("\n"));
const calls = JSON.parse(jsonLines.slice(separator + 1).join("\n"));

function requireNumber(value, key) {
  if (!Number.isFinite(value)) throw new Error(`Expected numeric ${key}`);
  return value;
}

function summarizeActivities(report) {
  if (report?.range?.from !== rangeFrom || report?.range?.to !== rangeTo) {
    throw new Error("Activities workload range mismatch");
  }
  const managerRows = Array.isArray(report.managerRows) ? report.managerRows : [];
  return {
    range: report.range,
    totalDealCount: requireNumber(report.totalDealCount, "activities.totalDealCount"),
    totalCreatedCount: requireNumber(report.totalCreatedCount, "activities.totalCreatedCount"),
    totalClosedCount: requireNumber(report.totalClosedCount, "activities.totalClosedCount"),
    totalMeetingCount: requireNumber(report.totalMeetingCount, "activities.totalMeetingCount"),
    warningCount: Array.isArray(report.warnings) ? report.warnings.length : 0,
    managerRowCount: managerRows.length,
    stageBreakdownCount: managerRows.reduce(
      (total, row) => total + (Array.isArray(row.stageBreakdown) ? row.stageBreakdown.length : 0),
      0
    )
  };
}

function summarizeCalls(report) {
  if (report?.range?.from !== rangeFrom || report?.range?.to !== rangeTo) {
    throw new Error("Calls workload range mismatch");
  }
  const managerRows = Array.isArray(report.managerRows) ? report.managerRows : [];
  return {
    range: report.range,
    totalDealCount: requireNumber(report.totalDealCount, "calls.totalDealCount"),
    totalCalls: requireNumber(report.totalCalls, "calls.totalCalls"),
    totalIncomingCalls: requireNumber(report.totalIncomingCalls, "calls.totalIncomingCalls"),
    totalOutgoingCalls: requireNumber(report.totalOutgoingCalls, "calls.totalOutgoingCalls"),
    totalConnectedCalls: requireNumber(report.totalConnectedCalls, "calls.totalConnectedCalls"),
    totalCallsOverThirtySeconds: requireNumber(
      report.totalCallsOverThirtySeconds,
      "calls.totalCallsOverThirtySeconds"
    ),
    warningCount: Array.isArray(report.warnings) ? report.warnings.length : 0,
    managerRowCount: managerRows.length,
    stageBreakdownCount: managerRows.reduce(
      (total, row) => total + (Array.isArray(row.stageBreakdown) ? row.stageBreakdown.length : 0),
      0
    )
  };
}

console.log(JSON.stringify({
  leadgenWorkloadReports: {
    activities: summarizeActivities(activities),
    calls: summarizeCalls(calls)
  }
}, null, 2));
'
  rm -f "$activities_file" "$calls_file"
}

verify_snapshot() {
  local container="$1"
  local snapshot_script='import Database from "better-sqlite3";

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
}'

  printf '%s\n' "$snapshot_script" | \
  docker exec \
    -e "PROD_VERIFY_DEAL_IDS=$DEAL_IDS" \
    -e "PROD_VERIFY_STAGE_ID=$STAGE_ID" \
    -e "PROD_VERIFY_FIELD_ID=$FIELD_ID" \
    -e "PROD_VERIFY_ISSUE=$PAPERCLIP_ISSUE" \
    -e "PROD_VERIFY_MODULE=$MODULE" \
    -i \
    "$container" \
    sh -lc 'cd /app/apps/api && node --input-type=module -'
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
  if [ "$PRODUCTION_SYNC_VERIFY_MODE" = "validate" ]; then
    exit 0
  fi
  verify_commit
  local container
  container="$(resolve_container)"
  log "container: $container"
  verify_runtime_paths "$container"
  make_backup
  login_and_sync "$container"
  if [ "$MODULE" = "leadgen" ]; then
    verify_leadgen_snapshot_scope "$container"
  else
    verify_snapshot "$container"
  fi
  verify_health "$container"
}

main "$@"
