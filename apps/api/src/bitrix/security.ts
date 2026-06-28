import { ALLOWED_BITRIX_METHODS } from "./selectors.js";
import {
  assertCallEnrichmentFieldAllowed,
  type CallEnrichmentEntityType
} from "../server/call-enrichment-fields.js";

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
const callEnrichmentWriteMethodSet = new Set([
  "crm.contact.update",
  "crm.deal.update"
]);

export function assertAllowedBitrixMethod(method: string) {
  if (!allowedMethodSet.has(method as (typeof ALLOWED_BITRIX_METHODS)[number])) {
    throw new Error(`Forbidden Bitrix24 method: ${method}`);
  }
}

export const assertAllowedBitrixReadMethod = assertAllowedBitrixMethod;

export function assertAllowedCallEnrichmentWriteMethod(method: string) {
  if (!callEnrichmentWriteMethodSet.has(method)) {
    throw new Error(`Forbidden call enrichment Bitrix24 write method: ${method}`);
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

export function assertSafeCallEnrichmentWriteFields(
  entityType: CallEnrichmentEntityType,
  fields: Record<string, unknown>
) {
  const fieldCodes = Object.keys(fields);

  if (fieldCodes.length === 0) {
    throw new Error("Call enrichment write fields must not be empty");
  }

  for (const fieldCode of fieldCodes) {
    if (
      forbiddenFieldSet.has(fieldCode as (typeof FORBIDDEN_FIELD_TOKENS)[number])
    ) {
      throw new Error(`Forbidden Bitrix24 field in enrichment write: ${fieldCode}`);
    }

    assertCallEnrichmentFieldAllowed(entityType, fieldCode);
  }
}

export function redactWebhookUrl(value: string) {
  return value.replace(/\/rest\/([^/]+)\/([^/]+)\//, "/rest/$1/[REDACTED]/");
}
