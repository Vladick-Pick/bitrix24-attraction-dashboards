import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import { createApp } from "../src/server/app";

describe("production static serving", () => {
  const directories: string[] = [];

  afterEach(() => {
    for (const directory of directories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  function createStaticApp() {
    const directory = mkdtempSync(join(tmpdir(), "bitrix24-web-dist-"));
    directories.push(directory);
    mkdirSync(join(directory, "assets"), { recursive: true });
    writeFileSync(join(directory, "index.html"), "<div>dashboard shell</div>");
    writeFileSync(join(directory, "assets", "app.js"), "console.log('ok');");

    return createApp({} as Parameters<typeof createApp>[0], {
      webStaticDir: directory
    });
  }

  it("serves the built web app from Express", async () => {
    const app = createStaticApp();

    await request(app)
      .get("/")
      .expect(200)
      .expect((response) => {
        expect(response.text).toContain("dashboard shell");
      });

    await request(app)
      .get("/assets/app.js")
      .expect(200)
      .expect((response) => {
        expect(response.text).toContain("console.log");
      });

    await request(app)
      .get("/reports")
      .expect(200)
      .expect((response) => {
        expect(response.text).toContain("dashboard shell");
      });
  });

  it("does not serve sensitive repository or data paths through the SPA fallback", async () => {
    const app = createStaticApp();

    for (const pathname of [
      "/.env.production",
      "/.codex/comments.json",
      "/apps/api/data/bitrix24-reporting.db",
      "/backups/reporting.sqlite"
    ]) {
      await request(app).get(pathname).expect(404);
    }
  });
});
