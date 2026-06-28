import { afterEach, describe, expect, it, vi } from "vitest";

import { TelegramBotClient } from "../src/server/telegram-client";

function createTelegramResponse(payload: unknown = { ok: true, result: {} }) {
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

describe("TelegramBotClient", () => {
  it("sends interactive messages with reply markup and returns message id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createTelegramResponse({
        ok: true,
        result: {
          message_id: 42
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new TelegramBotClient({
      botToken: "token",
      timeoutMs: 1_000
    });

    await expect(
      client.sendMessage({
        chatId: "123",
        text: "message",
        replyMarkup: {
          inline_keyboard: [
            [
              {
                text: "Записать",
                callback_data: "ce:token"
              }
            ]
          ]
        }
      })
    ).resolves.toEqual({ messageId: "42" });

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://api.telegram.org/bottoken/sendMessage"
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      chat_id: "123",
      text: "message",
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Записать",
              callback_data: "ce:token"
            }
          ]
        ]
      }
    });
  });

  it("answers callback queries", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createTelegramResponse());
    vi.stubGlobal("fetch", fetchMock);

    const client = new TelegramBotClient({
      botToken: "token",
      timeoutMs: 1_000
    });

    await client.answerCallbackQuery({
      callbackQueryId: "callback-1",
      text: "Готово"
    });

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://api.telegram.org/bottoken/answerCallbackQuery"
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      callback_query_id: "callback-1",
      text: "Готово"
    });
  });
});
