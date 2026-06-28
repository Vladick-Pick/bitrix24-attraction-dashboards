import type { CallEnrichmentFieldDescriptor } from "./call-enrichment-fields.js";
import type { UnresolvedEnrichmentReference } from "./openrouter-enrichment-extraction.js";

export interface NormalizedCallEnrichmentValue {
  isEmpty: boolean;
  value: unknown | null;
}

export function normalizeCallEnrichmentValue(
  descriptor: CallEnrichmentFieldDescriptor,
  value: unknown
): NormalizedCallEnrichmentValue {
  if (isEmptyValue(value)) {
    return { isEmpty: true, value: null };
  }

  if (isUnresolvedEnrichmentReference(value)) {
    return { isEmpty: false, value };
  }

  if (descriptor.multiple) {
    const values = toArray(value)
      .map((item) => normalizeSingleValue(descriptor, item))
      .filter((item) => item !== null);

    return values.length > 0
      ? { isEmpty: false, value: values }
      : { isEmpty: true, value: null };
  }

  const normalized = normalizeSingleValue(descriptor, firstValue(value));
  return normalized === null
    ? { isEmpty: true, value: null }
    : { isEmpty: false, value: normalized };
}

export function valuesAreEquivalent(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function isUnresolvedEnrichmentReference(
  value: unknown
): value is UnresolvedEnrichmentReference {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as { kind?: unknown }).kind === "unresolved_reference" &&
    typeof (value as { label?: unknown }).label === "string"
  );
}

function normalizeSingleValue(
  descriptor: CallEnrichmentFieldDescriptor,
  value: unknown
) {
  if (isEmptyValue(value)) {
    return null;
  }

  if (descriptor.valueKind === "integer") {
    return normalizeNumber(value, { integer: true });
  }

  if (descriptor.valueKind === "double") {
    return normalizeNumber(value, { integer: false });
  }

  if (descriptor.valueKind === "enum") {
    return normalizeEnumValue(descriptor, value);
  }

  if (descriptor.valueKind === "url") {
    return normalizeUrlValue(value);
  }

  if (
    descriptor.valueKind === "crm_multiple" ||
    descriptor.valueKind === "iblock_element"
  ) {
    return normalizeReferenceValue(value);
  }

  return normalizeStringValue(value);
}

function normalizeNumber(value: unknown, options: { integer: boolean }) {
  const parsed =
    typeof value === "number"
      ? value
      : Number(normalizeStringValue(value)?.replace(",", "."));

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return options.integer && !Number.isInteger(parsed) ? null : parsed;
}

function normalizeEnumValue(
  descriptor: CallEnrichmentFieldDescriptor,
  value: unknown
) {
  const rawValue = normalizeStringValue(value);
  if (!rawValue) {
    return null;
  }

  const option = descriptor.enumOptions?.find(
    (item) =>
      item.id === rawValue ||
      normalizeComparableLabel(item.label) === normalizeComparableLabel(rawValue)
  );

  return option?.id ?? rawValue;
}

function normalizeUrlValue(value: unknown) {
  const rawValue = normalizeStringValue(value);
  if (!rawValue) {
    return null;
  }

  try {
    const url = new URL(rawValue);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function normalizeReferenceValue(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "string") {
    return normalizeStringValue(value);
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return (
      normalizeReferenceValue(record.ID) ??
      normalizeReferenceValue(record.id) ??
      normalizeReferenceValue(record.VALUE) ??
      normalizeReferenceValue(record.value) ??
      normalizeReferenceValue(record.NAME) ??
      normalizeReferenceValue(record.name)
    );
  }

  return null;
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === "string") {
    return value.trim().length === 0;
  }

  if (Array.isArray(value)) {
    return value.length === 0 || value.every(isEmptyValue);
  }

  return false;
}

function firstValue(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

function toArray(value: unknown) {
  return Array.isArray(value) ? value : [value];
}

function normalizeStringValue(value: unknown) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeComparableLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[–—−]/g, "-")
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
