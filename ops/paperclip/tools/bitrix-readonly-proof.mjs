#!/usr/bin/env node

import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const ALLOWED_CUSTOM_FIELD_RE = /^UF_CRM_\d+$/;
const SAFE_DEAL_FIELDS = new Set(["ID", "CATEGORY_ID", "STAGE_ID", "STAGE_SEMANTIC_ID"]);
const MAX_DEAL_IDS = 50;
const MAX_CUSTOM_FIELDS = 20;
const MAX_KEYWORDS = 20;
const DEAL_OWNER_TYPE_ID = "2";
const WORKLOAD_ACTIVITY_OWNER_CHUNK_SIZE = 10;
const WORKLOAD_OWNER_CHUNK_SIZE = 20;

const requireFromApi = createRequire(new URL("../../../apps/api/package.json", import.meta.url));

function fail(message) {
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
}

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) fail(`Missing required env: ${name}`);
  return value;
}

function parseArgs(argv) {
  const [mode, ...rest] = argv;
  const args = {};
  for (let index = 0; index < rest.length; index += 1) {
    const part = rest[index];
    if (!part.startsWith("--")) fail(`Unexpected argument: ${part}`);
    const key = part.slice(2);
    const value = rest[index + 1];
    if (!value || value.startsWith("--")) fail(`Missing value for --${key}`);
    args[key] = value;
    index += 1;
  }
  return { mode, args };
}

function splitCsv(value) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseDealIds(value) {
  const ids = splitCsv(value);
  if (ids.length === 0) fail("At least one deal ID is required.");
  if (ids.length > MAX_DEAL_IDS) fail(`Too many deal IDs; max ${MAX_DEAL_IDS}.`);
  for (const id of ids) {
    if (!/^\d+$/.test(id)) fail(`Invalid deal ID: ${id}`);
  }
  return ids;
}

function parseCustomFields(value) {
  const fields = splitCsv(value);
  if (fields.length === 0) fail("At least one custom field is required.");
  if (fields.length > MAX_CUSTOM_FIELDS) fail(`Too many custom fields; max ${MAX_CUSTOM_FIELDS}.`);
  for (const field of fields) {
    if (!ALLOWED_CUSTOM_FIELD_RE.test(field)) fail(`Forbidden custom field: ${field}`);
  }
  return [...new Set(fields)];
}

function parseKeywords(value) {
  const keywords = splitCsv(value).map((keyword) => keyword.toLowerCase());
  if (keywords.length === 0) fail("At least one keyword is required.");
  if (keywords.length > MAX_KEYWORDS) fail(`Too many keywords; max ${MAX_KEYWORDS}.`);
  return keywords;
}

function asArrayResult(payload) {
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.result?.items)) return payload.result.items;
  return [];
}

function nextStart(payload) {
  if (payload?.next !== undefined && payload.next !== null) return payload.next;
  if (payload?.result?.next !== undefined && payload.result.next !== null) return payload.result.next;
  return null;
}

function redactError(error) {
  return String(error?.message ?? error)
    .replace(/\/rest\/\d+\/[^/\s]+/g, "/rest/[user]/[token]")
    .replace(/webhook[_-]?token[=:]\S+/gi, "webhook_token=[redacted]");
}

let cachedBaseUrl = null;

function getBaseUrl() {
  if (!cachedBaseUrl) {
    const portalHost = getRequiredEnv("BITRIX24_READONLY_PORTAL_HOST").replace(/^https?:\/\//, "").replace(/\/$/, "");
    const webhookUserId = getRequiredEnv("BITRIX24_READONLY_WEBHOOK_USER_ID");
    const webhookToken = getRequiredEnv("BITRIX24_READONLY_WEBHOOK_TOKEN");
    cachedBaseUrl = `https://${portalHost}/rest/${encodeURIComponent(webhookUserId)}/${encodeURIComponent(webhookToken)}`;
  }

  return cachedBaseUrl;
}

async function callBitrix(method, params = {}) {
  const response = await fetch(`${getBaseUrl()}/${method}.json`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params)
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`${method} returned non-JSON response ${response.status}`);
  }
  if (!response.ok || payload?.error) {
    const description = payload?.error_description || payload?.error || response.statusText;
    throw new Error(`${method} failed: ${description}`);
  }
  return payload;
}

async function listAll(method, baseParams = {}) {
  const rows = [];
  let start = 0;
  for (let page = 0; page < 50; page += 1) {
    const payload = await callBitrix(method, { ...baseParams, start });
    rows.push(...asArrayResult(payload));
    const next = nextStart(payload);
    if (next === null || next === undefined) break;
    start = next;
  }
  return rows;
}

async function listAllByAscendingId(method, buildParams) {
  const rows = [];
  let afterId = "0";
  for (let page = 0; page < 500; page += 1) {
    const payload = await callBitrix(method, buildParams(afterId));
    const pageRows = asArrayResult(payload);
    rows.push(...pageRows);
    if (pageRows.length < 50) break;
    afterId = String(pageRows.at(-1)?.ID ?? afterId);
  }
  return rows;
}

function chunkValues(values, chunkSize = 50) {
  const chunks = [];
  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }
  return chunks;
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
}

function parseWorkloadManagerIds(value) {
  const managerIds = uniqueStrings(splitCsv(value));
  if (managerIds.length === 0) fail("At least one manager ID is required.");
  for (const id of managerIds) {
    if (!/^\d+$/.test(id)) fail(`Invalid manager ID: ${id}`);
  }
  return managerIds;
}

function parseCategoryId(value) {
  const categoryId = String(value ?? "").trim();
  if (!/^\d+$/.test(categoryId)) fail("Invalid --category-id.");
  return categoryId;
}

function parseIsoDateArg(value, name) {
  const date = String(value ?? "").trim();
  if (!date || !Number.isFinite(Date.parse(date))) fail(`Invalid ${name}.`);
  return date;
}

function buildActivityOwnerFilter(ownerIds) {
  if (ownerIds.length === 1) {
    return {
      OWNER_TYPE_ID: Number(DEAL_OWNER_TYPE_ID),
      OWNER_ID: ownerIds[0]
    };
  }

  return {
    BINDINGS: ownerIds.map((ownerId) => ({
      OWNER_TYPE_ID: Number(DEAL_OWNER_TYPE_ID),
      OWNER_ID: ownerId
    }))
  };
}

function numericStringIds(rows, key = "ID") {
  return uniqueStrings(rows.map((row) => row?.[key])).filter((id) => /^\d+$/.test(id));
}

function uniqueRowsByKey(rows, key) {
  return Array.from(
    new Map(
      rows
        .map((row) => [String(row?.[key] ?? ""), row])
        .filter(([value]) => value.length > 0)
    ).values()
  );
}

function uniqueBindings(rows) {
  return Array.from(
    new Map(
      rows.map((row) => {
        const activityId = String(row.activityId ?? row.ACTIVITY_ID ?? "");
        const ownerTypeId = String(row.entityTypeId ?? row.ownerTypeId ?? row.OWNER_TYPE_ID ?? "");
        const ownerId = String(row.entityId ?? row.ownerId ?? row.OWNER_ID ?? "");
        return [`${activityId}:${ownerTypeId}:${ownerId}`, row];
      })
    ).values()
  );
}

function isCompletedActivity(row) {
  const value = row?.COMPLETED;
  return value === true || value === 1 || String(value ?? "").toUpperCase() === "Y";
}

function activityCompletedAt(row) {
  return row?.COMPLETED_DATE ?? row?.LAST_UPDATED ?? null;
}

function countByDateRange(rows, key, rangeFrom, rangeTo) {
  const fromMs = Date.parse(rangeFrom);
  const toMs = Date.parse(rangeTo);
  return rows.filter((row) => {
    const parsed = Date.parse(String(row?.[key] ?? ""));
    return Number.isFinite(parsed) && parsed >= fromMs && parsed <= toMs;
  }).length;
}

function countCompletedActivitiesByRuntimeMapping(rows, rangeFrom, rangeTo) {
  const fromMs = Date.parse(rangeFrom);
  const toMs = Date.parse(rangeTo);
  return rows.filter((row) => {
    if (!isCompletedActivity(row)) return false;
    const parsed = Date.parse(String(activityCompletedAt(row) ?? ""));
    return Number.isFinite(parsed) && parsed >= fromMs && parsed <= toMs;
  }).length;
}

export function summarizeWorkloadBitrixRows(input) {
  const dealRows = uniqueRowsByKey(input.dealRows, "ID");
  const activityRows = uniqueRowsByKey(input.activityRows, "ID");
  const bindingRows = uniqueBindings(input.bindingRows);
  const stageHistoryRows = uniqueRowsByKey(input.stageHistoryRows, "ID");
  const callRowsByActivity = uniqueRowsByKey(input.callRowsByActivity, "ID");
  const supplementalCallRows = uniqueRowsByKey(input.supplementalCallRows, "ID");
  const scopedDealIds = numericStringIds(dealRows);
  const callActivityIds = numericStringIds(
    activityRows.filter((row) => String(row.PROVIDER_ID ?? "") === "VOXIMPLANT_CALL")
  );
  const callIdsByActivity = numericStringIds(callRowsByActivity);
  const supplementalCallIds = numericStringIds(supplementalCallRows);

  return {
    scopedDealIds,
    counts: buildCountShape({
      dealsInRange: scopedDealIds.length,
      activitiesForDealsTotal: activityRows.length,
      activitiesCreatedInRange: countByDateRange(activityRows, "CREATED", input.rangeFrom, input.rangeTo),
      activitiesCompletedInRange: countCompletedActivitiesByRuntimeMapping(activityRows, input.rangeFrom, input.rangeTo),
      callActivitiesForDeals: callActivityIds.length,
      activityBindingsForCallActivities: bindingRows.length,
      stageHistoryForDealsTotal: stageHistoryRows.length,
      stageHistoryForDealsInRange: countByDateRange(stageHistoryRows, "CREATED_TIME", input.rangeFrom, input.rangeTo),
      callsByActivity: callIdsByActivity.length,
      supplementalCallsInRange: supplementalCallIds.length,
      callsUnion: new Set([...callIdsByActivity, ...supplementalCallIds]).size
    })
  };
}

function buildCountShape(input) {
  return {
    dealsInRange: input.dealsInRange ?? 0,
    activitiesForDealsTotal: input.activitiesForDealsTotal ?? 0,
    activitiesCreatedInRange: input.activitiesCreatedInRange ?? 0,
    activitiesCompletedInRange: input.activitiesCompletedInRange ?? 0,
    callActivitiesForDeals: input.callActivitiesForDeals ?? 0,
    activityBindingsForCallActivities: input.activityBindingsForCallActivities ?? 0,
    stageHistoryForDealsTotal: input.stageHistoryForDealsTotal ?? 0,
    stageHistoryForDealsInRange: input.stageHistoryForDealsInRange ?? 0,
    callsByActivity: input.callsByActivity ?? 0,
    supplementalCallsInRange: input.supplementalCallsInRange ?? 0,
    callsUnion: input.callsUnion ?? 0
  };
}

function buildSqlInClause(values) {
  if (values.length === 0) return { clause: "(NULL)", values: [] };
  return {
    clause: `(${values.map(() => "?").join(", ")})`,
    values
  };
}

function queryColumn(database, sql, values = []) {
  return database.prepare(sql).all(...values).map((row) => String(Object.values(row)[0]));
}

function queryCount(database, sql, values = []) {
  const row = database.prepare(sql).get(...values);
  return Number(row?.count ?? 0);
}

export function buildWorkloadLocalCounts(input) {
  const Database = requireFromApi("better-sqlite3");
  const database = new Database(input.localDb, { readonly: true, fileMustExist: true });
  const managerIds = uniqueStrings(input.managerIds);
  const managerIn = buildSqlInClause(managerIds);

  try {
    const scopedDealIds = queryColumn(
      database,
      `SELECT id
       FROM deal_snapshots
       WHERE category_id = ?
         AND assigned_by_id IN ${managerIn.clause}
         AND date_create >= ?
         AND date_create <= ?
       ORDER BY CAST(id AS INTEGER) ASC`,
      [input.categoryId, ...managerIn.values, input.rangeFrom, input.rangeTo]
    );

    const dealIn = buildSqlInClause(scopedDealIds);
    const activityIds = scopedDealIds.length > 0
      ? queryColumn(
          database,
          `SELECT DISTINCT a.id
           FROM activity_snapshots a
           LEFT JOIN activity_binding_snapshots b ON b.activity_id = a.id
           WHERE (a.owner_type_id = ? AND a.owner_id IN ${dealIn.clause})
              OR (b.owner_type_id = ? AND b.owner_id IN ${dealIn.clause})
           ORDER BY CAST(a.id AS INTEGER) ASC`,
          [DEAL_OWNER_TYPE_ID, ...dealIn.values, DEAL_OWNER_TYPE_ID, ...dealIn.values]
        )
      : [];
    const activityIn = buildSqlInClause(activityIds);
    const callActivityIds = scopedDealIds.length > 0
      ? queryColumn(
          database,
          `SELECT DISTINCT a.id
           FROM activity_snapshots a
           LEFT JOIN activity_binding_snapshots b ON b.activity_id = a.id
           WHERE a.provider_id = 'VOXIMPLANT_CALL'
             AND (
               (a.owner_type_id = ? AND a.owner_id IN ${dealIn.clause})
               OR (b.owner_type_id = ? AND b.owner_id IN ${dealIn.clause})
             )
           ORDER BY CAST(a.id AS INTEGER) ASC`,
          [DEAL_OWNER_TYPE_ID, ...dealIn.values, DEAL_OWNER_TYPE_ID, ...dealIn.values]
        )
      : [];
    const callActivityIn = buildSqlInClause(callActivityIds);
    const callIdsByActivity = callActivityIds.length > 0
      ? queryColumn(
          database,
          `SELECT DISTINCT id
           FROM call_snapshots
           WHERE crm_activity_id IN ${callActivityIn.clause}
           ORDER BY CAST(id AS INTEGER) ASC`,
          callActivityIn.values
        )
      : [];
    const supplementalCallIds = queryColumn(
      database,
      `SELECT DISTINCT id
       FROM call_snapshots
       WHERE call_start_date >= ?
         AND call_start_date <= ?
         AND portal_user_id IN ${managerIn.clause}
       ORDER BY CAST(id AS INTEGER) ASC`,
      [input.rangeFrom, input.rangeTo, ...managerIn.values]
    );

    const counts = buildCountShape({
      dealsInRange: scopedDealIds.length,
      activitiesForDealsTotal: activityIds.length,
      activitiesCreatedInRange: activityIds.length > 0
        ? queryCount(
            database,
            `SELECT COUNT(*) AS count
             FROM activity_snapshots
             WHERE id IN ${activityIn.clause}
               AND created_time >= ?
               AND created_time <= ?`,
            [...activityIn.values, input.rangeFrom, input.rangeTo]
          )
        : 0,
      activitiesCompletedInRange: activityIds.length > 0
        ? queryCount(
            database,
            `SELECT COUNT(*) AS count
             FROM activity_snapshots
             WHERE id IN ${activityIn.clause}
               AND completed = 1
               AND completed_time >= ?
               AND completed_time <= ?`,
            [...activityIn.values, input.rangeFrom, input.rangeTo]
          )
        : 0,
      callActivitiesForDeals: callActivityIds.length,
      activityBindingsForCallActivities: callActivityIds.length > 0
        ? queryCount(
            database,
            `SELECT COUNT(*) AS count
             FROM activity_binding_snapshots
             WHERE activity_id IN ${callActivityIn.clause}`,
            callActivityIn.values
          )
        : 0,
      stageHistoryForDealsTotal: scopedDealIds.length > 0
        ? queryCount(
            database,
            `SELECT COUNT(*) AS count
             FROM stage_history_snapshots
             WHERE owner_id IN ${dealIn.clause}`,
            dealIn.values
          )
        : 0,
      stageHistoryForDealsInRange: scopedDealIds.length > 0
        ? queryCount(
            database,
            `SELECT COUNT(*) AS count
             FROM stage_history_snapshots
             WHERE owner_id IN ${dealIn.clause}
               AND created_time >= ?
               AND created_time <= ?`,
            [...dealIn.values, input.rangeFrom, input.rangeTo]
          )
        : 0,
      callsByActivity: callIdsByActivity.length,
      supplementalCallsInRange: supplementalCallIds.length,
      callsUnion: new Set([...callIdsByActivity, ...supplementalCallIds]).size
    });

    return { scopedDealIds, counts };
  } finally {
    database.close();
  }
}

async function buildWorkloadBitrixCounts(input) {
  const managerIds = uniqueStrings(input.managerIds);
  const [dealRows, stageRows] = await Promise.all([
    listAll("crm.deal.list", {
      order: { ID: "ASC" },
      filter: {
        CATEGORY_ID: input.categoryId,
        "@ASSIGNED_BY_ID": managerIds,
        ">=DATE_CREATE": input.rangeFrom,
        "<=DATE_CREATE": input.rangeTo
      },
      select: [
        "ID",
        "CATEGORY_ID",
        "STAGE_ID",
        "STAGE_SEMANTIC_ID",
        "ASSIGNED_BY_ID",
        "DATE_CREATE",
        "DATE_MODIFY"
      ]
    }),
    listAll("crm.status.list", {
      order: { SORT: "ASC" },
      filter: { ENTITY_ID: `DEAL_STAGE_${input.categoryId}` }
    })
  ]);

  const scopedDealIds = numericStringIds(dealRows);
  const activityRows = [];
  for (const chunk of chunkValues(scopedDealIds, WORKLOAD_ACTIVITY_OWNER_CHUNK_SIZE)) {
    activityRows.push(
      ...(await listAllByAscendingId("crm.activity.list", (afterId) => ({
        order: { ID: "ASC" },
        filter: {
          ...buildActivityOwnerFilter(chunk),
          ">ID": afterId
        },
        select: [
          "ID",
          "OWNER_TYPE_ID",
          "OWNER_ID",
          "TYPE_ID",
          "PROVIDER_ID",
          "RESPONSIBLE_ID",
          "CREATED",
          "LAST_UPDATED",
          "COMPLETED",
          "COMPLETED_DATE"
        ],
        start: -1
      })))
    );
  }

  const callActivityIds = numericStringIds(
    activityRows.filter((row) => String(row.PROVIDER_ID ?? "") === "VOXIMPLANT_CALL")
  );
  const bindingRows = [];
  for (const activityId of callActivityIds) {
    const payload = await callBitrix("crm.activity.binding.list", { activityId });
    bindingRows.push(
      ...asArrayResult(payload).map((row) => ({
        activityId,
        ...row
      }))
    );
  }

  const stageHistoryRows = [];
  for (const chunk of chunkValues(scopedDealIds, WORKLOAD_OWNER_CHUNK_SIZE)) {
    stageHistoryRows.push(
      ...(await listAll("crm.stagehistory.list", {
        entityTypeId: 2,
        filter: { "@OWNER_ID": chunk },
        select: [
          "ID",
          "OWNER_ID",
          "CATEGORY_ID",
          "STAGE_ID",
          "STAGE_SEMANTIC_ID",
          "TYPE_ID",
          "CREATED_TIME"
        ],
        order: { ID: "ASC" }
      }))
    );
  }

  const callRowsByActivity = [];
  for (const chunk of chunkValues(callActivityIds, 50)) {
    callRowsByActivity.push(
      ...(await listAll("voximplant.statistic.get", {
        FILTER: { CRM_ACTIVITY_ID: chunk }
      }))
    );
  }
  const supplementalCallRows = await listAll("voximplant.statistic.get", {
    FILTER: {
      ">=CALL_START_DATE": input.rangeFrom,
      "<=CALL_START_DATE": input.rangeTo,
      PORTAL_USER_ID: managerIds
    }
  });
  const summary = summarizeWorkloadBitrixRows({
    dealRows,
    activityRows,
    bindingRows,
    stageHistoryRows,
    callRowsByActivity,
    supplementalCallRows,
    rangeFrom: input.rangeFrom,
    rangeTo: input.rangeTo
  });

  return {
    scopedDealIds: summary.scopedDealIds,
    stageCatalogCount: stageRows.length,
    counts: summary.counts
  };
}

function buildCountDiff(left, right) {
  return Object.fromEntries(
    Object.keys(buildCountShape({})).map((key) => [
      key,
      Number(left?.[key] ?? 0) - Number(right?.[key] ?? 0)
    ])
  );
}

function fieldLabel(field) {
  return (
    field.EDIT_FORM_LABEL ||
    field.LIST_COLUMN_LABEL ||
    field.LIST_FILTER_LABEL ||
    field.MANDATORY_LABEL ||
    field.FIELD_NAME ||
    ""
  );
}

function normalizeListItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      id: String(item.ID ?? item.VALUE_ID ?? item.id ?? ""),
      value: String(item.VALUE ?? item.value ?? item.NAME ?? "")
    }))
    .filter((item) => item.id || item.value);
}

async function getUserFieldsByNames(names) {
  const userFields = await listAll("crm.deal.userfield.list", {
    order: { FIELD_NAME: "ASC" },
    filter: {},
    LANG: "ru"
  });
  return userFields.filter((field) => names.includes(String(field.FIELD_NAME ?? "")));
}

function sanitizeUserField(field) {
  const list = normalizeListItems(field.LIST);
  return {
    fieldName: String(field.FIELD_NAME ?? ""),
    type: String(field.USER_TYPE_ID ?? field.XML_ID ?? ""),
    label: fieldLabel(field),
    enumCount: list.length,
    enumItems: list.map((item) => ({
      id: item.id,
      value: item.value
    }))
  };
}

async function runUserfields(args) {
  const keywords = parseKeywords(args.keywords ?? "");
  const fields = await listAll("crm.deal.userfield.list", {
    order: { FIELD_NAME: "ASC" },
    filter: {},
    LANG: "ru"
  });
  const matches = fields
    .map(sanitizeUserField)
    .filter((field) => {
      const haystack = `${field.fieldName} ${field.label} ${field.enumItems.map((item) => item.value).join(" ")}`.toLowerCase();
      return keywords.some((keyword) => haystack.includes(keyword));
    });
  console.log(JSON.stringify({
    ok: true,
    mode: "userfields",
    methods: ["crm.deal.userfield.list"],
    keywords,
    matchCount: matches.length,
    matches
  }, null, 2));
}

async function runDealProbe(args) {
  const dealIds = parseDealIds(args["deal-ids"] ?? "");
  const customFields = parseCustomFields(args.fields ?? "");
  const select = ["ID", "CATEGORY_ID", "STAGE_ID", ...customFields];
  for (const field of select) {
    if (!SAFE_DEAL_FIELDS.has(field) && !ALLOWED_CUSTOM_FIELD_RE.test(field)) {
      fail(`Forbidden select field: ${field}`);
    }
  }

  const [deals, userFields] = await Promise.all([
    listAll("crm.deal.list", {
      order: { ID: "ASC" },
      filter: { "@ID": dealIds },
      select
    }),
    getUserFieldsByNames(customFields)
  ]);

  const enumMaps = Object.fromEntries(
    userFields.map((field) => [
      String(field.FIELD_NAME ?? ""),
      Object.fromEntries(normalizeListItems(field.LIST).map((item) => [item.id, item.value]))
    ])
  );

  const sanitizedDeals = deals.map((deal) => {
    const candidateFields = Object.fromEntries(
      customFields.map((field) => {
        const raw = deal[field];
        const value = Array.isArray(raw) ? raw.map((entry) => String(entry)) : raw === null || raw === undefined || raw === "" ? [] : [String(raw)];
        return [field, {
          hasValue: value.length > 0,
          enumIds: value,
          labels: value.map((entry) => enumMaps[field]?.[entry] ?? null)
        }];
      })
    );
    return {
      dealId: String(deal.ID ?? ""),
      categoryId: String(deal.CATEGORY_ID ?? ""),
      stageId: String(deal.STAGE_ID ?? ""),
      candidateFields
    };
  });

  console.log(JSON.stringify({
    ok: true,
    mode: "deal-probe",
    methods: ["crm.deal.list", "crm.deal.userfield.list"],
    requestedDealIds: dealIds,
    returnedDealCount: sanitizedDeals.length,
    fields: customFields,
    deals: sanitizedDeals
  }, null, 2));
}

async function runStatus(args) {
  const entityId = args["entity-id"]?.trim();
  if (!entityId || !/^[A-Z0-9_:]+$/.test(entityId)) fail("Invalid --entity-id.");
  const rows = await listAll("crm.status.list", {
    order: { SORT: "ASC" },
    filter: { ENTITY_ID: entityId }
  });
  console.log(JSON.stringify({
    ok: true,
    mode: "status",
    methods: ["crm.status.list"],
    entityId,
    count: rows.length,
    statuses: rows.map((row) => ({
      statusId: String(row.STATUS_ID ?? ""),
      name: String(row.NAME ?? ""),
      sort: row.SORT ?? null
    }))
  }, null, 2));
}

async function runWorkloadCounts(args) {
  const categoryId = parseCategoryId(args["category-id"] ?? "");
  const managerIds = parseWorkloadManagerIds(
    args["manager-ids"] ?? process.env.BITRIX24_LEADGEN_MANAGER_IDS ?? ""
  );
  const rangeFrom = parseIsoDateArg(args["range-from"], "--range-from");
  const rangeTo = parseIsoDateArg(args["range-to"], "--range-to");
  const localDb = args["local-db"]?.trim() || null;
  const scope = {
    categoryId,
    managerIds,
    rangeFrom,
    rangeTo
  };

  const bitrix = await buildWorkloadBitrixCounts(scope);
  const local = localDb
    ? buildWorkloadLocalCounts({ ...scope, localDb })
    : null;

  console.log(JSON.stringify({
    ok: true,
    mode: "workload-counts",
    methods: [
      "crm.deal.list",
      "crm.status.list",
      "crm.activity.list",
      "crm.activity.binding.list",
      "crm.stagehistory.list",
      "voximplant.statistic.get"
    ],
    filters: {
      module: "leadgen",
      categoryId,
      managerCount: managerIds.length,
      rangeFrom,
      rangeTo
    },
    requestShape: {
      select: "narrow non-PII fields only",
      pagination: "list methods page through start or ascending ID where used by runtime",
      activityOwnerChunks: WORKLOAD_ACTIVITY_OWNER_CHUNK_SIZE,
      ownerChunks: WORKLOAD_OWNER_CHUNK_SIZE,
      productionMutation: false
    },
    bitrix: {
      scopedDealCount: bitrix.scopedDealIds.length,
      stageCatalogCount: bitrix.stageCatalogCount,
      counts: bitrix.counts
    },
    local: local
      ? {
          database: localDb,
          scopedDealCount: local.scopedDealIds.length,
          counts: local.counts
        }
      : null,
    difference: local ? buildCountDiff(local.counts, bitrix.counts) : null,
    privacy: {
      printedDealIds: false,
      printedNames: false,
      printedPhones: false,
      printedEmails: false,
      printedRawPayloads: false,
      printedSecrets: false
    }
  }, null, 2));
}

async function main() {
  const { mode, args } = parseArgs(process.argv.slice(2));
  if (mode === "userfields") return runUserfields(args);
  if (mode === "deal-probe") return runDealProbe(args);
  if (mode === "status") return runStatus(args);
  if (mode === "workload-counts") return runWorkloadCounts(args);
  fail("Usage: bitrix-readonly-proof.mjs userfields --keywords <csv> | deal-probe --deal-ids <csv> --fields <csv> | status --entity-id <id> | workload-counts --category-id <id> --manager-ids <csv> --range-from <iso> --range-to <iso> [--local-db <path>]");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => fail(redactError(error)));
}
