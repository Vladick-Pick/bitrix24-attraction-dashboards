import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import {
  createHmac,
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions
} from "node:crypto";

import Database from "better-sqlite3";

const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_OPTIONS = {
  N: 16_384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024
} satisfies ScryptOptions;
const PASSWORD_HASH_ALGORITHM = "scrypt";
const DUMMY_PASSWORD_HASH =
  "scrypt$16384$8$1$W48lUpp31EKHIYSsaWCA-w$jTEEGOL70zJ5n2dI4iJf_UNW3-h6Vf84L7vSSxB3w1bSgS39RnvIJrGHt_GtGOr1rYQGij_tVz0a2wgKUsf_0Q";
const DEFAULT_MODULE_KEY = "attraction";
const DEFAULT_MODULE_LABEL = "Привлечение";
const DEFAULT_MODULE_SCOPE_KEY = "attraction";

const MODULE_PERMISSIONS: Record<ModuleRole, ModulePermission[]> = {
  employee: ["comments:create"],
  leader: ["comments:create", "comments:archive", "module-users:manage"]
};

export interface AuthUser {
  id: number;
  login: string;
  passwordHash: string;
  disabled: boolean;
}

export type ModuleRole = "leader" | "employee";

export type ModulePermission =
  | "comments:create"
  | "comments:archive"
  | "module-users:manage";

export interface ModuleConfig {
  moduleKey: string;
  label: string;
  scopeKey: string;
  paperclipCompanyId: string | null;
  paperclipProjectId: string | null;
  paperclipGoalId: string | null;
  paperclipTriageAgentId: string | null;
}

export interface ModuleMembershipInput {
  moduleKey: string;
  role: ModuleRole;
}

export interface AuthModule {
  key: string;
  label: string;
  role: ModuleRole;
  permissions: ModulePermission[];
}

export interface ModuleUserSummary {
  id: number;
  login: string;
  disabled: boolean;
  moduleRole: ModuleRole;
}

export interface AuthSession {
  tokenHash: string;
  userId: number;
  login: string;
  csrfTokenHash: string;
  expiresAt: string;
  lastSeenAt: string;
  disabled: boolean;
  sessionToken: string;
}

export interface AuthUserInput {
  login: string;
  passwordHash: string;
  disabled?: boolean;
  moduleMemberships?: ModuleMembershipInput[];
  now?: Date;
}

export interface AuthSessionInput {
  tokenHash: string;
  userId: number;
  csrfTokenHash: string;
  expiresAt: string;
  now: Date;
  metadata?: Record<string, unknown>;
}

export interface SqliteAuthStore {
  createUser(input: AuthUserInput): Promise<AuthUser>;
  createModuleUser(input: {
    login: string;
    passwordHash: string;
    moduleKey: string;
    role: ModuleRole;
    disabled?: boolean;
    now?: Date;
  }): Promise<ModuleUserSummary>;
  resetPassword(input: {
    login: string;
    passwordHash: string;
    now?: Date;
  }): Promise<boolean>;
  disableUser(input: {
    login: string;
    disabled: boolean;
    now?: Date;
  }): Promise<boolean>;
  findUserByLogin(login: string): Promise<AuthUser | null>;
  markUserLogin(input: { userId: number; now: Date }): Promise<void>;
  createSession(input: AuthSessionInput): Promise<void>;
  findSessionByTokenHash(input: {
    tokenHash: string;
    sessionToken: string;
  }): Promise<AuthSession | null>;
  getUserModules(userId: number): Promise<AuthModule[]>;
  getModuleConfig(moduleKey: string): Promise<ModuleConfig | null>;
  listModuleUsers(moduleKey: string): Promise<ModuleUserSummary[]>;
  updateModuleUser(input: {
    userId: number;
    moduleKey: string;
    role?: ModuleRole;
    disabled?: boolean;
    now?: Date;
  }): Promise<ModuleUserSummary | null>;
  touchSession(input: { tokenHash: string; now: Date }): Promise<void>;
  deleteSession(tokenHash: string): Promise<void>;
  deleteExpiredSessions(now: Date): Promise<void>;
  close(): void;
}

export interface AuthenticatedUser {
  id: number;
  login: string;
  role: "admin";
  modules: AuthModule[];
}

export interface LoginUser {
  login: string;
  role: "admin";
}

export interface AuthenticatedSession {
  user: AuthenticatedUser;
  sessionToken: string;
  tokenHash: string;
  csrfTokenHash: string;
  expiresAt: string;
}

export interface LoginResult {
  user: LoginUser;
  sessionToken: string;
  csrfToken: string;
  expiresAt: string;
}

export interface PasswordAuthService {
  cookieName: string;
  secureCookie: boolean;
  ttlMs: number;
  login(input: {
    login: string;
    password: string;
    rateLimitKey: string;
    metadata?: Record<string, unknown>;
  }): Promise<LoginResult>;
  getSession(sessionToken: string): Promise<AuthenticatedSession | null>;
  getModuleConfig(moduleKey: string): Promise<ModuleConfig | null>;
  listModuleUsers(moduleKey: string): Promise<ModuleUserSummary[]>;
  createModuleUser(input: {
    login: string;
    password: string;
    moduleKey: string;
    role: ModuleRole;
    disabled?: boolean;
  }): Promise<ModuleUserSummary>;
  updateModuleUser(input: {
    userId: number;
    moduleKey: string;
    role?: ModuleRole;
    disabled?: boolean;
  }): Promise<ModuleUserSummary | null>;
  issueCsrfToken(session: AuthenticatedSession): Promise<string>;
  verifyCsrfToken(session: AuthenticatedSession, csrfToken: string): boolean;
  logout(sessionToken: string): Promise<void>;
}

export class AuthError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number) {
    super(code);
    this.name = "AuthError";
    this.code = code;
    this.status = status;
  }
}

function normalizeLogin(login: string) {
  return login.trim().toLowerCase();
}

function toIso(value: Date) {
  return value.toISOString();
}

function normalizeModuleRole(role: string): ModuleRole {
  return role === "leader" ? "leader" : "employee";
}

function normalizeModuleConfig(input?: Partial<ModuleConfig>): ModuleConfig {
  return {
    moduleKey: input?.moduleKey?.trim() || DEFAULT_MODULE_KEY,
    label: input?.label?.trim() || DEFAULT_MODULE_LABEL,
    scopeKey: input?.scopeKey?.trim() || DEFAULT_MODULE_SCOPE_KEY,
    paperclipCompanyId: input?.paperclipCompanyId?.trim() || null,
    paperclipProjectId: input?.paperclipProjectId?.trim() || null,
    paperclipGoalId: input?.paperclipGoalId?.trim() || null,
    paperclipTriageAgentId: input?.paperclipTriageAgentId?.trim() || null
  };
}

function permissionsForRole(role: ModuleRole): ModulePermission[] {
  return [...MODULE_PERMISSIONS[role]];
}

function parseIso(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function scryptAsync(
  password: string,
  salt: string,
  keyLength: number,
  options: ScryptOptions
) {
  return new Promise<Buffer>((resolvePromise, reject) => {
    scrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolvePromise(derivedKey);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derivedKey = await scryptAsync(
    password,
    salt,
    SCRYPT_KEY_LENGTH,
    SCRYPT_OPTIONS
  );

  return [
    PASSWORD_HASH_ALGORITHM,
    SCRYPT_OPTIONS.N,
    SCRYPT_OPTIONS.r,
    SCRYPT_OPTIONS.p,
    salt,
    derivedKey.toString("base64url")
  ].join("$");
}

export async function verifyPassword(password: string, passwordHash: string) {
  const [algorithm, rawN, rawR, rawP, salt, expected] = passwordHash.split("$");

  if (algorithm !== PASSWORD_HASH_ALGORITHM || !salt || !expected) {
    return false;
  }

  const expectedKey = Buffer.from(expected, "base64url");
  const derivedKey = await scryptAsync(password, salt, expectedKey.length, {
    N: Number(rawN),
    r: Number(rawR),
    p: Number(rawP),
    maxmem: SCRYPT_OPTIONS.maxmem
  });

  return (
    expectedKey.length === derivedKey.length &&
    timingSafeEqual(expectedKey, derivedKey)
  );
}

export function createOpaqueToken() {
  return randomBytes(32).toString("base64url");
}

export function hashOpaqueToken(secret: string, token: string) {
  return createHmac("sha256", secret).update(token).digest("base64url");
}

function createCsrfToken(secret: string, sessionToken: string) {
  return createHmac("sha256", secret)
    .update("csrf:")
    .update(sessionToken)
    .digest("base64url");
}

function timingSafeStringEqual(expectedValue: string, actualValue: string) {
  const expected = Buffer.from(expectedValue);
  const actual = Buffer.from(actualValue);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function resolveDatabasePath(databaseUrl: string) {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error(`Unsupported DATABASE_URL: ${databaseUrl}`);
  }

  const rawPath = databaseUrl.slice("file:".length);
  return isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath);
}

function readAuthUser(row: unknown): AuthUser | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const data = row as {
    id: number;
    login: string;
    password_hash: string;
    disabled: number;
  };

  return {
    id: data.id,
    login: data.login,
    passwordHash: data.password_hash,
    disabled: data.disabled === 1
  };
}

function readAuthSession(row: unknown, sessionToken: string): AuthSession | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const data = row as {
    token_hash: string;
    user_id: number;
    login: string;
    csrf_token_hash: string;
    expires_at: string;
    last_seen_at: string;
    disabled: number;
  };

  return {
    tokenHash: data.token_hash,
    userId: data.user_id,
    login: data.login,
    csrfTokenHash: data.csrf_token_hash,
    expiresAt: data.expires_at,
    lastSeenAt: data.last_seen_at,
    disabled: data.disabled === 1,
    sessionToken
  };
}

function readModuleConfig(row: unknown): ModuleConfig | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const data = row as {
    module_key: string;
    label: string;
    scope_key: string;
    paperclip_company_id: string | null;
    paperclip_project_id: string | null;
    paperclip_goal_id: string | null;
    paperclip_triage_agent_id: string | null;
  };

  return {
    moduleKey: data.module_key,
    label: data.label,
    scopeKey: data.scope_key,
    paperclipCompanyId: data.paperclip_company_id,
    paperclipProjectId: data.paperclip_project_id,
    paperclipGoalId: data.paperclip_goal_id,
    paperclipTriageAgentId: data.paperclip_triage_agent_id
  };
}

function readModuleUser(row: unknown): ModuleUserSummary | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const data = row as {
    id: number;
    login: string;
    disabled: number;
    moduleRole: string;
  };

  return {
    id: data.id,
    login: data.login,
    disabled: data.disabled === 1,
    moduleRole: normalizeModuleRole(data.moduleRole)
  };
}

function readCount(row: unknown): number {
  if (!row || typeof row !== "object") {
    return 0;
  }

  const data = row as { count?: number };
  return typeof data.count === "number" ? data.count : 0;
}

export function createSqliteAuthStore(input: {
  databaseUrl: string;
  defaultModuleConfig?: Partial<ModuleConfig>;
}): SqliteAuthStore {
  const databasePath = resolveDatabasePath(input.databaseUrl);
  const defaultModule = normalizeModuleConfig(input.defaultModuleConfig);
  mkdirSync(dirname(databasePath), { recursive: true });

  const database = new Database(databasePath);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  database.pragma("synchronous = NORMAL");

  database.exec(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      disabled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      disabled_at TEXT,
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      csrf_token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      metadata_json TEXT,
      invalidated_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_expires
      ON auth_sessions (user_id, expires_at);

    CREATE TABLE IF NOT EXISTS modules (
      module_key TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      scope_key TEXT NOT NULL,
      paperclip_company_id TEXT,
      paperclip_project_id TEXT,
      paperclip_goal_id TEXT,
      paperclip_triage_agent_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS module_memberships (
      user_id INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      module_key TEXT NOT NULL REFERENCES modules(module_key) ON DELETE CASCADE,
      role TEXT NOT NULL,
      disabled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      disabled_at TEXT,
      PRIMARY KEY (user_id, module_key)
    );

    CREATE INDEX IF NOT EXISTS idx_module_memberships_module_role
      ON module_memberships (module_key, role, disabled);
  `);

  const countAuthUsersStatement = database.prepare(`
    SELECT COUNT(*) AS count
    FROM auth_users
  `);
  const countModuleMembershipsStatement = database.prepare(`
    SELECT COUNT(*) AS count
    FROM module_memberships
    WHERE module_key = ?
  `);
  const seedModuleStatement = database.prepare(`
    INSERT INTO modules (
      module_key,
      label,
      scope_key,
      paperclip_company_id,
      paperclip_project_id,
      paperclip_goal_id,
      paperclip_triage_agent_id,
      created_at,
      updated_at
    ) VALUES (
      @moduleKey,
      @label,
      @scopeKey,
      @paperclipCompanyId,
      @paperclipProjectId,
      @paperclipGoalId,
      @paperclipTriageAgentId,
      @createdAt,
      @updatedAt
    )
    ON CONFLICT(module_key) DO UPDATE SET
      label = excluded.label,
      scope_key = excluded.scope_key,
      paperclip_company_id = excluded.paperclip_company_id,
      paperclip_project_id = excluded.paperclip_project_id,
      paperclip_goal_id = excluded.paperclip_goal_id,
      paperclip_triage_agent_id = excluded.paperclip_triage_agent_id,
      updated_at = excluded.updated_at
  `);
  const seededAt = toIso(new Date());
  seedModuleStatement.run({
    ...defaultModule,
    createdAt: seededAt,
    updatedAt: seededAt
  });
  const backfillLegacyModuleMembershipsStatement = database.prepare(`
    INSERT INTO module_memberships (
      user_id,
      module_key,
      role,
      disabled,
      created_at,
      updated_at,
      disabled_at
    )
    SELECT
      auth_users.id,
      @moduleKey,
      'leader',
      0,
      @createdAt,
      @updatedAt,
      NULL
    FROM auth_users
    WHERE NOT EXISTS (
      SELECT 1
      FROM module_memberships
      WHERE module_memberships.user_id = auth_users.id
        AND module_memberships.module_key = @moduleKey
    )
  `);
  if (
    readCount(countAuthUsersStatement.get()) > 0 &&
    readCount(countModuleMembershipsStatement.get(defaultModule.moduleKey)) === 0
  ) {
    backfillLegacyModuleMembershipsStatement.run({
      moduleKey: defaultModule.moduleKey,
      createdAt: seededAt,
      updatedAt: seededAt
    });
  }

  const createUserStatement = database.prepare(`
    INSERT INTO auth_users (
      login,
      password_hash,
      disabled,
      created_at,
      updated_at,
      disabled_at
    ) VALUES (
      @login,
      @passwordHash,
      @disabled,
      @createdAt,
      @updatedAt,
      @disabledAt
    )
  `);
  const findUserByLoginStatement = database.prepare(`
    SELECT id, login, password_hash, disabled
    FROM auth_users
    WHERE login = ?
  `);
  const resetPasswordStatement = database.prepare(`
    UPDATE auth_users
    SET password_hash = @passwordHash,
      updated_at = @updatedAt
    WHERE login = @login
  `);
  const disableUserStatement = database.prepare(`
    UPDATE auth_users
    SET disabled = @disabled,
      disabled_at = @disabledAt,
      updated_at = @updatedAt
    WHERE login = @login
  `);
  const markUserLoginStatement = database.prepare(`
    UPDATE auth_users
    SET last_login_at = @lastLoginAt,
      updated_at = @lastLoginAt
    WHERE id = @userId
  `);
  const createSessionStatement = database.prepare(`
    INSERT INTO auth_sessions (
      token_hash,
      user_id,
      csrf_token_hash,
      expires_at,
      last_seen_at,
      created_at,
      metadata_json
    ) VALUES (
      @tokenHash,
      @userId,
      @csrfTokenHash,
      @expiresAt,
      @lastSeenAt,
      @createdAt,
      @metadataJson
    )
  `);
  const findSessionStatement = database.prepare(`
    SELECT
      auth_sessions.token_hash,
      auth_sessions.user_id,
      auth_users.login,
      auth_sessions.csrf_token_hash,
      auth_sessions.expires_at,
      auth_sessions.last_seen_at,
      auth_users.disabled
    FROM auth_sessions
    INNER JOIN auth_users ON auth_users.id = auth_sessions.user_id
    WHERE auth_sessions.token_hash = ?
      AND auth_sessions.invalidated_at IS NULL
  `);
  const touchSessionStatement = database.prepare(`
    UPDATE auth_sessions
    SET last_seen_at = @lastSeenAt
    WHERE token_hash = @tokenHash
  `);
  const deleteSessionStatement = database.prepare(`
    UPDATE auth_sessions
    SET invalidated_at = @invalidatedAt
    WHERE token_hash = @tokenHash
  `);
  const deleteExpiredSessionsStatement = database.prepare(`
    UPDATE auth_sessions
    SET invalidated_at = @invalidatedAt
    WHERE expires_at <= @now
      AND invalidated_at IS NULL
  `);
  const upsertModuleMembershipStatement = database.prepare(`
    INSERT INTO module_memberships (
      user_id,
      module_key,
      role,
      disabled,
      created_at,
      updated_at,
      disabled_at
    ) VALUES (
      @userId,
      @moduleKey,
      @role,
      @disabled,
      @createdAt,
      @updatedAt,
      @disabledAt
    )
    ON CONFLICT(user_id, module_key) DO UPDATE SET
      role = excluded.role,
      disabled = excluded.disabled,
      updated_at = excluded.updated_at,
      disabled_at = excluded.disabled_at
  `);
  const getUserModulesStatement = database.prepare(`
    SELECT
      modules.module_key AS moduleKey,
      modules.label,
      module_memberships.role
    FROM module_memberships
    INNER JOIN modules ON modules.module_key = module_memberships.module_key
    WHERE module_memberships.user_id = ?
      AND module_memberships.disabled = 0
    ORDER BY modules.module_key ASC
  `);
  const getModuleConfigStatement = database.prepare(`
    SELECT
      module_key,
      label,
      scope_key,
      paperclip_company_id,
      paperclip_project_id,
      paperclip_goal_id,
      paperclip_triage_agent_id
    FROM modules
    WHERE module_key = ?
  `);
  const listModuleUsersStatement = database.prepare(`
    SELECT
      auth_users.id,
      auth_users.login,
      CASE
        WHEN auth_users.disabled = 1 OR module_memberships.disabled = 1 THEN 1
        ELSE 0
      END AS disabled,
      module_memberships.role AS moduleRole
    FROM module_memberships
    INNER JOIN auth_users ON auth_users.id = module_memberships.user_id
    WHERE module_memberships.module_key = ?
    ORDER BY auth_users.login COLLATE NOCASE ASC
  `);
  const findModuleUserStatement = database.prepare(`
    SELECT
      auth_users.id,
      auth_users.login,
      CASE
        WHEN auth_users.disabled = 1 OR module_memberships.disabled = 1 THEN 1
        ELSE 0
      END AS disabled,
      module_memberships.role AS moduleRole
    FROM module_memberships
    INNER JOIN auth_users ON auth_users.id = module_memberships.user_id
    WHERE module_memberships.module_key = ?
      AND auth_users.id = ?
  `);
  const updateModuleMembershipDisabledStatement = database.prepare(`
    UPDATE module_memberships
    SET disabled = @disabled,
      disabled_at = @disabledAt,
      updated_at = @updatedAt
    WHERE user_id = @userId
      AND module_key = @moduleKey
  `);
  const updateModuleMembershipRoleStatement = database.prepare(`
    UPDATE module_memberships
    SET role = @role,
      disabled = 0,
      disabled_at = NULL,
      updated_at = @updatedAt
    WHERE user_id = @userId
      AND module_key = @moduleKey
  `);
  const createUserTransaction = database.transaction((inputUser: AuthUserInput) => {
    const hasExistingUsers = readCount(countAuthUsersStatement.get()) > 0;
    const now = inputUser.now ?? new Date();
    const nowIso = toIso(now);
    const login = normalizeLogin(inputUser.login);
    createUserStatement.run({
      login,
      passwordHash: inputUser.passwordHash,
      disabled: inputUser.disabled ? 1 : 0,
      createdAt: nowIso,
      updatedAt: nowIso,
      disabledAt: inputUser.disabled ? nowIso : null
    });

    const user = readAuthUser(findUserByLoginStatement.get(login));
    if (!user) {
      throw new Error("Failed to create auth user.");
    }

    const memberships =
      inputUser.moduleMemberships ??
      (hasExistingUsers
        ? []
        : [{ moduleKey: defaultModule.moduleKey, role: "leader" as const }]);
    for (const membership of memberships) {
      upsertModuleMembershipStatement.run({
        userId: user.id,
        moduleKey: membership.moduleKey,
        role: membership.role,
        disabled: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
        disabledAt: null
      });
    }

    return user;
  });
  const createModuleUserTransaction = database.transaction(
    (inputUser: {
      login: string;
      passwordHash: string;
      moduleKey: string;
      role: ModuleRole;
      disabled?: boolean;
      now?: Date;
    }) => {
      const now = inputUser.now ?? new Date();
      const user = createUserTransaction({
        login: inputUser.login,
        passwordHash: inputUser.passwordHash,
        moduleMemberships: [{ moduleKey: inputUser.moduleKey, role: inputUser.role }],
        now,
        ...(inputUser.disabled !== undefined ? { disabled: inputUser.disabled } : {})
      });
      const moduleUser = readModuleUser(
        findModuleUserStatement.get(inputUser.moduleKey, user.id)
      );
      if (!moduleUser) {
        throw new Error("Failed to create module user.");
      }
      return moduleUser;
    }
  );
  const updateModuleUserTransaction = database.transaction(
    (inputUser: {
      userId: number;
      moduleKey: string;
      role?: ModuleRole;
      disabled?: boolean;
      now?: Date;
    }) => {
      const nowIso = toIso(inputUser.now ?? new Date());
      const existingModuleUser = readModuleUser(
        findModuleUserStatement.get(inputUser.moduleKey, inputUser.userId)
      );
      if (!existingModuleUser) {
        return null;
      }

      if (inputUser.disabled !== undefined) {
        updateModuleMembershipDisabledStatement.run({
          userId: inputUser.userId,
          moduleKey: inputUser.moduleKey,
          disabled: inputUser.disabled ? 1 : 0,
          disabledAt: inputUser.disabled ? nowIso : null,
          updatedAt: nowIso
        });
      }

      if (inputUser.role) {
        updateModuleMembershipRoleStatement.run({
          userId: inputUser.userId,
          moduleKey: inputUser.moduleKey,
          role: inputUser.role,
          updatedAt: nowIso
        });
      }

      return readModuleUser(
        findModuleUserStatement.get(inputUser.moduleKey, inputUser.userId)
      );
    }
  );

  return {
    async createUser(inputUser) {
      return createUserTransaction(inputUser);
    },
    async createModuleUser(inputUser) {
      return createModuleUserTransaction(inputUser);
    },
    async resetPassword(inputPassword) {
      const result = resetPasswordStatement.run({
        login: normalizeLogin(inputPassword.login),
        passwordHash: inputPassword.passwordHash,
        updatedAt: toIso(inputPassword.now ?? new Date())
      });

      return result.changes > 0;
    },
    async disableUser(inputUser) {
      const nowIso = toIso(inputUser.now ?? new Date());
      const result = disableUserStatement.run({
        login: normalizeLogin(inputUser.login),
        disabled: inputUser.disabled ? 1 : 0,
        disabledAt: inputUser.disabled ? nowIso : null,
        updatedAt: nowIso
      });

      return result.changes > 0;
    },
    async findUserByLogin(login) {
      return readAuthUser(findUserByLoginStatement.get(normalizeLogin(login)));
    },
    async markUserLogin(inputLogin) {
      markUserLoginStatement.run({
        userId: inputLogin.userId,
        lastLoginAt: toIso(inputLogin.now)
      });
    },
    async createSession(inputSession) {
      createSessionStatement.run({
        tokenHash: inputSession.tokenHash,
        userId: inputSession.userId,
        csrfTokenHash: inputSession.csrfTokenHash,
        expiresAt: inputSession.expiresAt,
        lastSeenAt: toIso(inputSession.now),
        createdAt: toIso(inputSession.now),
        metadataJson: inputSession.metadata
          ? JSON.stringify(inputSession.metadata)
          : null
      });
    },
    async findSessionByTokenHash(inputSession) {
      return readAuthSession(
        findSessionStatement.get(inputSession.tokenHash),
        inputSession.sessionToken
      );
    },
    async getUserModules(userId) {
      const rows = getUserModulesStatement.all(userId) as Array<{
        moduleKey: string;
        label: string;
        role: string;
      }>;

      return rows.map((row) => {
        const role = normalizeModuleRole(row.role);
        return {
          key: row.moduleKey,
          label: row.label,
          role,
          permissions: permissionsForRole(role)
        };
      });
    },
    async getModuleConfig(moduleKey) {
      return readModuleConfig(getModuleConfigStatement.get(moduleKey));
    },
    async listModuleUsers(moduleKey) {
      return listModuleUsersStatement
        .all(moduleKey)
        .map((row) => readModuleUser(row))
        .filter((row): row is ModuleUserSummary => row !== null);
    },
    async updateModuleUser(inputUser) {
      return updateModuleUserTransaction(inputUser);
    },
    async touchSession(inputSession) {
      touchSessionStatement.run({
        tokenHash: inputSession.tokenHash,
        lastSeenAt: toIso(inputSession.now)
      });
    },
    async deleteSession(tokenHash) {
      deleteSessionStatement.run({
        tokenHash,
        invalidatedAt: toIso(new Date())
      });
    },
    async deleteExpiredSessions(now) {
      const nowIso = toIso(now);
      deleteExpiredSessionsStatement.run({
        now: nowIso,
        invalidatedAt: nowIso
      });
    },
    close() {
      database.close();
    }
  };
}

interface RateLimitBucket {
  failures: number;
  resetAt: number;
}

export function createPasswordAuthService(input: {
  store: SqliteAuthStore;
  sessionSecret: string;
  cookieName?: string;
  ttlHours?: number;
  secureCookie?: boolean;
  rateLimit?: {
    maxFailures: number;
    windowMs: number;
  };
  now?: () => Date;
}): PasswordAuthService {
  const cookieName = input.cookieName ?? "b24dash_session";
  const ttlMs = (input.ttlHours ?? 12) * 60 * 60 * 1000;
  const secureCookie = input.secureCookie ?? true;
  const rateLimit = input.rateLimit ?? {
    maxFailures: 5,
    windowMs: 15 * 60 * 1000
  };
  const buckets = new Map<string, RateLimitBucket>();
  const now = input.now ?? (() => new Date());

  function readBucket(rateLimitKey: string, nowMs: number) {
    const bucket = buckets.get(rateLimitKey);

    if (!bucket || bucket.resetAt <= nowMs) {
      return {
        failures: 0,
        resetAt: nowMs + rateLimit.windowMs
      };
    }

    return bucket;
  }

  function recordFailure(rateLimitKey: string, nowMs: number) {
    const bucket = readBucket(rateLimitKey, nowMs);
    bucket.failures += 1;
    buckets.set(rateLimitKey, bucket);
  }

  function assertNotRateLimited(rateLimitKey: string, nowMs: number) {
    const bucket = readBucket(rateLimitKey, nowMs);
    if (bucket.failures >= rateLimit.maxFailures) {
      buckets.set(rateLimitKey, bucket);
      throw new AuthError("LOGIN_RATE_LIMITED", 429);
    }
  }

  async function buildAuthenticatedUser(inputUser: {
    id: number;
    login: string;
  }): Promise<AuthenticatedUser> {
    return {
      id: inputUser.id,
      login: inputUser.login,
      role: "admin",
      modules: await input.store.getUserModules(inputUser.id)
    };
  }

  return {
    cookieName,
    secureCookie,
    ttlMs,
    async login(credentials) {
      const current = now();
      const currentMs = current.getTime();
      const login = normalizeLogin(credentials.login);
      const rateLimitKey = `${credentials.rateLimitKey}:${login}`;
      assertNotRateLimited(rateLimitKey, currentMs);

      const user = await input.store.findUserByLogin(login);
      const validPassword = await verifyPassword(
        credentials.password,
        user && !user.disabled ? user.passwordHash : DUMMY_PASSWORD_HASH
      );

      if (!user || user.disabled || !validPassword) {
        recordFailure(rateLimitKey, currentMs);
        throw new AuthError("INVALID_CREDENTIALS", 401);
      }

      buckets.delete(rateLimitKey);
      const sessionToken = createOpaqueToken();
      const csrfToken = createCsrfToken(input.sessionSecret, sessionToken);
      const expiresAt = toIso(new Date(current.getTime() + ttlMs));
      await input.store.deleteExpiredSessions(current);
      await input.store.createSession({
        tokenHash: hashOpaqueToken(input.sessionSecret, sessionToken),
        userId: user.id,
        csrfTokenHash: hashOpaqueToken(input.sessionSecret, csrfToken),
        expiresAt,
        now: current,
        ...(credentials.metadata ? { metadata: credentials.metadata } : {})
      });
      await input.store.markUserLogin({
        userId: user.id,
        now: current
      });

      return {
        user: {
          login: user.login,
          role: "admin"
        },
        sessionToken,
        csrfToken,
        expiresAt
      };
    },
    async getSession(sessionToken) {
      const tokenHash = hashOpaqueToken(input.sessionSecret, sessionToken);
      const session = await input.store.findSessionByTokenHash({
        tokenHash,
        sessionToken
      });
      const current = now();

      if (
        !session ||
        session.disabled ||
        parseIso(session.expiresAt) <= current.getTime()
      ) {
        if (session) {
          await input.store.deleteSession(tokenHash);
        }
        return null;
      }

      await input.store.touchSession({
        tokenHash,
        now: current
      });

      return {
        user: await buildAuthenticatedUser({
          id: session.userId,
          login: session.login
        }),
        sessionToken,
        tokenHash,
        csrfTokenHash: session.csrfTokenHash,
        expiresAt: session.expiresAt
      };
    },
    async getModuleConfig(moduleKey) {
      return input.store.getModuleConfig(moduleKey);
    },
    async listModuleUsers(moduleKey) {
      return input.store.listModuleUsers(moduleKey);
    },
    async createModuleUser(inputUser) {
      return input.store.createModuleUser({
        login: inputUser.login,
        passwordHash: await hashPassword(inputUser.password),
        moduleKey: inputUser.moduleKey,
        role: inputUser.role,
        ...(inputUser.disabled !== undefined ? { disabled: inputUser.disabled } : {})
      });
    },
    async updateModuleUser(inputUser) {
      return input.store.updateModuleUser(inputUser);
    },
    async issueCsrfToken(session) {
      return createCsrfToken(input.sessionSecret, session.sessionToken);
    },
    verifyCsrfToken(session, csrfToken) {
      if (
        timingSafeStringEqual(
          createCsrfToken(input.sessionSecret, session.sessionToken),
          csrfToken
        )
      ) {
        return true;
      }

      return timingSafeStringEqual(
        session.csrfTokenHash,
        hashOpaqueToken(input.sessionSecret, csrfToken)
      );
    },
    async logout(sessionToken) {
      await input.store.deleteSession(
        hashOpaqueToken(input.sessionSecret, sessionToken)
      );
    }
  };
}
