import type {
  AttractionOntologyResponse,
  OntologyConcept,
  OntologyDriftItem,
  OntologySourceDocumentResponse,
  StageCatalogEntry
} from "@bitrix24-reporting/contracts";
import { readFile } from "node:fs/promises";
import path from "node:path";

type AttractionOntologyRegistry = Omit<AttractionOntologyResponse, "drift">;

const DEFAULT_REGISTRY_PATH = path.join(
  "docs/modules/attraction/ontology/registry/attraction-ontology.json"
);
const ATTRACTION_DOCS_PATH = path.join("docs", "modules", "attraction");

export class AttractionOntologySourceError extends Error {
  readonly code:
    | "SOURCE_NOT_FOUND"
    | "SOURCE_NOT_READABLE"
    | "SOURCE_OUTSIDE_ALLOWLIST";

  constructor(
    code:
      | "SOURCE_NOT_FOUND"
      | "SOURCE_NOT_READABLE"
      | "SOURCE_OUTSIDE_ALLOWLIST",
    message: string
  ) {
    super(message);
    this.name = "AttractionOntologySourceError";
    this.code = code;
  }
}

function registryPathCandidates(registryPath?: string) {
  if (registryPath) {
    return [registryPath];
  }

  return [
    path.join(process.cwd(), DEFAULT_REGISTRY_PATH),
    path.join(process.cwd(), "..", "..", DEFAULT_REGISTRY_PATH)
  ];
}

function repoRootFromRegistryPath(registryPath: string) {
  return path.resolve(path.dirname(registryPath), "..", "..", "..", "..", "..");
}

async function readAttractionOntologyRegistry(registryPath?: string): Promise<{
  registry: AttractionOntologyRegistry;
  repoRoot: string;
}> {
  let lastError: unknown = null;

  for (const candidate of registryPathCandidates(registryPath)) {
    const resolvedCandidate = path.resolve(candidate);

    try {
      const rawRegistry = await readFile(resolvedCandidate, "utf8");
      return {
        registry: JSON.parse(rawRegistry) as AttractionOntologyRegistry,
        repoRoot: repoRootFromRegistryPath(resolvedCandidate)
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

function isAttractionDealStage(stage: StageCatalogEntry) {
  return stage.entityType === "deal" && stage.categoryId === "10";
}

function stageConcepts(concepts: OntologyConcept[]) {
  return concepts.filter((concept) => concept.bitrix?.stageId);
}

function buildOntologyDrift(input: {
  concepts: OntologyConcept[];
  stageCatalog: StageCatalogEntry[];
}): OntologyDriftItem[] {
  const runtimeStages = input.stageCatalog.filter(isAttractionDealStage);

  if (runtimeStages.length === 0) {
    return [
      {
        kind: "stage",
        severity: "info",
        label: "Stage catalog is empty",
        message:
          "Локальный каталог стадий Привлечения пуст; drift будет проверен после синхронизации Bitrix metadata."
      }
    ];
  }

  const ontologyStageById = new Map(
    stageConcepts(input.concepts).map((concept) => [
      concept.bitrix?.stageId ?? "",
      concept
    ])
  );
  const runtimeStageById = new Map(
    runtimeStages.map((stage) => [stage.statusId, stage])
  );
  const drift: OntologyDriftItem[] = [];

  for (const stage of runtimeStages) {
    const concept = ontologyStageById.get(stage.statusId);

    if (!concept) {
      drift.push({
        kind: "stage",
        severity: "warning",
        label: stage.name,
        message: `В Bitrix есть стадия ${stage.statusId}, но ее нет в ontology registry.`
      });
      continue;
    }

    if (concept.label !== stage.name) {
      drift.push({
        kind: "stage",
        severity: "info",
        label: concept.label,
        message: `Название в онтологии отличается от Bitrix: "${concept.label}" vs "${stage.name}".`
      });
    }
  }

  for (const concept of stageConcepts(input.concepts)) {
    const stageId = concept.bitrix?.stageId;

    if (stageId && !runtimeStageById.has(stageId)) {
      drift.push({
        kind: "stage",
        severity: "warning",
        label: concept.label,
        message: `В ontology registry есть стадия ${stageId}, но ее нет в текущем Bitrix stage catalog.`
      });
    }
  }

  return drift;
}

export function buildAttractionOntology(input: {
  registry: AttractionOntologyRegistry;
  stageCatalog: StageCatalogEntry[];
}): AttractionOntologyResponse {
  return {
    ...input.registry,
    drift: buildOntologyDrift({
      concepts: input.registry.concepts,
      stageCatalog: input.stageCatalog
    })
  };
}

export async function loadAttractionOntology(input: {
  stageCatalog: StageCatalogEntry[];
  registryPath?: string;
}): Promise<AttractionOntologyResponse> {
  const { registry } = await readAttractionOntologyRegistry(input.registryPath);

  return buildAttractionOntology({
    registry,
    stageCatalog: input.stageCatalog
  });
}

function resolveReadableSourcePath(input: {
  href: string;
  repoRoot: string;
}) {
  const normalizedHref = input.href.replace(/\\/g, "/");

  if (
    !normalizedHref.startsWith("docs/modules/attraction/") ||
    !normalizedHref.endsWith(".md")
  ) {
    throw new AttractionOntologySourceError(
      "SOURCE_NOT_READABLE",
      `Source ${input.href} is not a local attraction markdown document.`
    );
  }

  const docsRoot = path.resolve(input.repoRoot, ATTRACTION_DOCS_PATH);
  const sourcePath = path.resolve(input.repoRoot, normalizedHref);

  if (sourcePath !== docsRoot && !sourcePath.startsWith(`${docsRoot}${path.sep}`)) {
    throw new AttractionOntologySourceError(
      "SOURCE_OUTSIDE_ALLOWLIST",
      `Source ${input.href} resolves outside the attraction docs allowlist.`
    );
  }

  return sourcePath;
}

export async function loadAttractionOntologySourceDocument(input: {
  sourceId: string;
  registryPath?: string;
}): Promise<OntologySourceDocumentResponse> {
  const { registry, repoRoot } = await readAttractionOntologyRegistry(input.registryPath);
  const source = registry.sources.find((candidate) => candidate.id === input.sourceId);

  if (!source) {
    throw new AttractionOntologySourceError(
      "SOURCE_NOT_FOUND",
      `Ontology source ${input.sourceId} was not found.`
    );
  }

  const sourcePath = resolveReadableSourcePath({
    href: source.href,
    repoRoot
  });

  return {
    moduleKey: "attraction",
    source,
    content: await readFile(sourcePath, "utf8")
  };
}
