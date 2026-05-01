import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { readEnv } from "../config/env.js";
import { createSqliteAuthStore, hashPassword } from "../server/auth.js";

export type AuthUserCommand = "create" | "reset-password" | "disable";

export interface ExecuteAuthUserCommandInput {
  databaseUrl: string;
  command: AuthUserCommand;
  login: string;
  password?: string;
}

function requirePassword(input: ExecuteAuthUserCommandInput) {
  if (!input.password) {
    throw new Error(`${input.command} requires a password.`);
  }

  return input.password;
}

export async function executeAuthUserCommand(input: ExecuteAuthUserCommandInput) {
  const store = createSqliteAuthStore({
    databaseUrl: input.databaseUrl
  });

  try {
    if (input.command === "create") {
      await store.createUser({
        login: input.login,
        passwordHash: await hashPassword(requirePassword(input))
      });
      return;
    }

    if (input.command === "reset-password") {
      const changed = await store.resetPassword({
        login: input.login,
        passwordHash: await hashPassword(requirePassword(input))
      });

      if (!changed) {
        throw new Error(`Auth user not found: ${input.login}`);
      }
      return;
    }

    const changed = await store.disableUser({
      login: input.login,
      disabled: true
    });

    if (!changed) {
      throw new Error(`Auth user not found: ${input.login}`);
    }
  } finally {
    store.close();
  }
}

function readPasswordFromStdin() {
  return readFileSync(0, "utf8").replace(/\r?\n$/, "");
}

function parseCliArgs(argv: string[]): {
  command: AuthUserCommand;
  login: string;
  password?: string;
} {
  const [command, login, ...flags] = argv;

  if (
    command !== "create" &&
    command !== "reset-password" &&
    command !== "disable"
  ) {
    throw new Error(
      "Usage: auth:users <create|reset-password|disable> <login> [--password-stdin]"
    );
  }

  if (!login) {
    throw new Error("Login is required.");
  }

  let password: string | undefined;
  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index];
    if (flag === "--password-stdin") {
      password = readPasswordFromStdin();
    } else {
      throw new Error(`Unknown argument: ${flag}`);
    }
  }

  return {
    command,
    login,
    ...(password !== undefined ? { password } : {})
  };
}

export async function runAuthUsersCli(argv = process.argv.slice(2)) {
  const env = readEnv();
  const input = parseCliArgs(argv);
  await executeAuthUserCommand({
    databaseUrl: env.DATABASE_URL,
    ...input
  });
  console.log(`Auth user ${input.command} completed for ${input.login}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAuthUsersCli().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
