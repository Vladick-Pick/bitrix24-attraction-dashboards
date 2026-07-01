import type {
  CreateEnrichmentProposalInput,
  EnrichmentProposalActionType
} from "./sqlite-repository.js";
import {
  getCallEnrichmentFieldByCode,
  type CallEnrichmentFieldDescriptor
} from "./call-enrichment-fields.js";
import {
  isUnresolvedEnrichmentReference,
  normalizeCallEnrichmentValue,
  valuesAreEquivalent
} from "./call-enrichment-current-values.js";
import type { CallEnrichmentCandidate } from "./openrouter-enrichment-extraction.js";

export type CallEnrichmentProposalDraft = Omit<
  CreateEnrichmentProposalInput,
  "id" | "batchId" | "status" | "createdAt" | "updatedAt"
>;

export type CallEnrichmentSkipReason =
  | "duplicate_confirmation"
  | "low_confidence"
  | "unmapped_reference"
  | "invalid_value"
  | "not_writable_v1";

export interface SkippedCallEnrichmentCandidate {
  fieldCode: string;
  fieldTitle: string;
  entityType: "contact" | "deal";
  reason: CallEnrichmentSkipReason;
  evidenceSnippet: string | null;
  confidence: number;
}

export interface BuildCallEnrichmentDiffInput {
  dealId: string;
  contactId?: string | null;
  candidates: CallEnrichmentCandidate[];
  currentValues: {
    contact?: Record<string, unknown> | null;
    deal?: Record<string, unknown> | null;
  };
  minConfidence?: number;
}

export interface CallEnrichmentDiffResult {
  proposals: CallEnrichmentProposalDraft[];
  skipped: SkippedCallEnrichmentCandidate[];
}

const DEFAULT_MIN_CONFIDENCE = 0.55;
const SENSITIVE_INFERRED_LOGICAL_KEYS = new Set([
  "gender",
  "age",
  "personalIncome",
  "familyChildren"
]);

export function buildCallEnrichmentDiff(
  input: BuildCallEnrichmentDiffInput
): CallEnrichmentDiffResult {
  const minConfidence = input.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
  const proposals: CallEnrichmentProposalDraft[] = [];
  const skipped: SkippedCallEnrichmentCandidate[] = [];
  const proposedFieldKeys = new Set<string>();

  for (const candidate of input.candidates) {
    const descriptor = getCallEnrichmentFieldByCode(candidate.fieldCode);
    if (!descriptor || descriptor.entityType !== candidate.entity) {
      skipped.push(toSkippedCandidate(candidate, "invalid_value"));
      continue;
    }

    if (candidate.confidence < minConfidence) {
      skipped.push(toSkippedCandidate(candidate, "low_confidence", descriptor));
      continue;
    }

    if (shouldSkipSensitiveInference(descriptor, candidate)) {
      skipped.push(toSkippedCandidate(candidate, "invalid_value", descriptor));
      continue;
    }

    const entityId = resolveEntityId(input, descriptor);
    if (!entityId) {
      skipped.push(toSkippedCandidate(candidate, "invalid_value", descriptor));
      continue;
    }

    const proposed = normalizeCallEnrichmentValue(
      descriptor,
      candidate.proposedValue
    );
    if (proposed.isEmpty) {
      skipped.push(toSkippedCandidate(candidate, "invalid_value", descriptor));
      continue;
    }

    if (isUnresolvedEnrichmentReference(proposed.value)) {
      skipped.push(toSkippedCandidate(candidate, "unmapped_reference", descriptor));
      continue;
    }

    if (!descriptor.writableInV1) {
      skipped.push(toSkippedCandidate(candidate, "not_writable_v1", descriptor));
      continue;
    }

    const currentEntityValues = input.currentValues[descriptor.entityType];
    if (!currentEntityValues) {
      skipped.push(toSkippedCandidate(candidate, "invalid_value", descriptor));
      continue;
    }

    const current = normalizeCallEnrichmentValue(
      descriptor,
      currentEntityValues[descriptor.bitrixFieldCode]
    );
    const fieldKey = `${descriptor.entityType}:${descriptor.bitrixFieldCode}`;
    if (proposedFieldKeys.has(fieldKey)) {
      skipped.push(
        toSkippedCandidate(candidate, "duplicate_confirmation", descriptor)
      );
      continue;
    }

    const actionType = resolveActionType(current, proposed.value);
    if (!actionType) {
      skipped.push(
        toSkippedCandidate(candidate, "duplicate_confirmation", descriptor)
      );
      continue;
    }

    proposedFieldKeys.add(fieldKey);
    proposals.push({
      entityType: descriptor.entityType,
      entityId,
      fieldCode: descriptor.bitrixFieldCode,
      fieldTitle: descriptor.title,
      actionType,
      currentValue: current.value,
      proposedValue: candidate.proposedValue,
      normalizedValue: proposed.value,
      confidence: candidate.confidence,
      evidenceSnippet: candidate.evidenceSnippet
    });
  }

  return { proposals, skipped };
}

function resolveActionType(
  current: ReturnType<typeof normalizeCallEnrichmentValue>,
  proposedValue: unknown
): EnrichmentProposalActionType | null {
  if (current.isEmpty) {
    return "fill_empty";
  }

  return valuesAreEquivalent(current.value, proposedValue) ? null : "overwrite";
}

function shouldSkipSensitiveInference(
  descriptor: CallEnrichmentFieldDescriptor,
  candidate: CallEnrichmentCandidate
) {
  return (
    candidate.explicitness !== "explicit" &&
    SENSITIVE_INFERRED_LOGICAL_KEYS.has(descriptor.logicalKey)
  );
}

function resolveEntityId(
  input: BuildCallEnrichmentDiffInput,
  descriptor: CallEnrichmentFieldDescriptor
) {
  return descriptor.entityType === "deal" ? input.dealId : input.contactId ?? null;
}

function toSkippedCandidate(
  candidate: CallEnrichmentCandidate,
  reason: CallEnrichmentSkipReason,
  descriptor?: CallEnrichmentFieldDescriptor
): SkippedCallEnrichmentCandidate {
  return {
    fieldCode: descriptor?.bitrixFieldCode ?? candidate.fieldCode,
    fieldTitle: descriptor?.title ?? candidate.fieldTitle,
    entityType: descriptor?.entityType ?? candidate.entity,
    reason,
    evidenceSnippet: candidate.evidenceSnippet || null,
    confidence: candidate.confidence
  };
}
