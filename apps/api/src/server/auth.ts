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
const FAILED_LOGIN_MIN_DURATION_MS = 200;

export interface AuthUser {
  id: number;
  login: string;
  firstName: string | null;
  lastName: string | null;
  passwordHash: string;
  disabled: boolean;
  isSuperAdmin: boolean;
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

export interface ModuleDefinition {
  id: string;
  slug: string;
  name: string;
  bitrixCategoryId: string;
  paperclipCompanyId: string | null;
  paperclipProjectId: string | null;
  paperclipGoalId: string | null;
  paperclipTriageAgentId: string | null;
}

export interface ModuleUser {
  id: number;
  login: string;
  firstName: string | null;
  lastName: string | null;
  disabled: boolean;
  moduleId: string;
  moduleSlug: string;
  moduleRole: ModuleRole;
  membershipStatus: ModuleMembershipStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformUser {
  id: number;
  login: string;
  firstName: string | null;
  lastName: string | null;
  disabled: boolean;
  isSuperAdmin: boolean;
  memberships: ModuleUser[];
}

export interface AuthSession {
  tokenHash: string;
  userId: number;
  login: string;
  firstName: string | null;
  lastName: string | null;
  csrfTokenHash: string;
  expiresAt: string;
  lastSeenAt: string;
  disabled: boolean;
  isSuperAdmin: boolean;
  sessionToken: string;
}

export interface AuthUserInput {
  login: string;
  firstName?: string | null;
  lastName?: string | null;
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
  updateUserProfile(input: {
    userId: number;
    firstName?: string | null;
    lastName?: string | null;
    now?: Date;
  }): Promise<AuthUser | null>;
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
  ensureDefaultSuperAdmin(): Promise<void>;
  listModules(): Promise<ModuleDefinition[]>;
  listUserModules(userId: number): Promise<AuthenticatedModule[]>;
  listPlatformUsers(): Promise<PlatformUser[]>;
  replaceUserModuleMemberships(input: {
    userId: number;
    memberships: Array<{
      moduleId: string;
      role: ModuleRole;
      status: ModuleMembershipStatus;
    }>;
    now?: Date;
  }): Promise<PlatformUser | null>;
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
    firstName?: string | null;
    lastName?: string | null;
    passwordHash?: string;
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
  firstName: string | null;
  lastName: string | null;
  role: "admin";
  isSuperAdmin: boolean;
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

function sleep(ms: number) {
  return new Promise<void>((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function waitForFailedLoginFloor(startedAtMs: number) {
  const remainingMs = FAILED_LOGIN_MIN_DURATION_MS - (Date.now() - startedAtMs);
  if (remainingMs > 0) {
    await sleep(remainingMs);
  }
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
    first_name: string | null;
    last_name: string | null;
    password_hash: string;
    disabled: number;
    is_super_admin?: number;
  };

  return {
    id: data.id,
    login: data.login,
    firstName: data.first_name ?? null,
    lastName: data.last_name ?? null,
    passwordHash: data.password_hash,
    disabled: data.disabled === 1,
    isSuperAdmin: data.is_super_admin === 1
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
    first_name: string | null;
    last_name: string | null;
    csrf_token_hash: string;
    expires_at: string;
    last_seen_at: string;
    disabled: number;
    is_super_admin?: number;
  };

  return {
    tokenHash: data.token_hash,
    userId: data.user_id,
    login: data.login,
    firstName: data.first_name ?? null,
    lastName: data.last_name ?? null,
    csrfTokenHash: data.csrf_token_hash,
    expiresAt: data.expires_at,
    lastSeenAt: data.last_seen_at,
    disabled: data.disabled === 1,
    isSuperAdmin: data.is_super_admin === 1,
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

function readModuleDefinition(row: unknown): ModuleDefinition | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const data = row as {
    id: string;
    slug: string;
    name: string;
    bitrixCategoryId: string;
    paperclipCompanyId: string | null;
    paperclipProjectId: string | null;
    paperclipGoalId: string | null;
    paperclipTriageAgentId: string | null;
  };

  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
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
    firstName: string | null;
    lastName: string | null;
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
    firstName: data.firstName ?? null,
    lastName: data.lastName ?? null,
    disabled: data.disabled === 1,
    moduleId: data.moduleId,
    moduleSlug: data.moduleSlug,
    moduleRole: normalizeModuleRole(data.role),
    membershipStatus: normalizeModuleMembershipStatus(data.status),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt
  };
}

function readPlatformUser(row: unknown): Omit<PlatformUser, "memberships"> | null {
  const user = readAuthUser(row);
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    login: user.login,
    firstName: user.firstName,
    lastName: user.lastName,
    disabled: user.disabled,
    isSuperAdmin: user.isSuperAdmin
  };
}

function ensureAuthColumn(
  database: Database.Database,
  tableName: string,
  columnName: string,
  definition: string
) {
  const columns = database
    .prepare(`PRAGMA table_info(${tableName})`)
    .all() as Array<{ name: string }>;

  if (!columns.some((column) => column.name === columnName)) {
    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
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
      first_name TEXT,
      last_name TEXT,
      password_hash TEXT NOT NULL,
      disabled INTEGER NOT NULL DEFAULT 0,
      is_super_admin INTEGER NOT NULL DEFAULT 0,
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

  ensureAuthColumn(database, "auth_users", "first_name", "TEXT");
  ensureAuthColumn(database, "auth_users", "last_name", "TEXT");
  ensureAuthColumn(database, "auth_users", "is_super_admin", "INTEGER NOT NULL DEFAULT 0");

  const createUserStatement = database.prepare(`
    INSERT INTO auth_users (
      login,
      first_name,
      last_name,
      password_hash,
      disabled,
      created_at,
      updated_at,
      disabled_at
    ) VALUES (
      @login,
      @firstName,
      @lastName,
      @passwordHash,
      @disabled,
      @createdAt,
      @updatedAt,
      @disabledAt
    )
  `);
  const findUserByLoginStatement = database.prepare(`
    SELECT id, login, first_name, last_name, password_hash, disabled, is_super_admin
    FROM auth_users
    WHERE login = ?
  `);
  const findUserByIdStatement = database.prepare(`
    SELECT id, login, first_name, last_name, password_hash, disabled, is_super_admin
    FROM auth_users
    WHERE id = ?
  `);
  const updateAuthUserProfileStatement = database.prepare(`
    UPDATE auth_users
    SET first_name = @firstName,
      last_name = @lastName,
      updated_at = @updatedAt
    WHERE id = @userId
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
      auth_users.first_name,
      auth_users.last_name,
      auth_sessions.csrf_token_hash,
      auth_sessions.expires_at,
      auth_sessions.last_seen_at,
      auth_users.disabled,
      auth_users.is_super_admin
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
  const listModulesStatement = database.prepare(`
    SELECT
      modules.id,
      modules.slug,
      modules.name,
      modules.bitrix_category_id AS bitrixCategoryId,
      modules.paperclip_company_id AS paperclipCompanyId,
      modules.paperclip_project_id AS paperclipProjectId,
      modules.paperclip_goal_id AS paperclipGoalId,
      modules.paperclip_triage_agent_id AS paperclipTriageAgentId
    FROM modules
    ORDER BY modules.slug ASC
  `);
  const listAllModulesForSuperAdminStatement = database.prepare(`
    SELECT
      modules.id,
      modules.slug,
      modules.name,
      'leader' AS role,
      modules.bitrix_category_id AS bitrixCategoryId,
      modules.paperclip_company_id AS paperclipCompanyId,
      modules.paperclip_project_id AS paperclipProjectId,
      modules.paperclip_goal_id AS paperclipGoalId,
      modules.paperclip_triage_agent_id AS paperclipTriageAgentId
    FROM modules
    ORDER BY modules.slug ASC
  `);
  const listPlatformUsersStatement = database.prepare(`
    SELECT id, login, first_name, last_name, password_hash, disabled, is_super_admin
    FROM auth_users
    ORDER BY login ASC
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
      auth_users.first_name AS firstName,
      auth_users.last_name AS lastName,
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
  const listAllModuleUsersStatement = database.prepare(`
    SELECT
      auth_users.id,
      auth_users.login,
      auth_users.first_name AS firstName,
      auth_users.last_name AS lastName,
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
    ORDER BY auth_users.login ASC, modules.slug ASC
  `);
  const listModuleUsersByUserStatement = database.prepare(`
    SELECT
      auth_users.id,
      auth_users.login,
      auth_users.first_name AS firstName,
      auth_users.last_name AS lastName,
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
    ORDER BY modules.slug ASC
  `);
  const updateAuthUserByIdStatement = database.prepare(`
    UPDATE auth_users
    SET first_name = CASE
        WHEN @profileChanged = 1 THEN @firstName
        ELSE first_name
      END,
      last_name = CASE
        WHEN @profileChanged = 1 THEN @lastName
        ELSE last_name
      END,
      password_hash = COALESCE(@passwordHash, password_hash),
      disabled = COALESCE(@disabled, disabled),
      disabled_at = CASE
        WHEN @disabled IS NULL THEN disabled_at
        WHEN @disabled = 1 THEN @updatedAt
        ELSE NULL
      END,
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
      auth_users.first_name AS firstName,
      auth_users.last_name AS lastName,
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
    SELECT id, login, first_name, last_name, password_hash, disabled, is_super_admin
    FROM auth_users
    WHERE disabled = 0
    ORDER BY id ASC
    LIMIT 1
  `);
  const activeSuperAdminCountStatement = database.prepare(`
    SELECT COUNT(*) AS count
    FROM auth_users
    WHERE disabled = 0
      AND is_super_admin = 1
  `);
  const promoteUserToSuperAdminStatement = database.prepare(`
    UPDATE auth_users
    SET is_super_admin = 1,
      updated_at = @updatedAt
    WHERE id = @userId
  `);

  function listMembershipsForUser(userId: number) {
    return listModuleUsersByUserStatement
      .all(userId)
      .map(readModuleUser)
      .filter((user): user is ModuleUser => Boolean(user));
  }

  function getPlatformUser(userId: number): PlatformUser | null {
    const user = readPlatformUser(findUserByIdStatement.get(userId));
    if (!user) {
      return null;
    }

    return {
      ...user,
      memberships: listMembershipsForUser(user.id)
    };
  }

  const replaceUserModuleMembershipsTransaction = database.transaction(
    (inputMemberships: {
      userId: number;
      memberships: Array<{
        moduleId: string;
        role: ModuleRole;
        status: ModuleMembershipStatus;
      }>;
      now: Date;
    }) => {
      const user = readAuthUser(findUserByIdStatement.get(inputMemberships.userId));
      if (!user) {
        return false;
      }

      const nowIso = toIso(inputMemberships.now);
      const modules = listModulesStatement
        .all()
        .map(readModuleDefinition)
        .filter((module): module is ModuleDefinition => Boolean(module));
      const moduleIds = new Set(modules.map((module) => module.id));
      const requestedByModule = new Map(
        inputMemberships.memberships.map((membership) => [
          membership.moduleId,
          membership
        ])
      );

      for (const moduleId of requestedByModule.keys()) {
        if (!moduleIds.has(moduleId)) {
          throw new Error(`Unknown module id: ${moduleId}`);
        }
      }

      const existingByModule = new Map(
        listMembershipsForUser(inputMemberships.userId).map((membership) => [
          membership.moduleId,
          membership
        ])
      );

      for (const module of modules) {
        const requested = requestedByModule.get(module.id);
        const existing = existingByModule.get(module.id);
        if (!requested && !existing) {
          continue;
        }

        setModuleMembershipStatement.run({
          userId: inputMemberships.userId,
          moduleId: module.id,
          role: requested?.role ?? existing?.moduleRole ?? "employee",
          status: requested?.status ?? "disabled",
          createdAt: nowIso,
          updatedAt: nowIso
        });
      }

      return true;
    }
  );

  return {
    async createUser(inputUser) {
      const now = inputUser.now ?? new Date();
      const nowIso = toIso(now);
      const login = normalizeLogin(inputUser.login);
      createUserStatement.run({
        login,
        firstName: inputUser.firstName ?? null,
        lastName: inputUser.lastName ?? null,
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
    async updateUserProfile(inputUser) {
      const nowIso = toIso(inputUser.now ?? new Date());
      const existing = readAuthUser(findUserByIdStatement.get(inputUser.userId));
      if (!existing) {
        return null;
      }

      updateAuthUserProfileStatement.run({
        userId: inputUser.userId,
        firstName:
          inputUser.firstName !== undefined ? inputUser.firstName : existing.firstName,
        lastName:
          inputUser.lastName !== undefined ? inputUser.lastName : existing.lastName,
        updatedAt: nowIso
      });

      return readAuthUser(findUserByIdStatement.get(inputUser.userId));
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
    async ensureDefaultSuperAdmin() {
      const count = (
        activeSuperAdminCountStatement.get() as { count: number }
      ).count;
      if (count > 0) {
        return;
      }

      const user = readAuthUser(firstActiveUserStatement.get());
      if (!user) {
        return;
      }

      promoteUserToSuperAdminStatement.run({
        userId: user.id,
        updatedAt: toIso(new Date())
      });
    },
    async listModules() {
      return listModulesStatement
        .all()
        .map(readModuleDefinition)
        .filter((module): module is ModuleDefinition => Boolean(module));
    },
    async listUserModules(userId) {
      const user = readAuthUser(findUserByIdStatement.get(userId));
      if (user?.isSuperAdmin) {
        return listAllModulesForSuperAdminStatement
          .all()
          .map(readAuthenticatedModule)
          .filter((module): module is AuthenticatedModule => Boolean(module));
      }

      return listUserModulesStatement
        .all(userId)
        .map(readAuthenticatedModule)
        .filter((module): module is AuthenticatedModule => Boolean(module));
    },
    async listPlatformUsers() {
      const memberships = listAllModuleUsersStatement
        .all()
        .map(readModuleUser)
        .filter((user): user is ModuleUser => Boolean(user));
      const membershipsByUserId = new Map<number, ModuleUser[]>();
      for (const membership of memberships) {
        const existing = membershipsByUserId.get(membership.id) ?? [];
        existing.push(membership);
        membershipsByUserId.set(membership.id, existing);
      }

      return listPlatformUsersStatement
        .all()
        .map(readPlatformUser)
        .filter((user): user is Omit<PlatformUser, "memberships"> =>
          Boolean(user)
        )
        .map((user) => ({
          ...user,
          memberships: membershipsByUserId.get(user.id) ?? []
        }));
    },
    async replaceUserModuleMemberships(inputMemberships) {
      const updated = replaceUserModuleMembershipsTransaction({
        ...inputMemberships,
        now: inputMemberships.now ?? new Date()
      });
      if (!updated) {
        return null;
      }

      return getPlatformUser(inputMemberships.userId);
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
      const existing = readModuleUser(
        getModuleUserStatement.get(inputUser.userId, inputUser.moduleId)
      );
      if (!existing) {
        return null;
      }

      const profileChanged =
        inputUser.firstName !== undefined || inputUser.lastName !== undefined;

      if (
        profileChanged ||
        inputUser.passwordHash !== undefined ||
        inputUser.disabled !== undefined
      ) {
        updateAuthUserByIdStatement.run({
          userId: inputUser.userId,
          profileChanged: profileChanged ? 1 : 0,
          firstName:
            inputUser.firstName !== undefined
              ? inputUser.firstName
              : existing?.firstName ?? null,
          lastName:
            inputUser.lastName !== undefined ? inputUser.lastName : existing?.lastName ?? null,
          passwordHash: inputUser.passwordHash ?? null,
          disabled:
            inputUser.disabled === undefined ? null : inputUser.disabled ? 1 : 0,
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
      const startedAtMs = Date.now();
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
        await waitForFailedLoginFloor(startedAtMs);
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
          firstName: user.firstName,
          lastName: user.lastName,
          role: "admin",
          isSuperAdmin: user.isSuperAdmin,
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
          firstName: session.firstName,
          lastName: session.lastName,
          role: "admin",
          isSuperAdmin: session.isSuperAdmin,
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
