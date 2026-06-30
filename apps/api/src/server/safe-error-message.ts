const DEFAULT_SAFE_ERROR_MESSAGE_LENGTH = 180;

export function safeErrorMessage(
  error: unknown,
  maxLength = DEFAULT_SAFE_ERROR_MESSAGE_LENGTH
) {
  if (!(error instanceof Error)) {
    return "unknown";
  }

  return error.message
    .replace(/https?:\/\/\S+/giu, "[url]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, "[email]")
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/gu, "[phone]")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maxLength);
}
