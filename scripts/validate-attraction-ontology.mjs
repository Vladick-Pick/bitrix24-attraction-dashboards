import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const VALID_SOURCE_KINDS = new Set([
  "google-doc",
  "google-sheet",
  "markdown",
  "bitrix",
  "dashboard",
  "decision"
]);

const VALID_CANONICALITY = new Set([
  "canonical",
  "supporting",
  "implementation",
  "decision"
]);

const VALID_STATUSES = new Set([
  "confirmed",
  "needs-sync",
  "draft",
  "deprecated",
  "unclassified"
]);

const VALID_CONCEPT_TYPES = new Set([
  "stage",
  "transition",
  "outcome",
  "delivery_quality",
  "format",
  "source"
]);

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function pushDuplicateErrors(items, label, errors) {
  const seen = new Set();

  for (const item of asArray(items)) {
    if (!isRecord(item) || !isNonEmptyString(item.id)) {
      errors.push(`${label} is missing non-empty id`);
      continue;
    }

    if (seen.has(item.id)) {
      errors.push(`duplicate ${label} id: ${item.id}`);
      continue;
    }

    seen.add(item.id);
  }

  return seen;
}

function validateReferences({
  owner,
  sourceIds,
  reportBindingIds,
  knownSourceIds,
  knownReportBindingIds,
  errors
}) {
  for (const sourceId of asArray(sourceIds)) {
    if (!knownSourceIds.has(sourceId)) {
      errors.push(`${owner} references unknown source id: ${sourceId}`);
    }
  }

  for (const reportBindingId of asArray(reportBindingIds)) {
    if (!knownReportBindingIds.has(reportBindingId)) {
      errors.push(`${owner} references unknown report binding id: ${reportBindingId}`);
    }
  }
}

function validateBitrixScope(owner, bitrix, errors) {
  if (!isRecord(bitrix)) {
    return;
  }

  if (bitrix.categoryId === "28") {
    errors.push(`${owner} uses leadgen category 28, but leadgen category 28 is out of scope`);
  }

  if (isNonEmptyString(bitrix.stageId) && bitrix.categoryId !== "10") {
    errors.push(`${owner} with bitrix.stageId must use categoryId "10"`);
  }
}

export function validateAttractionOntology(input) {
  const errors = [];

  if (!isRecord(input)) {
    return ["registry must be an object"];
  }

  if (input.moduleKey !== "attraction") {
    errors.push('moduleKey must be "attraction"');
  }

  if (!isNonEmptyString(input.title)) {
    errors.push("title must be a non-empty string");
  }

  if (!isRecord(input.governance)) {
    errors.push("governance must be an object");
  } else {
    if (!isNonEmptyString(input.governance.decisionRole)) {
      errors.push("governance.decisionRole must be a non-empty string");
    }

    if (!isNonEmptyString(input.governance.decisionUnit)) {
      errors.push("governance.decisionUnit must be a non-empty string");
    }
  }

  if (!isNonEmptyString(input.lastReviewedAt)) {
    errors.push("lastReviewedAt must be a non-empty string");
  }

  for (const collection of ["sources", "concepts", "transitions", "reportBindings"]) {
    if (!Array.isArray(input[collection])) {
      errors.push(`${collection} must be an array`);
    }
  }

  const sourceIds = pushDuplicateErrors(input.sources, "source", errors);
  const conceptIds = pushDuplicateErrors(input.concepts, "concept", errors);
  const transitionIds = pushDuplicateErrors(input.transitions, "transition", errors);
  const reportBindingIds = pushDuplicateErrors(input.reportBindings, "report binding", errors);

  for (const source of asArray(input.sources)) {
    if (!isRecord(source)) {
      errors.push("source must be an object");
      continue;
    }

    if (!VALID_SOURCE_KINDS.has(source.kind)) {
      errors.push(`source ${source.id ?? "<missing>"} has invalid kind: ${source.kind}`);
    }

    if (!VALID_CANONICALITY.has(source.canonicality)) {
      errors.push(`source ${source.id ?? "<missing>"} has invalid canonicality: ${source.canonicality}`);
    }

    if (!isNonEmptyString(source.label)) {
      errors.push(`source ${source.id ?? "<missing>"} label must be a non-empty string`);
    }

    if (!isNonEmptyString(source.href)) {
      errors.push(`source ${source.id ?? "<missing>"} href must be a non-empty string`);
    }
  }

  for (const reportBinding of asArray(input.reportBindings)) {
    if (!isRecord(reportBinding)) {
      errors.push("report binding must be an object");
      continue;
    }

    for (const key of ["label", "sceneId", "blockId", "href"]) {
      if (!isNonEmptyString(reportBinding[key])) {
        errors.push(`report binding ${reportBinding.id ?? "<missing>"} ${key} must be a non-empty string`);
      }
    }
  }

  for (const concept of asArray(input.concepts)) {
    if (!isRecord(concept)) {
      errors.push("concept must be an object");
      continue;
    }

    const owner = `concept ${concept.id ?? "<missing>"}`;

    if (!VALID_CONCEPT_TYPES.has(concept.type)) {
      errors.push(`${owner} has invalid type: ${concept.type}`);
    }

    if (!VALID_STATUSES.has(concept.status)) {
      errors.push(`${owner} has invalid status: ${concept.status}`);
    }

    for (const key of ["label", "definition"]) {
      if (!isNonEmptyString(concept[key])) {
        errors.push(`${owner} ${key} must be a non-empty string`);
      }
    }

    if (!Array.isArray(concept.not)) {
      errors.push(`${owner} not must be an array`);
    }

    validateReferences({
      owner,
      sourceIds: concept.sourceIds,
      reportBindingIds: concept.reportBindingIds,
      knownSourceIds: sourceIds,
      knownReportBindingIds: reportBindingIds,
      errors
    });
    validateBitrixScope(owner, concept.bitrix, errors);
  }

  for (const transition of asArray(input.transitions)) {
    if (!isRecord(transition)) {
      errors.push("transition must be an object");
      continue;
    }

    const owner = `transition ${transition.id ?? "<missing>"}`;

    if (!VALID_STATUSES.has(transition.status)) {
      errors.push(`${owner} has invalid status: ${transition.status}`);
    }

    for (const key of ["label", "definition", "fromConceptId", "toConceptId"]) {
      if (!isNonEmptyString(transition[key])) {
        errors.push(`${owner} ${key} must be a non-empty string`);
      }
    }

    if (isNonEmptyString(transition.fromConceptId) && !conceptIds.has(transition.fromConceptId)) {
      errors.push(`${owner} references unknown fromConceptId: ${transition.fromConceptId}`);
    }

    if (isNonEmptyString(transition.toConceptId) && !conceptIds.has(transition.toConceptId)) {
      errors.push(`${owner} references unknown toConceptId: ${transition.toConceptId}`);
    }

    validateReferences({
      owner,
      sourceIds: transition.sourceIds,
      reportBindingIds: transition.reportBindingIds,
      knownSourceIds: sourceIds,
      knownReportBindingIds: reportBindingIds,
      errors
    });
  }

  for (const id of transitionIds) {
    if (conceptIds.has(id)) {
      errors.push(`transition id conflicts with concept id: ${id}`);
    }
  }

  return errors;
}

async function main() {
  const registryPath = process.argv[2];

  if (!registryPath) {
    console.error("Usage: node scripts/validate-attraction-ontology.mjs <registry.json>");
    process.exitCode = 1;
    return;
  }

  let registry;

  try {
    registry = JSON.parse(await readFile(registryPath, "utf8"));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    return;
  }

  const errors = validateAttractionOntology(registry);

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(error);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Attraction ontology registry valid");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
