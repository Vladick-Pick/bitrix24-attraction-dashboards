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

export interface AuthUser {
  id: number;
  login: string;
  passwordHash: string;
  disabled: boolean;
}

export type ModuleRole = "leader" | "employee";
export type ModuleMembershipStatus = "active" | "disabled";
export type ModulePermission =
  | "comments:create"
  | "comments:update"
  | "comments:archive"
  | "module-users:manage";

export interface ModuleSeedInput {
  id: string;
  slug: string;
  name: string;
  bitrixCategoryId: string;
  paperclipCompanyId?: string | null;
  paperclipProjectId?: string | null;
  paperclipGoalId?: string | null;
  paperclipTriageAgentId?: string | null;
}

export interface AuthenticatedModule {
  id: string;
  slug: string;
  name: string;
  role: ModuleRole;
  permissions: ModulePermission[];
  bitrixCategoryId: string;
  paperclipCompanyId: string | null;
  paperclipProjectId: string | null;
  paperclipGoalId: string | null;
  paperclipTriageAgentId: string | null;
}

export interface ModuleUser {
  id: number;
  login: string;
  disabled: boolean;
  moduleId: string;
  moduleSlug: string;
  moduleRole: ModuleRole;
  membershipStatus: ModuleMembershipStatus;
  createdAt: string;
  updatedAt: string;
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
  touchSession(input: { tokenHash: string; now: Date }): Promise<void>;
  deleteSession(tokenHash: string): Promise<void>;
  deleteExpiredSessions(now: Date): Promise<void>;
  ensureModule(input: ModuleSeedInput): Promise<void>;
  ensureDefaultModuleLeader(moduleId: string): Promise<void>;
  listUserModules(userId: number): Promise<AuthenticatedModule[]>;
  setModuleMembership(input: {
    userId: number;
    moduleId: string;
    role: ModuleRole;
    status: ModuleMembershipStatus;
    now?: Date;
  }): Promise<void>;
  listModuleUsers(moduleId: string): Promise<ModuleUser[]>;
  updateModuleUser(input: {
    userId: number;
    moduleId: string;
    role?: ModuleRole;
    disabled?: boolean;
    membershipStatus?: ModuleMembershipStatus;
    now?: Date;
  }): Promise<ModuleUser | null>;
  close(): void;
}

export interface AuthenticatedUser {
  id: number;
  login: string;
  role: "admin";
  modules: AuthenticatedModule[];
}

export interface AuthenticatedSession {
  user: AuthenticatedUser;
  sessionToken: string;
  tokenHash: string;
  csrfTokenHash: string;
  expiresAt: string;
}

export interface LoginResult {
  user: AuthenticatedUser;
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

function normalizeModuleRole(value: string | null | undefined): ModuleRole {
  return value === "leader" ? "leader" : "employee";
}

function normalizeModuleMembershipStatus(
  value: string | null | undefined
): ModuleMembershipStatus {
  return value === "disabled" ? "disabled" : "active";
}

export function permissionsForModuleRole(role: ModuleRole): ModulePermission[] {
  if (role === "leader") {
    return [
      "comments:create",
      "comments:update",
      "comments:archive",
      "module-users:manage"
    ];
  }

  return ["comments:create", "comments:update"];
}

function readAuthenticatedModule(row: unknown): AuthenticatedModule | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const data = row as {
    id: string;
    slug: string;
    name: string;
    role: string;
    bitrixCategoryId: string;
    paperclipCompanyId: string | null;
    paperclipProjectId: string | null;
    paperclipGoalId: string | null;
    paperclipTriageAgentId: string | null;
  };
  const role = normalizeModuleRole(data.role);

  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    role,
    permissions: permissionsForModuleRole(role),
    bitrixCategoryId: data.bitrixCategoryId,
    paperclipCompanyId: data.paperclipCompanyId ?? null,
    paperclipProjectId: data.paperclipProjectId ?? null,
    paperclipGoalId: data.paperclipGoalId ?? null,
    paperclipTriageAgentId: data.paperclipTriageAgentId ?? null
  };
}

function readModuleUser(row: unknown): ModuleUser | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const data = row as {
    id: number;
    login: string;
    disabled: number;
    moduleId: string;
    moduleSlug: string;
    role: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  };

  return {
    id: data.id,
    login: data.login,
    disabled: data.disabled === 1,
    moduleId: data.moduleId,
    moduleSlug: data.moduleSlug,
    moduleRole: normalizeModuleRole(data.role),
    membershipStatus: normalizeModuleMembershipStatus(data.status),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt
  };
}

export function createSqliteAuthStore(input: {
  databaseUrl: string;
}): SqliteAuthStore {
  const databasePath = resolveDatabasePath(input.databaseUrl);
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
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      bitrix_category_id TEXT NOT NULL,
      paperclip_company_id TEXT,
      paperclip_project_id TEXT,
      paperclip_goal_id TEXT,
      paperclip_triage_agent_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS module_memberships (
      user_id INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, module_id)
    );

    CREATE INDEX IF NOT EXISTS idx_module_memberships_module_status
      ON module_memberships (module_id, status);
    CREATE INDEX IF NOT EXISTS idx_module_memberships_user_status
      ON module_memberships (user_id, status);
  `);

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
  const ensureModuleStatement = database.prepare(`
    INSERT INTO modules (
      id,
      slug,
      name,
      bitrix_category_id,
      paperclip_company_id,
      paperclip_project_id,
      paperclip_goal_id,
      paperclip_triage_agent_id,
      created_at,
      updated_at
    ) VALUES (
      @id,
      @slug,
      @name,
      @bitrixCategoryId,
      @paperclipCompanyId,
      @paperclipProjectId,
      @paperclipGoalId,
      @paperclipTriageAgentId,
      @createdAt,
      @updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      slug = excluded.slug,
      name = excluded.name,
      bitrix_category_id = excluded.bitrix_category_id,
      paperclip_company_id = excluded.paperclip_company_id,
      paperclip_project_id = excluded.paperclip_project_id,
      paperclip_goal_id = excluded.paperclip_goal_id,
      paperclip_triage_agent_id = excluded.paperclip_triage_agent_id,
      updated_at = excluded.updated_at
  `);
  const listUserModulesStatement = database.prepare(`
    SELECT
      modules.id,
      modules.slug,
      modules.name,
      module_memberships.role,
      modules.bitrix_category_id AS bitrixCategoryId,
      modules.paperclip_company_id AS paperclipCompanyId,
      modules.paperclip_project_id AS paperclipProjectId,
      modules.paperclip_goal_id AS paperclipGoalId,
      modules.paperclip_triage_agent_id AS paperclipTriageAgentId
    FROM module_memberships
    INNER JOIN modules ON modules.id = module_memberships.module_id
    WHERE module_memberships.user_id = ?
      AND module_memberships.status = 'active'
    ORDER BY modules.slug ASC
  `);
  const setModuleMembershipStatement = database.prepare(`
    INSERT INTO module_memberships (
      user_id,
      module_id,
      role,
      status,
      created_at,
      updated_at
    ) VALUES (
      @userId,
      @moduleId,
      @role,
      @status,
      @createdAt,
      @updatedAt
    )
    ON CONFLICT(user_id, module_id) DO UPDATE SET
      role = excluded.role,
      status = excluded.status,
      updated_at = excluded.updated_at
  `);
  const listModuleUsersStatement = database.prepare(`
    SELECT
      auth_users.id,
      auth_users.login,
      auth_users.disabled,
      modules.id AS moduleId,
      modules.slug AS moduleSlug,
      module_memberships.role,
      module_memberships.status,
      module_memberships.created_at AS createdAt,
      module_memberships.updated_at AS updatedAt
    FROM module_memberships
    INNER JOIN auth_users ON auth_users.id = module_memberships.user_id
    INNER JOIN modules ON modules.id = module_memberships.module_id
    WHERE module_memberships.module_id = ?
    ORDER BY auth_users.login ASC
  `);
  const updateAuthUserByIdStatement = database.prepare(`
    UPDATE auth_users
    SET disabled = @disabled,
      disabled_at = @disabledAt,
      updated_at = @updatedAt
    WHERE id = @userId
  `);
  const updateModuleMembershipStatement = database.prepare(`
    UPDATE module_memberships
    SET role = COALESCE(@role, role),
      status = COALESCE(@status, status),
      updated_at = @updatedAt
    WHERE user_id = @userId
      AND module_id = @moduleId
  `);
  const getModuleUserStatement = database.prepare(`
    SELECT
      auth_users.id,
      auth_users.login,
      auth_users.disabled,
      modules.id AS moduleId,
      modules.slug AS moduleSlug,
      module_memberships.role,
      module_memberships.status,
      module_memberships.created_at AS createdAt,
      module_memberships.updated_at AS updatedAt
    FROM module_memberships
    INNER JOIN auth_users ON auth_users.id = module_memberships.user_id
    INNER JOIN modules ON modules.id = module_memberships.module_id
    WHERE module_memberships.user_id = ?
      AND module_memberships.module_id = ?
  `);
  const activeModuleMembershipCountStatement = database.prepare(`
    SELECT COUNT(*) AS count
    FROM module_memberships
    WHERE module_id = ?
      AND status = 'active'
  `);
  const firstActiveUserStatement = database.prepare(`
    SELECT id, login, password_hash, disabled
    FROM auth_users
    WHERE disabled = 0
    ORDER BY id ASC
    LIMIT 1
  `);

  return {
    async createUser(inputUser) {
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

      return user;
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
    async ensureModule(inputModule) {
      const nowIso = toIso(new Date());
      ensureModuleStatement.run({
        id: inputModule.id,
        slug: inputModule.slug,
        name: inputModule.name,
        bitrixCategoryId: inputModule.bitrixCategoryId,
        paperclipCompanyId: inputModule.paperclipCompanyId ?? null,
        paperclipProjectId: inputModule.paperclipProjectId ?? null,
        paperclipGoalId: inputModule.paperclipGoalId ?? null,
        paperclipTriageAgentId: inputModule.paperclipTriageAgentId ?? null,
        createdAt: nowIso,
        updatedAt: nowIso
      });
    },
    async ensureDefaultModuleLeader(moduleId) {
      const count = (
        activeModuleMembershipCountStatement.get(moduleId) as { count: number }
      ).count;
      if (count > 0) {
        return;
      }

      const user = readAuthUser(firstActiveUserStatement.get());
      if (!user) {
        return;
      }

      const nowIso = toIso(new Date());
      setModuleMembershipStatement.run({
        userId: user.id,
        moduleId,
        role: "leader",
        status: "active",
        createdAt: nowIso,
        updatedAt: nowIso
      });
    },
    async listUserModules(userId) {
      return listUserModulesStatement
        .all(userId)
        .map(readAuthenticatedModule)
        .filter((module): module is AuthenticatedModule => Boolean(module));
    },
    async setModuleMembership(inputMembership) {
      const nowIso = toIso(inputMembership.now ?? new Date());
      setModuleMembershipStatement.run({
        userId: inputMembership.userId,
        moduleId: inputMembership.moduleId,
        role: inputMembership.role,
        status: inputMembership.status,
        createdAt: nowIso,
        updatedAt: nowIso
      });
    },
    async listModuleUsers(moduleId) {
      return listModuleUsersStatement
        .all(moduleId)
        .map(readModuleUser)
        .filter((user): user is ModuleUser => Boolean(user));
    },
    async updateModuleUser(inputUser) {
      const nowIso = toIso(inputUser.now ?? new Date());
      if (inputUser.disabled !== undefined) {
        updateAuthUserByIdStatement.run({
          userId: inputUser.userId,
          disabled: inputUser.disabled ? 1 : 0,
          disabledAt: inputUser.disabled ? nowIso : null,
          updatedAt: nowIso
        });
      }

      if (inputUser.role !== undefined || inputUser.membershipStatus !== undefined) {
        updateModuleMembershipStatement.run({
          userId: inputUser.userId,
          moduleId: inputUser.moduleId,
          role: inputUser.role ?? null,
          status: inputUser.membershipStatus ?? null,
          updatedAt: nowIso
        });
      }

      return readModuleUser(
        getModuleUserStatement.get(inputUser.userId, inputUser.moduleId)
      );
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
          id: user.id,
          login: user.login,
          role: "admin",
          modules: await input.store.listUserModules(user.id)
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
        user: {
          id: session.userId,
          login: session.login,
          role: "admin",
          modules: await input.store.listUserModules(session.userId)
        },
        sessionToken,
        tokenHash,
        csrfTokenHash: session.csrfTokenHash,
        expiresAt: session.expiresAt
      };
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
