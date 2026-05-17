#!/usr/bin/env node

const ALLOWED_CUSTOM_FIELD_RE = /^UF_CRM_\d+$/;
const SAFE_DEAL_FIELDS = new Set(["ID", "CATEGORY_ID", "STAGE_ID", "STAGE_SEMANTIC_ID"]);
const MAX_DEAL_IDS = 50;
const MAX_CUSTOM_FIELDS = 20;
const MAX_KEYWORDS = 20;

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

const portalHost = getRequiredEnv("BITRIX24_READONLY_PORTAL_HOST").replace(/^https?:\/\//, "").replace(/\/$/, "");
const webhookUserId = getRequiredEnv("BITRIX24_READONLY_WEBHOOK_USER_ID");
const webhookToken = getRequiredEnv("BITRIX24_READONLY_WEBHOOK_TOKEN");
const baseUrl = `https://${portalHost}/rest/${encodeURIComponent(webhookUserId)}/${encodeURIComponent(webhookToken)}`;

async function callBitrix(method, params = {}) {
  const response = await fetch(`${baseUrl}/${method}.json`, {
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

async function main() {
  const { mode, args } = parseArgs(process.argv.slice(2));
  if (mode === "userfields") return runUserfields(args);
  if (mode === "deal-probe") return runDealProbe(args);
  if (mode === "status") return runStatus(args);
  fail("Usage: bitrix-readonly-proof.mjs userfields --keywords <csv> | deal-probe --deal-ids <csv> --fields <csv> | status --entity-id <id>");
}

main().catch((error) => fail(redactError(error)));
