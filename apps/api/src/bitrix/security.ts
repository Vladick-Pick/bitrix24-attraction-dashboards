import { ALLOWED_BITRIX_METHODS } from "./selectors.js";

export { ALLOWED_BITRIX_METHODS };

export const FORBIDDEN_FIELD_TOKENS = [
  "*",
  "UF_*",
  "TITLE",
  "PHONE",
  "EMAIL",
  "WEB",
  "IM",
  "NAME",
  "LAST_NAME",
  "SECOND_NAME",
  "BIRTHDATE",
  "COMMENTS",
  "ADDRESS",
  "COMPANY_TITLE",
  "SOURCE_DESCRIPTION",
  "CONTACT_IDS",
  "COMPANY_ID"
] as const;

const allowedMethodSet = new Set(ALLOWED_BITRIX_METHODS);
const forbiddenFieldSet = new Set(FORBIDDEN_FIELD_TOKENS);

export function assertAllowedBitrixMethod(method: string) {
  if (!allowedMethodSet.has(method as (typeof ALLOWED_BITRIX_METHODS)[number])) {
    throw new Error(`Forbidden Bitrix24 method: ${method}`);
  }
}

export function assertSafeSelectFields(
  fields: string[],
  allowedCustomFields: string[] = []
) {
  const allowedCustomFieldSet = new Set(allowedCustomFields);

  for (const field of fields) {
    if (forbiddenFieldSet.has(field as (typeof FORBIDDEN_FIELD_TOKENS)[number])) {
      throw new Error(`Forbidden Bitrix24 field in select: ${field}`);
    }

    if (field.startsWith("UF_") && !allowedCustomFieldSet.has(field)) {
      throw new Error(`Forbidden Bitrix24 custom field in select: ${field}`);
    }
  }
}

export function redactWebhookUrl(value: string) {
  return value.replace(/\/rest\/([^/]+)\/([^/]+)\//, "/rest/$1/[REDACTED]/");
}
