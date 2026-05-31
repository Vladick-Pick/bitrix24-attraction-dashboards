import { describe, expect, it } from "vitest";
import type { StageCatalogEntry } from "@bitrix24-reporting/contracts";

import * as attractionOntologyDomain from "../src/domain/attraction-ontology";

const attractionStages: StageCatalogEntry[] = [
  ["C10:NEW", "База входящая", "P", 10],
  ["C10:PREPARATION", "Звонок-знакомство", "P", 20],
  ["C10:UC_9E0XYG", "Встреча-знакомство", "P", 40],
  ["C10:UC_61CBCU", "Активация", "P", 50],
  ["C10:UC_A249EJ", "Демонстрация", "P", 60],
  ["C10:UC_CPR91Y", "Проблематизация", "P", 70],
  ["C10:UC_5KZT6Y", "Адмиссия", "P", 80],
  ["C10:UC_M1M5WM", "Контракт", "P", 90],
  ["C10:UC_7CLBFT", "На передаче", "P", 100],
  ["C10:UC_XEEP0A", "Отклонено потребителем", "F", 110],
  ["C10:WON", "Передано в клуб", "S", 120],
  ["C10:LOSE", "Корзина", "F", 130],
  ["C10:UC_EA3R76", "Возврат в Лидген(неквал)", "F", 140]
].map(([statusId, name, semanticId, sortOrder]) => ({
  entityType: "deal" as const,
  categoryId: "10",
  statusId: String(statusId),
  name: String(name),
  semanticId: String(semanticId),
  sortOrder: Number(sortOrder)
}));

describe("loadAttractionOntology", () => {
  it("loads the attraction registry and maps current Bitrix stages without drift", async () => {
    const ontology = await attractionOntologyDomain.loadAttractionOntology({
      stageCatalog: attractionStages
    });

    expect(ontology.moduleKey).toBe("attraction");
    expect(ontology.governance).toEqual({
      decisionRole: "Технолог бизнес-процессов",
      decisionUnit: "Центр Технологизации"
    });
    expect(
      ontology.concepts.find(
        (concept) => concept.id === "handoff_rejected_by_club"
      )
    ).toMatchObject({
      label: "Отклонено потребителем",
      bitrix: {
        categoryId: "10",
        stageId: "C10:UC_XEEP0A"
      }
    });
    expect(ontology.drift).toEqual([]);
  });

  it("flags attraction stages that exist in Bitrix but not in the ontology", async () => {
    const ontology = await attractionOntologyDomain.loadAttractionOntology({
      stageCatalog: [
        ...attractionStages,
        {
          entityType: "deal",
          categoryId: "10",
          statusId: "C10:NEW_CUSTOM_STAGE",
          name: "Новый этап",
          semanticId: "P",
          sortOrder: 150
        }
      ]
    });

    expect(ontology.drift).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "stage",
          severity: "warning",
          label: "Новый этап"
        })
      ])
    );
  });

  it("does not treat an empty stage catalog as confirmed stage drift", async () => {
    const ontology = await attractionOntologyDomain.loadAttractionOntology({
      stageCatalog: []
    });

    expect(ontology.drift).toEqual([
      expect.objectContaining({
        kind: "stage",
        severity: "info"
      })
    ]);
  });

  it("loads a local markdown source document from the attraction docs allowlist", async () => {
    const document = await (
      attractionOntologyDomain as typeof attractionOntologyDomain & {
        loadAttractionOntologySourceDocument(input: {
          sourceId: string;
          registryPath?: string;
        }): Promise<{
          moduleKey: "attraction";
          source: { id: string; href: string };
          content: string;
        }>;
      }
    ).loadAttractionOntologySourceDocument({
      sourceId: "module_ontology"
    });

    expect(document.moduleKey).toBe("attraction");
    expect(document.source).toMatchObject({
      id: "module_ontology",
      href: "docs/modules/attraction/MODULE_ONTOLOGY.md"
    });
    expect(document.content).toContain("# Онтология модуля «Привлечение»");
  });

  it("rejects external sources from the local source document reader", async () => {
    await expect(
      (
        attractionOntologyDomain as typeof attractionOntologyDomain & {
          loadAttractionOntologySourceDocument(input: {
            sourceId: string;
            registryPath?: string;
          }): Promise<unknown>;
        }
      ).loadAttractionOntologySourceDocument({
        sourceId: "regulation_incoming_leads"
      })
    ).rejects.toMatchObject({
      code: "SOURCE_NOT_READABLE"
    });
  });
});
