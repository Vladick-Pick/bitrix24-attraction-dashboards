import { describe, expect, it } from "vitest";

import {
  createPlaybookReader,
  readPlaybookSections
} from "../src/agent/playbook-reader";

describe("playbook reader", () => {
  it("parses KI playbook tabs into searchable sections", async () => {
    const sections = await readPlaybookSections();

    expect(sections.map((section) => section.sectionId)).toEqual([
      "t0",
      "tq",
      "t1",
      "t2",
      "t3",
      "t4",
      "t5",
      "t6"
    ]);
    expect(sections.find((section) => section.sectionId === "t5")).toMatchObject({
      label: "5 События"
    });
    expect(sections.find((section) => section.sectionId === "t5")?.text).toContain(
      "Конверсионные события"
    );
  });

  it("reads and searches sections with deterministic limits", async () => {
    const reader = createPlaybookReader({
      readHtml: async () => `
        <button class="tab active" data-t="a"><span>1</span>Alpha</button>
        <button class="tab" data-t="b">Beta</button>
        <section class="panel active" id="a"><h2>Alpha section</h2><p>meeting playbook</p></section>
        <section class="panel" id="b"><h2>Beta section</h2><p>meeting and event text</p></section>
        <div class="foot">footer</div>
      `
    });

    await expect(reader.readSection({ sectionId: "a" })).resolves.toMatchObject({
      sectionId: "a",
      label: "1 Alpha",
      text: expect.stringContaining("meeting playbook")
    });
    await expect(reader.search({ query: "meeting", limit: 1 })).resolves.toEqual({
      query: "meeting",
      results: [
        expect.objectContaining({
          sectionId: "a",
          snippet: expect.stringContaining("meeting")
        })
      ]
    });
    await expect(reader.readSection({ sectionId: "missing" })).rejects.toMatchObject({
      code: "PLAYBOOK_SECTION_NOT_FOUND"
    });
  });
});
