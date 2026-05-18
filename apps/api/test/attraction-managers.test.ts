import { describe, expect, it } from "vitest";

import {
  ATTRACTION_MANAGER_CATALOG,
  normalizeAttractionManagerFilters
} from "../src/domain/attraction-managers";

describe("attraction manager whitelist", () => {
  it("includes Kakuliya Ilya in the attraction scope", () => {
    expect(ATTRACTION_MANAGER_CATALOG).toContainEqual({
      id: "13020",
      name: "Какулия Илья"
    });

    expect(normalizeAttractionManagerFilters(undefined).managerIds).toContain(
      "13020"
    );
    expect(
      normalizeAttractionManagerFilters({ managerIds: ["13020"] }).managerIds
    ).toEqual(["13020"]);
  });
});
