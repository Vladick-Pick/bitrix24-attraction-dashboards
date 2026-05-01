import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createSqliteAuthStore, verifyPassword } from "../src/server/auth";
import { executeAuthUserCommand, runAuthUsersCli } from "../src/tools/auth-users";

describe("auth user CLI commands", () => {
  const directories: string[] = [];

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    for (const directory of directories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  function createDatabaseUrl() {
    const directory = mkdtempSync(join(tmpdir(), "bitrix24-auth-cli-"));
    directories.push(directory);
    return `file:${join(directory, "reporting.sqlite")}`;
  }

  it("creates a user, resets the password and disables the user", async () => {
    const databaseUrl = createDatabaseUrl();
    const store = createSqliteAuthStore({ databaseUrl });

    await executeAuthUserCommand({
      databaseUrl,
      command: "create",
      login: "Admin",
      password: "first-password"
    });

    const created = await store.findUserByLogin("admin");
    expect(created?.login).toBe("admin");
    expect(created?.disabled).toBe(false);
    expect(
      created ? await verifyPassword("first-password", created.passwordHash) : false
    ).toBe(true);

    await executeAuthUserCommand({
      databaseUrl,
      command: "reset-password",
      login: "admin",
      password: "second-password"
    });

    const reset = await store.findUserByLogin("admin");
    expect(
      reset ? await verifyPassword("first-password", reset.passwordHash) : true
    ).toBe(false);
    expect(
      reset ? await verifyPassword("second-password", reset.passwordHash) : false
    ).toBe(true);

    await executeAuthUserCommand({
      databaseUrl,
      command: "disable",
      login: "admin"
    });

    const disabled = await store.findUserByLogin("admin");
    expect(disabled?.disabled).toBe(true);

    store.close();
  });

  it("rejects passwords passed as process arguments", async () => {
    const databaseUrl = createDatabaseUrl();
    vi.stubEnv("DATABASE_URL", databaseUrl);
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    await expect(
      runAuthUsersCli(["create", "admin", "--password", "secret"])
    ).rejects.toThrow(/password-stdin|unknown argument/i);
  });
});
