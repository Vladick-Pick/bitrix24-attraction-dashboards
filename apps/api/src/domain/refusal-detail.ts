const MAX_REFUSAL_REASON_DETAIL_LENGTH = 1000;

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const URL_PATTERN = /\b(?:https?:\/\/|www\.)\S+/i;
const PHONE_PATTERN = /(?:\+?\d[\s().-]*){7,}\d/;
const HANDLE_PATTERN = /(^|\s)@[a-z0-9_]{5,}\b/i;

function containsObviousPersonalContactData(value: string) {
  return (
    EMAIL_PATTERN.test(value) ||
    URL_PATTERN.test(value) ||
    PHONE_PATTERN.test(value) ||
    HANDLE_PATTERN.test(value)
  );
}

export function sanitizeRefusalReasonDetail(
  value: string | null | undefined
): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized || containsObviousPersonalContactData(normalized)) {
    return null;
  }

  return normalized.slice(0, MAX_REFUSAL_REASON_DETAIL_LENGTH);
}
