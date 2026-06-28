import { describe, expect, it } from "vitest";

import {
  buildCallEnrichmentDiff,
  type BuildCallEnrichmentDiffInput
} from "../src/server/call-enrichment-diff";
import {
  CALL_ENRICHMENT_FIELDS,
  type CallEnrichmentFieldDescriptor
} from "../src/server/call-enrichment-fields";
import type { CallEnrichmentCandidate } from "../src/server/openrouter-enrichment-extraction";

function getField(logicalKey: string): CallEnrichmentFieldDescriptor {
  const field = CALL_ENRICHMENT_FIELDS.find(
    (candidate) => candidate.logicalKey === logicalKey
  );
  if (!field) {
    throw new Error(`Field not found: ${logicalKey}`);
  }

  return field;
}

function createCandidate(
  logicalKey: string,
  overrides: Partial<CallEnrichmentCandidate> = {}
): CallEnrichmentCandidate {
  const field = getField(logicalKey);

  return {
    entity: field.entityType,
    fieldCode: field.bitrixFieldCode,
    fieldTitle: field.title,
    proposedValue: "новое значение",
    rawMention: "участник сказал новое значение",
    evidenceSnippet: "участник сказал новое значение",
    confidence: 0.86,
    explicitness: "explicit",
    overwriteRisk: "low",
    ...overrides
  };
}

function buildInput(
  overrides: Partial<BuildCallEnrichmentDiffInput> = {}
): BuildCallEnrichmentDiffInput {
  return {
    dealId: "23841",
    contactId: "901",
    candidates: [],
    currentValues: {
      contact: {},
      deal: {}
    },
    ...overrides
  };
}

describe("buildCallEnrichmentDiff", () => {
  it("creates fill-empty proposals for approved writable contact fields", () => {
    const businessRevenue = getField("businessRevenue");

    expect(
      buildCallEnrichmentDiff(
        buildInput({
          candidates: [
            createCandidate("businessRevenue", {
              proposedValue: "602"
            })
          ],
          currentValues: {
            contact: {
              [businessRevenue.bitrixFieldCode]: ""
            },
            deal: {}
          }
        })
      )
    ).toEqual({
      proposals: [
        {
          entityType: "contact",
          entityId: "901",
          fieldCode: businessRevenue.bitrixFieldCode,
          fieldTitle: businessRevenue.title,
          actionType: "fill_empty",
          currentValue: null,
          proposedValue: "602",
          normalizedValue: "602",
          confidence: 0.86,
          evidenceSnippet: "участник сказал новое значение"
        }
      ],
      skipped: []
    });
  });

  it("creates overwrite proposals for materially different deal fields", () => {
    const keyProjects = getField("keyProjects");
    const result = buildCallEnrichmentDiff(
      buildInput({
        candidates: [
          createCandidate("keyProjects", {
            proposedValue: "Запускает B2B-платформу"
          })
        ],
        currentValues: {
          contact: {},
          deal: {
            [keyProjects.bitrixFieldCode]: "Старый проект"
          }
        }
      })
    );

    expect(result.proposals).toEqual([
      expect.objectContaining({
        entityType: "deal",
        entityId: "23841",
        fieldCode: keyProjects.bitrixFieldCode,
        actionType: "overwrite",
        currentValue: "Старый проект",
        normalizedValue: "Запускает B2B-платформу"
      })
    ]);
    expect(result.skipped).toEqual([]);
  });

  it("skips values that only confirm the current CRM value", () => {
    const businessRevenue = getField("businessRevenue");
    const result = buildCallEnrichmentDiff(
      buildInput({
        candidates: [
          createCandidate("businessRevenue", {
            proposedValue: "602"
          })
        ],
        currentValues: {
          contact: {
            [businessRevenue.bitrixFieldCode]: "500-1000 млн. рублей"
          },
          deal: {}
        }
      })
    );

    expect(result.proposals).toEqual([]);
    expect(result.skipped).toEqual([
      expect.objectContaining({
        fieldCode: businessRevenue.bitrixFieldCode,
        reason: "duplicate_confirmation"
      })
    ]);
  });

  it("does not treat missing current CRM rows as empty fields", () => {
    const clubGoals = getField("clubGoals");
    const keyProjects = getField("keyProjects");
    const result = buildCallEnrichmentDiff(
      buildInput({
        candidates: [
          createCandidate("clubGoals", {
            proposedValue: "найти партнеров"
          }),
          createCandidate("keyProjects", {
            proposedValue: "новый проект"
          })
        ],
        currentValues: {
          contact: null,
          deal: null
        }
      })
    );

    expect(result.proposals).toEqual([]);
    expect(result.skipped).toEqual([
      expect.objectContaining({
        fieldCode: clubGoals.bitrixFieldCode,
        reason: "invalid_value"
      }),
      expect.objectContaining({
        fieldCode: keyProjects.bitrixFieldCode,
        reason: "invalid_value"
      })
    ]);
  });

  it("skips unresolved reference and V1 non-writable fields", () => {
    const city = getField("city");
    const primaryRole = getField("primaryRole");
    const result = buildCallEnrichmentDiff(
      buildInput({
        candidates: [
          createCandidate("city", {
            proposedValue: {
              kind: "unresolved_reference",
              label: "Москва"
            }
          }),
          createCandidate("primaryRole", {
            proposedValue: "Основатель"
          })
        ]
      })
    );

    expect(result.proposals).toEqual([]);
    expect(result.skipped).toEqual([
      expect.objectContaining({
        fieldCode: city.bitrixFieldCode,
        reason: "unmapped_reference"
      }),
      expect.objectContaining({
        fieldCode: primaryRole.bitrixFieldCode,
        reason: "not_writable_v1"
      })
    ]);
  });

  it("skips low-confidence and inferred sensitive candidates", () => {
    const age = getField("age");
    const hobbies = getField("hobbies");
    const result = buildCallEnrichmentDiff(
      buildInput({
        candidates: [
          createCandidate("hobbies", {
            confidence: 0.34,
            proposedValue: "гольф"
          }),
          createCandidate("age", {
            explicitness: "inferred",
            proposedValue: 42
          })
        ]
      })
    );

    expect(result.proposals).toEqual([]);
    expect(result.skipped).toEqual([
      expect.objectContaining({
        fieldCode: hobbies.bitrixFieldCode,
        reason: "low_confidence"
      }),
      expect.objectContaining({
        fieldCode: age.bitrixFieldCode,
        reason: "invalid_value"
      })
    ]);
  });
});
