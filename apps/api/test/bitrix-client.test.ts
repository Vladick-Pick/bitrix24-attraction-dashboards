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
      }
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
});
