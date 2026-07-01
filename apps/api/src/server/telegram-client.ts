export interface TelegramMessageSender {
  sendMessage(input: { chatId: string; text: string }): Promise<unknown>;
}

export interface TelegramInteractiveSender {
  sendMessage(input: {
    chatId: string;
    text: string;
    replyMarkup?: unknown;
  }): Promise<{ messageId: string | null }>;
  answerCallbackQuery(input: {
    callbackQueryId: string;
    text?: string;
  }): Promise<void>;
}

interface TelegramBotClientInput {
  botToken: string;
  timeoutMs?: number;
}

export class TelegramBotClient implements TelegramInteractiveSender {
  private readonly botToken: string;
  private readonly timeoutMs: number;

  constructor(input: TelegramBotClientInput) {
    this.botToken = input.botToken;
    this.timeoutMs = input.timeoutMs ?? 10_000;
  }

  async sendMessage(input: {
    chatId: string;
    text: string;
    replyMarkup?: unknown;
  }): Promise<{ messageId: string | null }> {
    const payload = await this.callTelegram("sendMessage", {
      chat_id: input.chatId,
      text: input.text,
      disable_web_page_preview: true,
      ...(input.replyMarkup ? { reply_markup: input.replyMarkup } : {})
    });
    const result =
      payload.result && typeof payload.result === "object"
        ? (payload.result as { message_id?: unknown })
        : null;
    const messageId = result?.message_id;
    return {
      messageId:
        typeof messageId === "string" || typeof messageId === "number"
          ? String(messageId)
          : null
    };
  }

  async answerCallbackQuery(input: { callbackQueryId: string; text?: string }) {
    await this.callTelegram("answerCallbackQuery", {
      callback_query_id: input.callbackQueryId,
      ...(input.text ? { text: input.text } : {})
    });
  }

  private async callTelegram(
    method: "sendMessage" | "answerCallbackQuery",
    payload: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.botToken}/${method}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        }
      );

      if (!response.ok) {
        throw new Error(
          `Telegram ${method} failed with status ${response.status}: ${await readTelegramError(response)}`
        );
      }

      return (await response.json()) as Record<string, unknown>;
    } finally {
      clearTimeout(timeout);
    }
  }
}

async function readTelegramError(response: Response) {
  try {
    const payload = (await response.json()) as { description?: unknown };

    if (typeof payload.description === "string") {
      return payload.description.slice(0, 200);
    }
  } catch {
    // Fall back to a status-only error below.
  }

  return response.statusText || "unknown error";
}
