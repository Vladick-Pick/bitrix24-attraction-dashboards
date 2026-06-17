import type Database from "better-sqlite3";

import type {
  DashboardCommentContext,
  DashboardCommentRecord,
  PaperclipCommentStatus,
  PaperclipSyncStatus,
  ProtoCommentAnchor,
  ProtoCommentRecord,
  ProtoCommentStore,
  SqliteRepository
} from "../sqlite-repository.js";

type CommentRepositoryMethods = Pick<
  SqliteRepository,
  | "getProtoComments"
  | "replaceProtoComments"
  | "getDashboardComments"
  | "getDashboardCommentById"
  | "createDashboardComment"
  | "updateDashboardComment"
  | "archiveDashboardComment"
  | "updateDashboardCommentPaperclip"
>;

type ProtoCommentRow = Omit<ProtoCommentRecord, "anchor"> & {
  anchorJson: string | null;
};

type DashboardCommentRow = Omit<
  DashboardCommentRecord,
  "anchor" | "context" | "paperclipStatus" | "paperclipSyncStatus"
> & {
  anchorJson: string | null;
  contextJson: string | null;
  paperclipStatus: string | null;
  paperclipSyncStatus: string | null;
};

function parseProtoCommentAnchor(value: string | null): ProtoCommentAnchor | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value) as ProtoCommentAnchor;
  } catch {
    return undefined;
  }
}

function parseDashboardCommentContext(
  value: string | null
): DashboardCommentContext | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as DashboardCommentContext)
      : undefined;
  } catch {
    return undefined;
  }
}

function normalizePaperclipCommentStatus(value: string | null): PaperclipCommentStatus {
  if (
    value === "sent" ||
    value === "in_work" ||
    value === "needs_input" ||
    value === "done" ||
    value === "failed"
  ) {
    return value;
  }

  return "queued";
}

function normalizePaperclipSyncStatus(value: string | null): PaperclipSyncStatus {
  if (value === "syncing" || value === "sent" || value === "failed") {
    return value;
  }

  return "queued";
}

function readDashboardComment(row: DashboardCommentRow): DashboardCommentRecord {
  const { anchorJson, contextJson, paperclipStatus, paperclipSyncStatus, ...comment } =
    row;
  const anchor = parseProtoCommentAnchor(anchorJson);
  const context = parseDashboardCommentContext(contextJson);

  return {
    ...comment,
    paperclipStatus: normalizePaperclipCommentStatus(paperclipStatus),
    paperclipSyncStatus: normalizePaperclipSyncStatus(paperclipSyncStatus),
    ...(anchor ? { anchor } : {}),
    ...(context ? { context } : {})
  };
}

export function createCommentRepositoryMethods(
  database: Database.Database
): CommentRepositoryMethods {
  const insertProtoCommentStatement = database.prepare(`
    INSERT INTO proto_comments (
      id,
      scene_id,
      x,
      y,
      text,
      status,
      archived_at,
      created_at,
      updated_at,
      anchor_json,
      sort_order
    ) VALUES (
      @id,
      @sceneId,
      @x,
      @y,
      @text,
      @status,
      @archivedAt,
      @createdAt,
      @updatedAt,
      @anchorJson,
      @sortOrder
    )
  `);

  const insertDashboardCommentStatement = database.prepare(`
    INSERT INTO proto_comments (
      id,
      scene_id,
      x,
      y,
      text,
      status,
      archived_at,
      created_at,
      updated_at,
      anchor_json,
      sort_order,
      module_id,
      author_user_id,
      author_login,
      paperclip_issue_id,
      paperclip_issue_identifier,
      paperclip_status,
      paperclip_sync_status,
      paperclip_error,
      paperclip_last_synced_at,
      paperclip_retry_count,
      context_json
    ) VALUES (
      @id,
      @sceneId,
      @x,
      @y,
      @text,
      @status,
      @archivedAt,
      @createdAt,
      @updatedAt,
      @anchorJson,
      @sortOrder,
      @moduleId,
      @authorUserId,
      @authorLogin,
      @paperclipIssueId,
      @paperclipIssueIdentifier,
      @paperclipStatus,
      @paperclipSyncStatus,
      @paperclipError,
      @paperclipLastSyncedAt,
      @paperclipRetryCount,
      @contextJson
    )
  `);

  const selectDashboardCommentSql = `
    SELECT
      id,
      scene_id AS sceneId,
      x,
      y,
      text,
      status,
      archived_at AS archivedAt,
      created_at AS createdAt,
      updated_at AS updatedAt,
      anchor_json AS anchorJson,
      module_id AS moduleId,
      COALESCE(author_user_id, 0) AS authorUserId,
      COALESCE(author_login, '') AS authorLogin,
      paperclip_issue_id AS paperclipIssueId,
      paperclip_issue_identifier AS paperclipIssueIdentifier,
      paperclip_status AS paperclipStatus,
      paperclip_sync_status AS paperclipSyncStatus,
      paperclip_error AS paperclipError,
      paperclip_last_synced_at AS paperclipLastSyncedAt,
      paperclip_retry_count AS paperclipRetryCount,
      context_json AS contextJson
    FROM proto_comments
  `;
  const getDashboardCommentByIdStatement = database.prepare(`
    ${selectDashboardCommentSql}
    WHERE id = ?
  `);
  const listDashboardCommentsStatement = database.prepare(`
    ${selectDashboardCommentSql}
    WHERE module_id = ?
    ORDER BY created_at ASC, id ASC
  `);
  const updateDashboardCommentStatement = database.prepare(`
    UPDATE proto_comments
    SET text = COALESCE(@text, text),
      context_json = COALESCE(@contextJson, context_json),
      updated_at = @updatedAt
    WHERE id = @id
  `);
  const archiveDashboardCommentStatement = database.prepare(`
    UPDATE proto_comments
    SET status = 'archived',
      archived_at = @archivedAt,
      updated_at = @updatedAt
    WHERE id = @id
  `);
  const updateDashboardCommentPaperclipStatement = database.prepare(`
    UPDATE proto_comments
    SET paperclip_issue_id = COALESCE(@paperclipIssueId, paperclip_issue_id),
      paperclip_issue_identifier = COALESCE(@paperclipIssueIdentifier, paperclip_issue_identifier),
      paperclip_status = @paperclipStatus,
      paperclip_sync_status = @paperclipSyncStatus,
      paperclip_error = @paperclipError,
      paperclip_last_synced_at = @paperclipLastSyncedAt,
      paperclip_retry_count = paperclip_retry_count + @retryIncrement,
      updated_at = COALESCE(@paperclipLastSyncedAt, updated_at)
    WHERE id = @id
  `);
  const nextCommentSortOrderStatement = database.prepare(`
    SELECT COALESCE(MAX(sort_order), -1) + 1 AS sortOrder
    FROM proto_comments
  `);
  const updateProtoCommentStoreStatement = database.prepare(`
    INSERT INTO proto_comment_store (id, updated_at)
    VALUES (1, ?)
    ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at
  `);
  const getProtoCommentStoreStatement = database.prepare(
    "SELECT updated_at AS updatedAt FROM proto_comment_store WHERE id = 1"
  );
  const listProtoCommentsStatement = database.prepare(`
    SELECT
      id,
      scene_id AS sceneId,
      x,
      y,
      text,
      status,
      archived_at AS archivedAt,
      created_at AS createdAt,
      updated_at AS updatedAt,
      anchor_json AS anchorJson
    FROM proto_comments
    ORDER BY sort_order ASC, created_at ASC, id ASC
  `);

  const replaceProtoCommentsTransaction = database.transaction(
    (input: ProtoCommentStore) => {
      database.exec("DELETE FROM proto_comments");
      updateProtoCommentStoreStatement.run(input.updatedAt);

      input.comments.forEach((comment, index) => {
        insertProtoCommentStatement.run({
          id: comment.id,
          sceneId: comment.sceneId,
          x: comment.x,
          y: comment.y,
          text: comment.text,
          status: comment.status ?? "open",
          archivedAt: comment.archivedAt ?? null,
          createdAt: comment.createdAt,
          updatedAt: comment.updatedAt,
          anchorJson: comment.anchor ? JSON.stringify(comment.anchor) : null,
          sortOrder: index
        });
      });
    }
  );

  async function getProtoComments() {
    const meta = getProtoCommentStoreStatement.get() as
      | { updatedAt: string | null }
      | undefined;
    const rows = listProtoCommentsStatement.all() as ProtoCommentRow[];

    return {
      updatedAt: meta?.updatedAt ?? null,
      comments: rows.map((row) => {
        const { anchorJson, ...comment } = row;
        const anchor = parseProtoCommentAnchor(anchorJson);
        return anchor ? { ...comment, anchor } : comment;
      })
    };
  }

  async function getDashboardCommentById(id: string) {
    const row = getDashboardCommentByIdStatement.get(id) as
      | DashboardCommentRow
      | undefined;
    return row ? readDashboardComment(row) : null;
  }

  return {
    getProtoComments,

    async replaceProtoComments(input) {
      replaceProtoCommentsTransaction(input);
      return getProtoComments();
    },

    async getDashboardComments(moduleId) {
      const meta = getProtoCommentStoreStatement.get() as
        | { updatedAt: string | null }
        | undefined;
      const rows = listDashboardCommentsStatement.all(moduleId) as DashboardCommentRow[];

      return {
        updatedAt: meta?.updatedAt ?? null,
        comments: rows.map(readDashboardComment)
      };
    },

    getDashboardCommentById,

    async createDashboardComment(inputComment) {
      const sortOrder = (
        nextCommentSortOrderStatement.get() as { sortOrder: number }
      ).sortOrder;
      insertDashboardCommentStatement.run({
        id: inputComment.id,
        sceneId: inputComment.sceneId,
        x: inputComment.x,
        y: inputComment.y,
        text: inputComment.text,
        status: inputComment.status ?? "open",
        archivedAt: inputComment.archivedAt ?? null,
        createdAt: inputComment.createdAt,
        updatedAt: inputComment.updatedAt,
        anchorJson: inputComment.anchor ? JSON.stringify(inputComment.anchor) : null,
        sortOrder,
        moduleId: inputComment.moduleId,
        authorUserId: inputComment.authorUserId,
        authorLogin: inputComment.authorLogin,
        paperclipIssueId: inputComment.paperclipIssueId,
        paperclipIssueIdentifier: inputComment.paperclipIssueIdentifier,
        paperclipStatus: inputComment.paperclipStatus,
        paperclipSyncStatus: inputComment.paperclipSyncStatus,
        paperclipError: inputComment.paperclipError,
        paperclipLastSyncedAt: inputComment.paperclipLastSyncedAt,
        paperclipRetryCount: inputComment.paperclipRetryCount,
        contextJson: inputComment.context ? JSON.stringify(inputComment.context) : null
      });
      updateProtoCommentStoreStatement.run(inputComment.updatedAt);

      const created = await getDashboardCommentById(inputComment.id);
      if (!created) {
        throw new Error("Failed to create dashboard comment.");
      }
      return created;
    },

    async updateDashboardComment(inputComment) {
      updateDashboardCommentStatement.run({
        id: inputComment.id,
        text: inputComment.text ?? null,
        contextJson: inputComment.context
          ? JSON.stringify(inputComment.context)
          : null,
        updatedAt: inputComment.updatedAt
      });
      return getDashboardCommentById(inputComment.id);
    },

    async archiveDashboardComment(inputComment) {
      archiveDashboardCommentStatement.run({
        id: inputComment.id,
        archivedAt: inputComment.archivedAt,
        updatedAt: inputComment.updatedAt
      });
      return getDashboardCommentById(inputComment.id);
    },

    async updateDashboardCommentPaperclip(inputComment) {
      updateDashboardCommentPaperclipStatement.run({
        id: inputComment.id,
        paperclipIssueId: inputComment.paperclipIssueId ?? null,
        paperclipIssueIdentifier: inputComment.paperclipIssueIdentifier ?? null,
        paperclipStatus: inputComment.paperclipStatus,
        paperclipSyncStatus: inputComment.paperclipSyncStatus,
        paperclipError: inputComment.paperclipError ?? null,
        paperclipLastSyncedAt: inputComment.paperclipLastSyncedAt ?? null,
        retryIncrement: inputComment.incrementRetryCount ? 1 : 0
      });
      return getDashboardCommentById(inputComment.id);
    }
  };
}
