import type {
  ConversionEventVisitSnapshot,
  StageCatalogEntry
} from "@bitrix24-reporting/contracts";

import {
  buildConversionEventItemListParams,
  buildDealBackfillParams,
  buildDealListParams
} from "./selectors.js";
import {
  assertAllowedBitrixMethod,
  assertSafeSelectFields,
  redactWebhookUrl
} from "./security.js";
import {
  parseConversionEventDate,
  resolveConversionEventName,
  resolveConversionEventStatus
} from "../domain/conversion-events.js";

interface BitrixClientConfig {
  dealCategoryIds: string[];
  qualityFieldName?: string;
  portalHost?: string;
  userId?: string;
  webhookToken?: string;
  timeoutMs: number;
  requestIntervalMs: number;
}

interface BitrixResponse<T> {
  result?: T;
  next?: number;
  total?: number;
  error?: string;
  error_description?: string;
}

interface BitrixResultItems<T> {
  items?: T[];
}

interface DealListRow {
  ID: string;
  CONTACT_ID?: string | null;
  LEAD_ID: string | null;
  DATE_CREATE: string;
  DATE_MODIFY: string;
  DATE_CLOSED?: string | null;
  CATEGORY_ID: string | null;
  STAGE_ID: string;
  STAGE_SEMANTIC_ID: string | null;
  OPPORTUNITY: number | null;
  ASSIGNED_BY_ID: string | null;
  SOURCE_ID: string | null;
  UTM_SOURCE: string | null;
  UTM_MEDIUM: string | null;
  UTM_CAMPAIGN: string | null;
  UTM_CONTENT: string | null;
  UTM_TERM: string | null;
  [key: string]: unknown;
}

export interface DealAuditRow {
  ID: string;
  ASSIGNED_BY_ID: string | null;
  DATE_CREATE: string;
  CATEGORY_ID: string | null;
}

interface StatusRow {
  ENTITY_ID: string;
  STATUS_ID: string;
  NAME: string;
  SORT?: string | null;
  CATEGORY_ID?: string | null;
  EXTRA?: {
    SEMANTICS?: string | null;
    COLOR?: string | null;
  };
}

interface DealFieldMetadata {
  title?: string;
  settings?: Record<string, string | null>;
  items?: Array<{
    ID?: string | number;
    VALUE?: string;
    id?: string | number;
    value?: string;
  }>;
}

export interface StageHistoryRow {
  ID: string | number;
  OWNER_ID: string | number;
  CATEGORY_ID: string | number | null;
  STAGE_ID: string;
  STAGE_SEMANTIC_ID: string | null;
  TYPE_ID: number | null;
  CREATED_TIME: string;
}

export interface ActivityRow {
  ID: string;
  OWNER_TYPE_ID: string;
  OWNER_ID: string;
  TYPE_ID: string | null;
  PROVIDER_ID: string | null;
  RESPONSIBLE_ID: string | null;
  CREATED: string;
  DEADLINE: string | null;
  LAST_UPDATED: string;
  COMPLETED: string;
  COMPLETED_DATE?: string | null;
}

interface ActivityBindingListRow {
  entityTypeId: string | number;
  entityId: string | number;
}

export interface ActivityBindingRow {
  activityId: string;
  ownerTypeId: string;
  ownerId: string;
}

export interface CallRow {
  ID: string;
  CRM_ACTIVITY_ID: string | null;
  PORTAL_USER_ID: string | null;
  CALL_TYPE: string | null;
  CALL_START_DATE: string;
  CALL_DURATION: string | number | null;
  CRM_ENTITY_TYPE: string | null;
  CRM_ENTITY_ID: string | null;
  CALL_FAILED_CODE: string | null;
}

export interface UserRow {
  ID: string;
  NAME: string | null;
  LAST_NAME: string | null;
}

export interface ContactRow {
  ID: string;
  [key: string]: unknown;
}

interface SmartProcessTypeRow {
  entityTypeId: string | number;
  title?: string | null;
}

interface SmartProcessTypeListResult {
  types?: SmartProcessTypeRow[];
}

interface SmartProcessFieldMetadata {
  title?: string | null;
  type?: string | null;
}

interface SmartProcessFieldsResult {
  fields?: Record<string, SmartProcessFieldMetadata>;
}

interface SmartProcessCategoryResult {
  categories?: Array<{
    id: string | number;
    stages?: Array<{
      id?: string | number;
      statusId?: string | number;
      name?: string | null;
      title?: string | null;
    }>;
  }>;
}

interface ConversionEventItemRow {
  id: string | number;
  title?: string | null;
  stageId?: string | number | null;
  categoryId?: string | number | null;
  parentId2?: unknown;
  contactId?: unknown;
  assignedById?: unknown;
  sourceId?: string | number | null;
  createdTime?: string | null;
  updatedTime?: string | null;
  [key: string]: unknown;
}

function buildDealStageEntityId(categoryId: string) {
  return categoryId === "0" ? "DEAL_STAGE" : `DEAL_STAGE_${categoryId}`;
}

function normalizeDealStageStatusId(categoryId: string, statusId: string) {
  const normalizedCategoryId = categoryId.trim() || "0";
  const normalizedStatusId = statusId.trim();

  if (normalizedCategoryId === "0" || /^C\d+:/i.test(normalizedStatusId)) {
    return normalizedStatusId;
  }

  return `C${normalizedCategoryId}:${normalizedStatusId}`;
}

function delay(milliseconds: number) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, milliseconds);
  });
}

function isRateLimitMessage(message: string) {
  return /too many requests|query_limit_exceeded/i.test(message);
}

function getErrorCauseCode(error: unknown) {
  if (!(error instanceof Error)) {
    return "";
  }

  const cause = (error as Error & { cause?: unknown }).cause;
  return cause && typeof cause === "object" && "code" in cause
    ? String((cause as { code?: unknown }).code)
    : "";
}

function isTransientNetworkError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const causeCode = getErrorCauseCode(error);

  return (
    error.name === "AbortError" ||
    error.message === "fetch failed" ||
    causeCode === "UND_ERR_CONNECT_TIMEOUT" ||
    causeCode === "UND_ERR_HEADERS_TIMEOUT" ||
    causeCode === "ECONNRESET"
  );
}

function describeBitrixError(error: unknown) {
  if (!(error instanceof Error)) {
    return "unknown";
  }

  const causeCode = getErrorCauseCode(error);
  return causeCode ? `${error.name}:${causeCode}` : error.name;
}

function logBitrixRequest(
  level: "info" | "warn" | "error",
  event: string,
  details: Record<string, unknown>
) {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  console[level](`bitrix.${event}`, JSON.stringify(details));
}

function toNumber(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toStringArray(values: string[]) {
  return values.map((value) => String(value));
}

function normalizeOptionalString(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function extractLinkedId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }

    const directMatch = /^\d+$/.exec(trimmed);
    if (directMatch) {
      return directMatch[0];
    }

    const crmMatch = /(?:^|[_:])(\d+)$/u.exec(trimmed);
    return crmMatch?.[1] ?? trimmed;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const linkedId = extractLinkedId(item);
      if (linkedId) {
        return linkedId;
      }
    }
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (
      extractLinkedId(record.ID) ??
      extractLinkedId(record.id) ??
      extractLinkedId(record.VALUE) ??
      extractLinkedId(record.value)
    );
  }

  return null;
}

function normalizeFieldTitle(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("ru").replace(/ё/g, "е");
}

function findFieldByExactTitle<T extends { title?: string | null }>(
  fields: Record<string, T>,
  title: string
) {
  const normalizedTitle = normalizeFieldTitle(title);
  return Object.entries(fields).find(
    ([, field]) => normalizeFieldTitle(field.title) === normalizedTitle
  )?.[0];
}

function findConversionEventNameField(
  fields: Record<string, SmartProcessFieldMetadata>
) {
  return (
    findFieldByExactTitle(fields, "Мероприятие") ??
    Object.entries(fields).find(([, field]) => {
      const title = normalizeFieldTitle(field.title);
      return title.includes("мероприят") && !title.includes("дата");
    })?.[0] ??
    null
  );
}

function findConversionEventDateField(
  fields: Record<string, SmartProcessFieldMetadata>
) {
  return (
    findFieldByExactTitle(fields, "Дата мероприятия") ??
    Object.entries(fields).find(([, field]) => {
      const title = normalizeFieldTitle(field.title);
      return (
        title.includes("дата") &&
        title.includes("мероприят") &&
        (field.type === "date" || field.type === "datetime")
      );
    })?.[0] ??
    null
  );
}

function normalizeDateValue(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function buildActivityOwnerFilter(ownerIds: string[]) {
  if (ownerIds.length === 1) {
    return {
      OWNER_TYPE_ID: 2,
      OWNER_ID: ownerIds[0]
    };
  }

  return {
    BINDINGS: ownerIds.map((ownerId) => ({
      OWNER_TYPE_ID: 2,
      OWNER_ID: ownerId
    }))
  };
}

function chunkValues<T>(values: T[], chunkSize = 50) {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }

  return chunks;
}

const ACTIVITY_OWNER_CHUNK_SIZE = 10;

export class BitrixClient {
  private readonly baseUrl: string | null;
  private lastRequestAt = 0;
  private requestQueue: Promise<void> = Promise.resolve();
  private dealFieldsPromise: Promise<Record<string, DealFieldMetadata>> | null =
    null;
  private readonly dynamicItemTitleMaps = new Map<
    number,
    Promise<Record<string, string>>
  >();

  constructor(private readonly config: BitrixClientConfig) {
    this.baseUrl =
      config.portalHost && config.userId && config.webhookToken
        ? `https://${config.portalHost}/rest/${config.userId}/${config.webhookToken}`
        : null;
  }

  private ensureConfigured() {
    if (!this.baseUrl) {
      throw new Error("Bitrix24 webhook credentials are not configured.");
    }
  }

  private async call<T>(
    method: string,
    params: Record<string, unknown>,
    options?: {
      allowedCustomFields?: string[];
    }
  ) {
    this.ensureConfigured();
    assertAllowedBitrixMethod(method);

    if (Array.isArray(params.select)) {
      assertSafeSelectFields(
        params.select.filter((value): value is string => typeof value === "string"),
        options?.allowedCustomFields ?? []
      );
    }

    const url = `${this.baseUrl}/${method}`;

    return this.withRequestSlot(async () => {
      const maxAttempts = 4;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

        try {
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(params),
            signal: controller.signal
          });

          let payload: BitrixResponse<T>;
          try {
            payload = (await response.json()) as BitrixResponse<T>;
          } catch {
            if (attempt < maxAttempts - 1) {
              const delayMs =
                Math.max(this.config.requestIntervalMs, 1_000) * (attempt + 1);
              logBitrixRequest("warn", "request.retry", {
                method,
                attempt: attempt + 1,
                maxAttempts,
                status: response.status,
                reason: "non_json_response",
                delayMs
              });
              await delay(delayMs);
              continue;
            }

            const error = new Error(
              `Bitrix24 ${method} failed at ${redactWebhookUrl(url)}: non-JSON response (${response.status} ${response.statusText})`
            );
            logBitrixRequest("error", "request.failed", {
              method,
              attempt: attempt + 1,
              maxAttempts,
              status: response.status,
              reason: "non_json_response"
            });
            throw error;
          }

          const errorMessage =
            payload.error_description ?? payload.error ?? response.statusText;
          if (!response.ok || payload.error) {
            if (
              isRateLimitMessage(errorMessage) &&
              attempt < maxAttempts - 1
            ) {
              const delayMs =
                Math.max(this.config.requestIntervalMs, 1_000) * (attempt + 1);
              logBitrixRequest("warn", "request.retry", {
                method,
                attempt: attempt + 1,
                maxAttempts,
                status: response.status,
                reason: "rate_limit",
                delayMs
              });
              await delay(delayMs);
              continue;
            }

            const error = new Error(
              `Bitrix24 ${method} failed at ${redactWebhookUrl(url)}: ${errorMessage}`
            );
            logBitrixRequest("error", "request.failed", {
              method,
              attempt: attempt + 1,
              maxAttempts,
              status: response.status,
              reason: payload.error ?? response.statusText
            });
            throw error;
          }

          return payload;
        } catch (error) {
          if (isTransientNetworkError(error) && attempt < maxAttempts - 1) {
            const delayMs =
              Math.max(this.config.requestIntervalMs, 1_000) * (attempt + 1);
            logBitrixRequest("warn", "request.retry", {
              method,
              attempt: attempt + 1,
              maxAttempts,
              timeoutMs: this.config.timeoutMs,
              reason: describeBitrixError(error),
              delayMs
            });
            await delay(delayMs);
            continue;
          }

          if (
            !(error instanceof Error && error.message.startsWith("Bitrix24 "))
          ) {
            logBitrixRequest("error", "request.failed", {
              method,
              attempt: attempt + 1,
              maxAttempts,
              timeoutMs: this.config.timeoutMs,
              reason: describeBitrixError(error)
            });
          }
          throw error;
        } finally {
          clearTimeout(timeout);
        }
      }

      throw new Error(`Bitrix24 ${method} failed at ${redactWebhookUrl(url)}`);
    });
  }

  private async withRequestSlot<T>(task: () => Promise<T>) {
    const previousRequest = this.requestQueue;
    let releaseRequest!: () => void;
    this.requestQueue = new Promise((resolve) => {
      releaseRequest = resolve;
    });

    await previousRequest;

    const waitMilliseconds = Math.max(
      0,
      this.lastRequestAt + this.config.requestIntervalMs - Date.now()
    );
    if (waitMilliseconds > 0) {
      await delay(waitMilliseconds);
    }

    try {
      return await task();
    } finally {
      this.lastRequestAt = Date.now();
      releaseRequest();
    }
  }

  private extractItems<T>(response: BitrixResponse<T[] | BitrixResultItems<T>>) {
    if (Array.isArray(response.result)) {
      return response.result;
    }

    if (
      response.result &&
      typeof response.result === "object" &&
      Array.isArray((response.result as BitrixResultItems<T>).items)
    ) {
      return (response.result as BitrixResultItems<T>).items ?? [];
    }

    return [] as T[];
  }

  private async collectPagedList<T>(
    method: string,
    buildParams: (start: number) => Record<string, unknown>,
    options?: {
      allowedCustomFields?: string[];
    }
  ) {
    const rows: T[] = [];
    let start = 0;

    while (true) {
      const response = await this.call<T[] | BitrixResultItems<T>>(
        method,
        buildParams(start),
        options
      );
      const page = this.extractItems(response);

      if (page.length === 0) {
        break;
      }

      rows.push(...page);

      if (typeof response.next === "number") {
        start = response.next;
      } else if (page.length === 50) {
        start += 50;
      } else {
        break;
      }

      await delay(this.config.requestIntervalMs);
    }

    return rows;
  }

  private async collectByAscendingId<T extends { ID: string }>(
    method: string,
    buildParams: (afterId: string) => Record<string, unknown>,
    options?: {
      allowedCustomFields?: string[];
    }
  ) {
    const rows: T[] = [];
    let afterId = "0";

    while (true) {
      const response = await this.call<T[] | BitrixResultItems<T>>(
        method,
        buildParams(afterId),
        options
      );
      const page = this.extractItems(response);

      if (page.length === 0) {
        break;
      }

      rows.push(...page);

      if (page.length < 50) {
        break;
      }

      afterId = page.at(-1)?.ID ?? afterId;
      await delay(this.config.requestIntervalMs);
    }

    return rows;
  }

  private async collectChunked<T>(
    values: string[],
    loader: (chunk: string[]) => Promise<T[]>,
    chunkSize = 50
  ) {
    const rows: T[] = [];

    for (const chunk of chunkValues(values, chunkSize)) {
      const page = await loader(chunk);
      rows.push(...page);

      if (chunk.length === chunkSize) {
        await delay(this.config.requestIntervalMs);
      }
    }

    return rows;
  }

  async fetchConversionEventDealFieldName() {
    const fields = await this.fetchDealFieldsMetadata();
    return findFieldByExactTitle(fields, "Мероприятие ОФ") ?? null;
  }

  private async discoverConversionEventMetadata() {
    const typeResponse = await this.call<SmartProcessTypeListResult>(
      "crm.type.list",
      {}
    );
    const type = typeResponse.result?.types?.find(
      (candidate) =>
        normalizeFieldTitle(candidate.title) ===
        normalizeFieldTitle("Посещения мероприятий")
    );
    const entityTypeId = Number(type?.entityTypeId);
    if (!Number.isFinite(entityTypeId)) {
      return null;
    }

    const [fieldResponse, categoryResponse, dealFieldName] = await Promise.all([
      this.call<SmartProcessFieldsResult>("crm.item.fields", {
        entityTypeId
      }),
      this.call<SmartProcessCategoryResult>("crm.category.list", {
        entityTypeId
      }),
      this.fetchConversionEventDealFieldName()
    ]);
    const fields = fieldResponse.result?.fields ?? {};
    const stageNames = new Map<string, string>();

    for (const category of categoryResponse.result?.categories ?? []) {
      for (const stage of category.stages ?? []) {
        const stageId = normalizeOptionalString(stage.id ?? stage.statusId);
        if (stageId) {
          stageNames.set(stageId, stage.name ?? stage.title ?? stageId);
        }
      }
    }

    return {
      entityTypeId,
      eventNameFieldName: findConversionEventNameField(fields),
      eventDateFieldName: findConversionEventDateField(fields),
      dealConversionEventFieldName: dealFieldName,
      stageNames
    };
  }

  async listConversionEventVisits(input: {
    modifiedAfter: string | null;
    reportYear: number;
  }): Promise<ConversionEventVisitSnapshot[]> {
    const metadata = await this.discoverConversionEventMetadata();
    if (!metadata) {
      return [];
    }

    const allowedCustomFields = [
      metadata.eventNameFieldName,
      metadata.eventDateFieldName
    ].filter((value): value is string => Boolean(value));
    const rows = await this.collectPagedList<ConversionEventItemRow>(
      "crm.item.list",
      (start) =>
        buildConversionEventItemListParams({
          entityTypeId: metadata.entityTypeId,
          modifiedAfter: input.modifiedAfter,
          start,
          eventNameFieldName: metadata.eventNameFieldName,
          eventDateFieldName: metadata.eventDateFieldName
        }),
      {
        allowedCustomFields
      }
    );

    return rows.map((row) => {
      const stageId = normalizeOptionalString(row.stageId) ?? "";
      const stageName = metadata.stageNames.get(stageId) ?? stageId;
      const eventName = resolveConversionEventName(
        metadata.eventNameFieldName
          ? normalizeOptionalString(row[metadata.eventNameFieldName])
          : null,
        row.title ?? null
      );
      const explicitDate = metadata.eventDateFieldName
        ? normalizeDateValue(normalizeOptionalString(row[metadata.eventDateFieldName]))
        : null;
      const eventDate =
        explicitDate ?? parseConversionEventDate(eventName, input.reportYear) ?? "";

      return {
        id: String(row.id),
        eventName,
        eventDate,
        status: resolveConversionEventStatus(stageName),
        stageId,
        stageName,
        dealId: extractLinkedId(row.parentId2),
        contactId: extractLinkedId(row.contactId),
        managerId: normalizeOptionalString(row.assignedById),
        sourceId: normalizeOptionalString(row.sourceId),
        createdTime: row.createdTime ?? "",
        updatedTime: row.updatedTime ?? row.createdTime ?? ""
      };
    });
  }

  async listDeals(cursor: {
    modifiedAfter: string | null;
    categoryIds?: string[];
    assignedByIds?: string[];
    qualityFieldName?: string;
    customFieldNames?: string[];
  }) {
    const categoryIds = cursor.categoryIds ?? this.config.dealCategoryIds;
    const qualityFieldName =
      cursor.qualityFieldName ?? this.config.qualityFieldName;
    const customFieldNames = Array.from(
      new Set([
        ...(qualityFieldName ? [qualityFieldName] : []),
        ...(cursor.customFieldNames ?? [])
      ])
    );
    const allowedCustomFields = customFieldNames;

    if (cursor.modifiedAfter === null) {
      return this.collectByAscendingId<DealListRow>(
        "crm.deal.list",
        (afterId) =>
          buildDealBackfillParams({
            afterId,
            categoryIds,
            ...(cursor.assignedByIds
              ? { assignedByIds: cursor.assignedByIds }
              : {}),
            customFieldNames
          }),
        {
          allowedCustomFields
        }
      );
    }

    const modifiedAfter = cursor.modifiedAfter;

    return this.collectPagedList<DealListRow>(
      "crm.deal.list",
      (start) =>
        buildDealListParams({
          categoryIds,
          ...(cursor.assignedByIds
            ? { assignedByIds: cursor.assignedByIds }
            : {}),
          modifiedAfter,
          start,
          customFieldNames
        }),
      {
        allowedCustomFields
      }
    );
  }

  async listDealsForAudit(input: { filter: Record<string, unknown> }) {
    return this.collectPagedList<DealAuditRow>("crm.deal.list", (start) => ({
      select: ["ID", "ASSIGNED_BY_ID", "DATE_CREATE", "CATEGORY_ID"],
      filter: input.filter,
      order: {
        ID: "ASC" as const
      },
      start
    }));
  }

  async fetchDealStages(categoryIds: string[]): Promise<StageCatalogEntry[]> {
    const rows = await Promise.all(
      Array.from(new Set(categoryIds)).map(async (categoryId) => {
        const response = await this.call<StatusRow[]>("crm.status.list", {
          filter: {
            ENTITY_ID: buildDealStageEntityId(categoryId)
          }
        });

        return this.extractItems(response).map((row) => ({
          entityType: "deal" as const,
          categoryId,
          statusId: normalizeDealStageStatusId(categoryId, row.STATUS_ID),
          name: row.NAME,
          semanticId: row.EXTRA?.SEMANTICS ?? null,
          sortOrder: toNumber(row.SORT)
        }));
      })
    );

    return rows.flat();
  }

  async fetchSourceCatalog(): Promise<StageCatalogEntry[]> {
    const response = await this.call<StatusRow[]>("crm.status.list", {
      filter: {
        ENTITY_ID: "SOURCE"
      }
    });

    return this.extractItems(response).map((row) => ({
      entityType: "source" as const,
      categoryId: row.CATEGORY_ID ? String(row.CATEGORY_ID) : null,
      statusId: row.STATUS_ID,
      name: row.NAME,
      semanticId: row.EXTRA?.SEMANTICS ?? null,
      sortOrder: toNumber(row.SORT)
    }));
  }

  private fetchDealFieldsMetadata() {
    if (!this.dealFieldsPromise) {
      this.dealFieldsPromise = this.call<Record<string, DealFieldMetadata>>(
        "crm.deal.fields",
        {}
      )
        .then((response) => response.result ?? {})
        .catch((error: unknown) => {
          this.dealFieldsPromise = null;
          throw error;
        });
    }

    return this.dealFieldsPromise;
  }

  private fetchDynamicItemTitleMap(entityTypeId: number) {
    const cached = this.dynamicItemTitleMaps.get(entityTypeId);
    if (cached) {
      return cached;
    }

    const request = this.collectPagedList<{
      id: number | string;
      title: string;
    }>("crm.item.list", (start) => ({
      entityTypeId,
      select: ["id", "title"],
      order: {
        id: "ASC" as const
      },
      start
    }))
      .then(
        (items) =>
          Object.fromEntries(
            items.map((item) => [String(item.id), item.title])
          ) as Record<string, string>
      )
      .catch((error: unknown) => {
        this.dynamicItemTitleMaps.delete(entityTypeId);
        throw error;
      });

    this.dynamicItemTitleMaps.set(entityTypeId, request);
    return request;
  }

  async fetchDealFieldValueMap(fieldName: string) {
    if (!fieldName) {
      return {};
    }

    const fields = await this.fetchDealFieldsMetadata();
    const field = fields[fieldName];
    if (field?.items && field.items.length > 0) {
      return Object.fromEntries(
        field.items.flatMap((item) => {
          const id = item.ID ?? item.id;
          const value = item.VALUE ?? item.value;

          return id !== undefined && value ? [[String(id), value]] : [];
        })
      ) as Record<string, string>;
    }

    const dynamicEntityKey = Object.entries(field?.settings ?? {}).find(
      ([key, value]) => key.startsWith("DYNAMIC_") && value === "Y"
    )?.[0];

    if (!dynamicEntityKey) {
      return {};
    }

    const entityTypeId = Number(dynamicEntityKey.replace("DYNAMIC_", ""));
    if (!Number.isFinite(entityTypeId)) {
      return {};
    }

    return this.fetchDynamicItemTitleMap(entityTypeId);
  }

  async fetchDealQualityMap(fieldName: string) {
    return this.fetchDealFieldValueMap(fieldName);
  }

  async fetchContactFieldValueMap(fieldName: string) {
    if (!fieldName) {
      return {};
    }

    const response = await this.call<Record<string, DealFieldMetadata>>(
      "crm.contact.fields",
      {}
    );
    const field = response.result?.[fieldName];
    if (!field?.items || field.items.length === 0) {
      return {};
    }

    return Object.fromEntries(
      field.items.flatMap((item) => {
        const id = item.ID ?? item.id;
        const value = item.VALUE ?? item.value;

        return id !== undefined && value ? [[String(id), value]] : [];
      })
    ) as Record<string, string>;
  }

  async listStageHistory(input: { ownerIds?: string[]; categoryIds?: string[] }) {
    if (input.categoryIds && input.categoryIds.length > 0) {
      return (
        await Promise.all(
          input.categoryIds.map((categoryId) =>
            this.collectPagedList<StageHistoryRow>(
              "crm.stagehistory.list",
              (start) => ({
                entityTypeId: 2,
                filter: {
                  CATEGORY_ID: categoryId
                },
                select: [
                  "ID",
                  "OWNER_ID",
                  "CATEGORY_ID",
                  "STAGE_ID",
                  "STAGE_SEMANTIC_ID",
                  "TYPE_ID",
                  "CREATED_TIME"
                ],
                order: {
                  ID: "ASC" as const
                },
                start
              })
            )
          )
        )
      ).flat();
    }

    const ownerIds = input.ownerIds ?? [];
    if (ownerIds.length === 0) {
      return [];
    }

    return this.collectChunked(
      ownerIds,
      (chunk) =>
      this.collectPagedList<StageHistoryRow>("crm.stagehistory.list", (start) => ({
        entityTypeId: 2,
        filter: {
          "@OWNER_ID": toStringArray(chunk)
        },
        select: [
          "ID",
          "OWNER_ID",
          "CATEGORY_ID",
          "STAGE_ID",
          "STAGE_SEMANTIC_ID",
          "TYPE_ID",
          "CREATED_TIME"
        ],
        order: {
          ID: "ASC" as const
        },
        start
      })),
      20
    );
  }

  async listActivities(input: {
    ownerIds: string[];
    modifiedAfter: string | null;
    providerId?: string;
  }) {
    if (input.ownerIds.length === 0) {
      return [];
    }

    return this.collectChunked(
      input.ownerIds,
      (chunk) =>
        this.collectByAscendingId<ActivityRow>("crm.activity.list", (afterId) => ({
          order: {
            ID: "ASC" as const
          },
          filter: {
            ...buildActivityOwnerFilter(chunk),
            ">ID": afterId,
            ...(input.providerId
              ? {
                  PROVIDER_ID: input.providerId
                }
              : {}),
            ...(input.modifiedAfter
              ? {
                  ">=LAST_UPDATED": input.modifiedAfter
                }
              : {})
          },
          select: [
            "ID",
            "OWNER_TYPE_ID",
            "OWNER_ID",
            "TYPE_ID",
            "PROVIDER_ID",
            "RESPONSIBLE_ID",
            "CREATED",
            "DEADLINE",
            "LAST_UPDATED",
            "COMPLETED",
            "COMPLETED_DATE"
          ],
          start: -1
        })),
      ACTIVITY_OWNER_CHUNK_SIZE
    );
  }

  async listContacts(input: { ids: string[]; customFieldNames?: string[] }) {
    if (input.ids.length === 0) {
      return [];
    }

    const customFieldNames = Array.from(new Set(input.customFieldNames ?? []));

    return this.collectChunked(
      input.ids,
      async (chunk) => {
        const response = await this.call<ContactRow[]>(
          "crm.contact.list",
          {
            order: {
              ID: "ASC" as const
            },
            filter: {
              "@ID": toStringArray(chunk)
            },
            select: ["ID", ...customFieldNames],
            start: 0
          },
          {
            allowedCustomFields: customFieldNames
          }
        );

        return this.extractItems(response);
      }
    );
  }

  async listActivitiesByIds(activityIds: string[]) {
    if (activityIds.length === 0) {
      return [];
    }

    return this.collectChunked(
      activityIds,
      async (chunk) => {
        const response = await this.call<ActivityRow[]>("crm.activity.list", {
          order: {
            ID: "ASC" as const
          },
          filter: {
            OWNER_TYPE_ID: 2,
            "@ID": toStringArray(chunk)
          },
          select: [
            "ID",
            "OWNER_TYPE_ID",
            "OWNER_ID",
            "TYPE_ID",
            "PROVIDER_ID",
            "RESPONSIBLE_ID",
            "CREATED",
            "DEADLINE",
            "LAST_UPDATED",
            "COMPLETED",
            "COMPLETED_DATE"
          ],
          start: 0
        });

        return this.extractItems(response);
      }
    );
  }

  async listActivityBindings(activityIds: string[]) {
    if (activityIds.length === 0) {
      return [];
    }

    const rows: ActivityBindingRow[] = [];
    for (const activityId of Array.from(new Set(activityIds))) {
      const response = await this.call<ActivityBindingListRow[]>(
        "crm.activity.binding.list",
        {
          activityId
        }
      );

      rows.push(
        ...this.extractItems(response).map((row) => ({
          activityId,
          ownerTypeId: String(row.entityTypeId),
          ownerId: String(row.entityId)
        }))
      );
    }

    return rows;
  }

  async listCalls(input: {
    activityIds?: string[];
    callStartDateFrom?: string;
    callStartDateTo?: string;
    portalUserIds?: string[];
  }) {
    if (input.activityIds && input.activityIds.length === 0) {
      return [];
    }

    if (input.activityIds && input.activityIds.length > 0) {
      return this.collectChunked(input.activityIds, (chunk) =>
        this.collectPagedList<CallRow>("voximplant.statistic.get", (start) => ({
          FILTER: {
            CRM_ACTIVITY_ID: toStringArray(chunk)
          },
          start
        }))
      );
    }

    if (
      input.callStartDateFrom &&
      input.callStartDateTo &&
      input.portalUserIds &&
      input.portalUserIds.length > 0
    ) {
      return this.collectPagedList<CallRow>("voximplant.statistic.get", (start) => ({
        FILTER: {
          ">=CALL_START_DATE": input.callStartDateFrom,
          "<=CALL_START_DATE": input.callStartDateTo,
          PORTAL_USER_ID: toStringArray(input.portalUserIds ?? [])
        },
        start
      }));
    }

    return [];
  }

  async fetchUsers(input: { ids: string[] }) {
    if (input.ids.length === 0) {
      return [];
    }

    return this.collectChunked(
      input.ids,
      async (chunk) => {
        const response = await this.call<UserRow[]>("user.get", {
          ID: toStringArray(chunk)
        });

        return this.extractItems(response);
      },
      50
    );
  }
}
