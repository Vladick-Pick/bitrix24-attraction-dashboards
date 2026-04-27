import { afterEach, describe, expect, it, vi } from "vitest";

import { BitrixClient } from "../src/bitrix/client";
import { ALLOWED_DEAL_FIELDS } from "../src/bitrix/selectors";

function createResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => payload
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("BitrixClient pagination", () => {
  it("uses ID-based backfill pagination for a full deal sync", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createResponse({
          result: Array.from({ length: 50 }, (_, index) => ({
            ID: String(index + 1)
          }))
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          result: [{ ID: "51" }]
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    const rows = await client.listDeals({ modifiedAfter: null });

    expect(rows).toHaveLength(51);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      select: ALLOWED_DEAL_FIELDS,
      filter: {
        ">ID": "0",
        CATEGORY_ID: "10"
      },
      order: {
        ID: "ASC"
      },
      start: -1
    });

    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      select: ALLOWED_DEAL_FIELDS,
      filter: {
        ">ID": "50",
        CATEGORY_ID: "10"
      },
      order: {
        ID: "ASC"
      },
      start: -1
    });
  });

  it("retries transient network failures from Bitrix", async () => {
    const timeoutError = new TypeError("fetch failed", {
      cause: Object.assign(new Error("connect timeout"), {
        code: "UND_ERR_CONNECT_TIMEOUT"
      })
    });
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(timeoutError)
      .mockResolvedValueOnce(
        createResponse({
          result: [{ ID: "1" }]
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(client.listDeals({ modifiedAfter: null })).resolves.toEqual([
      {
        ID: "1"
      }
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries transient non-json responses from Bitrix", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        statusText: "Bad Gateway",
        json: async () => {
          throw new SyntaxError("Unexpected token '<'");
        }
      })
      .mockResolvedValueOnce(
        createResponse({
          result: [{ ID: "1" }]
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(client.listDeals({ modifiedAfter: null })).resolves.toEqual([
      {
        ID: "1"
      }
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not request unscoped call statistics", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(client.listCalls({})).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("filters call statistics by CRM activity id without the array-operator prefix", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      createResponse({
        result: [
          {
            ID: "CALL1",
            CRM_ACTIVITY_ID: "477324"
          }
        ]
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(
      client.listCalls({ activityIds: ["477324"] })
    ).resolves.toEqual([
      {
        ID: "CALL1",
        CRM_ACTIVITY_ID: "477324"
      }
    ]);

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      FILTER: {
        CRM_ACTIVITY_ID: ["477324"]
      },
      start: 0
    });
  });

  it("paginates scoped call statistics by CRM activity id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createResponse({
          result: [{ ID: "CALL1", CRM_ACTIVITY_ID: "477324" }],
          next: 50
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          result: [{ ID: "CALL2", CRM_ACTIVITY_ID: "477325" }]
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(
      client.listCalls({ activityIds: ["477324", "477325"] })
    ).resolves.toEqual([
      { ID: "CALL1", CRM_ACTIVITY_ID: "477324" },
      { ID: "CALL2", CRM_ACTIVITY_ID: "477325" }
    ]);

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      FILTER: {
        CRM_ACTIVITY_ID: ["477324", "477325"]
      },
      start: 0
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      FILTER: {
        CRM_ACTIVITY_ID: ["477324", "477325"]
      },
      start: 50
    });
  });

  it("fetches supplemental call statistics by date and portal users", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      createResponse({
        result: [
          {
            ID: "CALL_SUPPLEMENTAL",
            CRM_ACTIVITY_ID: null,
            PORTAL_USER_ID: "78",
            CALL_TYPE: "1",
            CALL_START_DATE: "2026-04-20T10:00:00.000Z",
            CALL_DURATION: "45",
            CRM_ENTITY_TYPE: "DEAL",
            CRM_ENTITY_ID: "D1",
            CALL_FAILED_CODE: "200"
          }
        ]
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(
      client.listCalls({
        callStartDateFrom: "2026-04-01T00:00:00.000Z",
        callStartDateTo: "2026-04-30T23:59:59.999Z",
        portalUserIds: ["78", "11234"]
      })
    ).resolves.toHaveLength(1);

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      FILTER: {
        ">=CALL_START_DATE": "2026-04-01T00:00:00.000Z",
        "<=CALL_START_DATE": "2026-04-30T23:59:59.999Z",
        PORTAL_USER_ID: ["78", "11234"]
      },
      start: 0
    });
  });

  it("fetches deal-owned CRM activities by id without selecting PII fields", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      createResponse({
        result: [
          {
            ID: "477324",
            OWNER_TYPE_ID: "2",
            OWNER_ID: "101"
          }
        ]
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(client.listActivitiesByIds(["477324"])).resolves.toEqual([
      {
        ID: "477324",
        OWNER_TYPE_ID: "2",
        OWNER_ID: "101"
      }
    ]);

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      order: {
        ID: "ASC"
      },
      filter: {
        OWNER_TYPE_ID: 2,
        "@ID": ["477324"]
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
  });

  it("chunks activity owner filters to avoid one huge Bitrix binding filter", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createResponse({
        result: []
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });
    const ownerIds = Array.from({ length: 51 }, (_, index) => String(index + 1));

    await expect(
      client.listActivities({
        ownerIds,
        modifiedAfter: "2026-01-01T00:00:00.000Z",
        providerId: "CRM_TODO"
      })
    ).resolves.toEqual([]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)).filter).toEqual({
      BINDINGS: ownerIds.slice(0, 50).map((ownerId) => ({
        OWNER_TYPE_ID: 2,
        OWNER_ID: ownerId
      })),
      PROVIDER_ID: "CRM_TODO",
      ">=LAST_UPDATED": "2026-01-01T00:00:00.000Z"
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)).filter).toEqual({
      OWNER_TYPE_ID: 2,
      OWNER_ID: "51",
      PROVIDER_ID: "CRM_TODO",
      ">=LAST_UPDATED": "2026-01-01T00:00:00.000Z"
    });
  });

  it("lists contacts by id using only explicitly allowed custom fields", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      createResponse({
        result: [
          {
            ID: "4964",
            UF_CRM_1712252375: "140488",
            UF_CRM_1691070302: "4734"
          }
        ]
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(
      client.listContacts({
        ids: ["4964"],
        customFieldNames: ["UF_CRM_1712252375", "UF_CRM_1691070302"]
      })
    ).resolves.toEqual([
      {
        ID: "4964",
        UF_CRM_1712252375: "140488",
        UF_CRM_1691070302: "4734"
      }
    ]);

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      order: {
        ID: "ASC"
      },
      filter: {
        "@ID": ["4964"]
      },
      select: ["ID", "UF_CRM_1712252375", "UF_CRM_1691070302"],
      start: 0
    });
  });

  it("resolves quality labels through crm.deal.fields and crm.item.list", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createResponse({
          result: {
            UF_CRM_1730380390: {
              settings: {
                DYNAMIC_1078: "Y"
              }
            }
          }
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          result: {
            items: [
              {
                id: 6,
                title: "3.1 Готов ко встрече"
              }
            ]
          }
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(
      client.fetchDealQualityMap("UF_CRM_1730380390")
    ).resolves.toEqual({
      "6": "3.1 Готов ко встрече"
    });

    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      entityTypeId: 1078,
      select: ["id", "title"],
      order: {
        id: "ASC"
      },
      start: 0
    });
  });

  it("reuses deal field metadata across concurrent field map requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createResponse({
        result: {
          UF_CRM_ALPHA: {
            items: [{ ID: 1, VALUE: "Alpha" }]
          },
          UF_CRM_BETA: {
            items: [{ ID: 2, VALUE: "Beta" }]
          }
        }
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(
      Promise.all([
        client.fetchDealFieldValueMap("UF_CRM_ALPHA"),
        client.fetchDealFieldValueMap("UF_CRM_BETA")
      ])
    ).resolves.toEqual([{ "1": "Alpha" }, { "2": "Beta" }]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({});
  });

  it("reads stage history rows from nested result.items payloads", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createResponse({
        result: {
          items: [
            {
              ID: 1,
              OWNER_ID: 10,
              CATEGORY_ID: 28,
              STAGE_ID: "C28:NEW",
              STAGE_SEMANTIC_ID: "P",
              TYPE_ID: 1,
              CREATED_TIME: "2026-04-10T09:59:03+03:00"
            }
          ]
        },
        total: 1
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(client.listStageHistory({ ownerIds: ["10"] })).resolves.toEqual([
      {
        ID: 1,
        OWNER_ID: 10,
        CATEGORY_ID: 28,
        STAGE_ID: "C28:NEW",
        STAGE_SEMANTIC_ID: "P",
        TYPE_ID: 1,
        CREATED_TIME: "2026-04-10T09:59:03+03:00"
      }
    ]);

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      entityTypeId: 2,
      filter: {
        "@OWNER_ID": ["10"]
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
        ID: "ASC"
      },
      start: 0
    });
  });

  it("does not paginate contact lookups when the chunk already matches the exact requested ids", async () => {
    const ids = Array.from({ length: 50 }, (_, index) => String(index + 1));
    const fetchMock = vi.fn().mockResolvedValueOnce(
      createResponse({
        result: ids.map((id) => ({
          ID: id
        }))
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(client.listContacts({ ids })).resolves.toEqual(
      ids.map((id) => ({
        ID: id
      }))
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not paginate activity lookups when the chunk already matches the exact requested ids", async () => {
    const ids = Array.from({ length: 50 }, (_, index) => String(index + 1));
    const fetchMock = vi.fn().mockResolvedValueOnce(
      createResponse({
        result: ids.map((id) => ({
          ID: id,
          OWNER_TYPE_ID: "2",
          OWNER_ID: "101"
        }))
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(client.listActivitiesByIds(ids)).resolves.toEqual(
      ids.map((id) => ({
        ID: id,
        OWNER_TYPE_ID: "2",
        OWNER_ID: "101"
      }))
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
