export interface TelegramMessageSender {
  sendMessage(input: { chatId: string; text: string }): Promise<void>;
}

interface TelegramBotClientInput {
  botToken: string;
  timeoutMs?: number;
}

export class TelegramBotClient implements TelegramMessageSender {
  private readonly botToken: string;
  private readonly timeoutMs: number;

  constructor(input: TelegramBotClientInput) {
    this.botToken = input.botToken;
    this.timeoutMs = input.timeoutMs ?? 10_000;
  }

  async sendMessage(input: { chatId: string; text: string }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.botToken}/sendMessage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            chat_id: input.chatId,
            text: input.text,
            disable_web_page_preview: true
          }),
          signal: controller.signal
        }
      );

      if (!response.ok) {
        throw new Error(
          `Telegram sendMessage failed with status ${response.status}: ${await readTelegramError(response)}`
        );
      }
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
