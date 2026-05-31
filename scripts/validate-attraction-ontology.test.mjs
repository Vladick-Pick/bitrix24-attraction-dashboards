import assert from "node:assert/strict";
import test from "node:test";

import { validateAttractionOntology } from "./validate-attraction-ontology.mjs";

function validRegistry(overrides = {}) {
  return {
    moduleKey: "attraction",
    title: "Онтология Привлечения",
    governance: {
      decisionRole: "Технолог бизнес-процессов",
      decisionUnit: "Центр Технологизации"
    },
    lastReviewedAt: "2026-05-29",
    sources: [
      {
        id: "source-doc",
        label: "Регламент",
        kind: "google-doc",
        href: "https://docs.google.com/document/d/example/edit",
        canonicality: "supporting"
      }
    ],
    concepts: [
      {
        id: "incoming_base",
        type: "stage",
        label: "База входящая",
        status: "confirmed",
        definition: "Входящая база заявок.",
        not: [],
        bitrix: {
          categoryId: "10",
          stageId: "C10:NEW"
        },
        sourceIds: ["source-doc"],
        reportBindingIds: ["funnel"]
      },
      {
        id: "meeting_intro",
        type: "stage",
        label: "Встреча-знакомство",
        status: "confirmed",
        definition: "Контур организации встречи знакомства.",
        not: [],
        bitrix: {
          categoryId: "10",
          stageId: "C10:UC_9E0XYG"
        },
        sourceIds: ["source-doc"],
        reportBindingIds: ["funnel"]
      }
    ],
    transitions: [
      {
        id: "incoming_to_meeting_auto_purchase",
        label: "Автопокупка",
        status: "confirmed",
        fromConceptId: "incoming_base",
        toConceptId: "meeting_intro",
        definition: "Автопереход при нарушении SLA.",
        trigger: "SLA breach",
        sourceIds: ["source-doc"],
        reportBindingIds: ["funnel"]
      }
    ],
    reportBindings: [
      {
        id: "funnel",
        label: "Воронка",
        sceneId: "sales",
        blockId: "attraction-funnel-flow",
        href: "#attraction-funnel-flow"
      }
    ],
    ...overrides
  };
}

test("valid registry has no validation errors", () => {
  assert.deepEqual(validateAttractionOntology(validRegistry()), []);
});

test("duplicate concept ids fail", () => {
  const registry = validRegistry({
    concepts: [
      ...validRegistry().concepts,
      {
        ...validRegistry().concepts[0],
        label: "Дубликат"
      }
    ]
  });

  assert.match(validateAttractionOntology(registry).join("\n"), /duplicate concept id: incoming_base/);
});

test("missing concept source reference fails", () => {
  const registry = validRegistry({
    concepts: [
      {
        ...validRegistry().concepts[0],
        sourceIds: ["missing-source"]
      }
    ]
  });

  assert.match(validateAttractionOntology(registry).join("\n"), /unknown source id: missing-source/);
});

test("missing concept report binding reference fails", () => {
  const registry = validRegistry({
    concepts: [
      {
        ...validRegistry().concepts[0],
        reportBindingIds: ["missing-report"]
      }
    ]
  });

  assert.match(
    validateAttractionOntology(registry).join("\n"),
    /unknown report binding id: missing-report/
  );
});

test("concepts with Bitrix stage ids must use attraction category 10", () => {
  const registry = validRegistry({
    concepts: [
      {
        ...validRegistry().concepts[0],
        bitrix: {
          categoryId: "11",
          stageId: "C11:NEW"
        }
      }
    ]
  });

  assert.match(validateAttractionOntology(registry).join("\n"), /must use categoryId "10"/);
});

test("moduleKey must be attraction", () => {
  const registry = validRegistry({ moduleKey: "leadgen" });

  assert.match(validateAttractionOntology(registry).join("\n"), /moduleKey must be "attraction"/);
});

test("leadgen category 28 is rejected", () => {
  const registry = validRegistry({
    concepts: [
      {
        ...validRegistry().concepts[0],
        bitrix: {
          categoryId: "28",
          stageId: "C28:NEW"
        }
      }
    ]
  });

  assert.match(validateAttractionOntology(registry).join("\n"), /leadgen category 28 is out of scope/);
});
