import { randomUUID } from "node:crypto";

import type Database from "better-sqlite3";

import type {
  CreateTelegramEnrichmentActionTokenInput,
  CreateEnrichmentProposalBatchInput,
  EnrichmentProposalBatchRecord,
  EnrichmentProposalBatchStatus,
  EnrichmentProposalEventInput,
  EnrichmentProposalEventRecord,
  EnrichmentProposalRecord,
  EnrichmentProposalStatus,
  MarkTelegramEnrichmentActionTokenUsedInput,
  MarkEnrichmentProposalAppliedInput,
  MarkEnrichmentProposalDecisionInput,
  MarkEnrichmentProposalFailedInput,
  SqliteRepository,
  TelegramEnrichmentActionTokenRecord,
  UpdateEnrichmentProposalBatchTelegramMessageInput
} from "../sqlite-repository.js";

type EnrichmentProposalRepositoryMethods = Pick<
  SqliteRepository,
  | "createEnrichmentProposalBatch"
  | "getEnrichmentProposalBatch"
  | "getEnrichmentProposalBatchByCallId"
  | "getEnrichmentProposal"
  | "listEnrichmentProposals"
  | "listEnrichmentProposalEvents"
  | "createTelegramEnrichmentActionToken"
  | "getTelegramEnrichmentActionToken"
  | "markTelegramEnrichmentActionTokenUsed"
  | "updateEnrichmentProposalBatchTelegramMessage"
  | "appendEnrichmentProposalEvent"
  | "markEnrichmentProposalDecision"
  | "markEnrichmentProposalApplied"
  | "markEnrichmentProposalFailed"
  | "expirePendingEnrichmentProposals"
>;

type EnrichmentProposalBatchRow = Omit<
  EnrichmentProposalBatchRecord,
  "status"
> & {
  status: string;
};

type EnrichmentProposalRow = Omit<
  EnrichmentProposalRecord,
  "actionType" | "currentValue" | "proposedValue" | "normalizedValue" | "status"
> & {
  actionType: string;
  currentValueJson: string | null;
  proposedValueJson: string;
  normalizedValueJson: string;
  status: string;
};

type EnrichmentProposalEventRow = Omit<
  EnrichmentProposalEventRecord,
  "actorType" | "metadata"
> & {
  actorType: string;
  metadataJson: string | null;
};

type TelegramEnrichmentActionTokenRow = Omit<
  TelegramEnrichmentActionTokenRecord,
  "action"
> & {
  action: string;
};

function stringifyOptionalJson(value: unknown | null | undefined) {
  return value === null || value === undefined ? null : JSON.stringify(value);
}

function parseRequiredJson(value: string, label: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch (error) {
    throw new Error(`Failed to parse ${label}.`, { cause: error });
  }
}

function parseOptionalJson(
  value: string | null,
  label: string
): Record<string, unknown> | null {
  if (value === null) {
    return null;
  }

  const parsed = parseRequiredJson(value, label);
  return parsed && typeof parsed === "object"
    ? (parsed as Record<string, unknown>)
    : null;
}

function readBatch(row: EnrichmentProposalBatchRow): EnrichmentProposalBatchRecord {
  return {
    ...row,
    status: row.status as EnrichmentProposalBatchStatus
  };
}

function readProposal(row: EnrichmentProposalRow): EnrichmentProposalRecord {
  return {
    ...row,
    actionType: row.actionType as EnrichmentProposalRecord["actionType"],
    currentValue:
      row.currentValueJson === null
        ? null
        : parseRequiredJson(
            row.currentValueJson,
            "enrichment_proposals.current_value_json"
          ),
    proposedValue: parseRequiredJson(
      row.proposedValueJson,
      "enrichment_proposals.proposed_value_json"
    ),
    normalizedValue: parseRequiredJson(
      row.normalizedValueJson,
      "enrichment_proposals.normalized_value_json"
    ),
    status: row.status as EnrichmentProposalStatus
  };
}

function readEvent(row: EnrichmentProposalEventRow): EnrichmentProposalEventRecord {
  return {
    ...row,
    actorType: row.actorType as EnrichmentProposalEventRecord["actorType"],
    metadata: parseOptionalJson(
      row.metadataJson,
      "enrichment_proposal_events.metadata_json"
    )
  };
}

function readTelegramToken(
  row: TelegramEnrichmentActionTokenRow
): TelegramEnrichmentActionTokenRecord {
  return {
    ...row,
    action: row.action as TelegramEnrichmentActionTokenRecord["action"]
  };
}

function resolveBatchStatus(statuses: EnrichmentProposalStatus[]) {
  if (statuses.length === 0) {
    return "pending" satisfies EnrichmentProposalBatchStatus;
  }

  if (statuses.every((status) => status === "applied")) {
    return "applied" satisfies EnrichmentProposalBatchStatus;
  }

  if (statuses.every((status) => status === "declined")) {
    return "declined" satisfies EnrichmentProposalBatchStatus;
  }

  if (statuses.every((status) => status === "expired")) {
    return "expired" satisfies EnrichmentProposalBatchStatus;
  }

  if (statuses.some((status) => status === "applied")) {
    return "partially_applied" satisfies EnrichmentProposalBatchStatus;
  }

  if (
    statuses.some((status) => status === "failed" || status === "conflict") &&
    statuses.every((status) =>
      ["failed", "conflict", "declined", "expired"].includes(status)
    )
  ) {
    return "failed" satisfies EnrichmentProposalBatchStatus;
  }

  return "pending" satisfies EnrichmentProposalBatchStatus;
}

export function createEnrichmentProposalRepositoryMethods(
  database: Database.Database
): EnrichmentProposalRepositoryMethods {
  const insertBatchStatement = database.prepare(`
    INSERT INTO enrichment_proposal_batches (
      id,
      call_id,
      activity_id,
      deal_id,
      contact_id,
      manager_id,
      call_analysis_run_id,
      status,
      expires_at,
      telegram_chat_id,
      telegram_message_id,
      created_at,
      updated_at
    ) VALUES (
      @id,
      @callId,
      @activityId,
      @dealId,
      @contactId,
      @managerId,
      @callAnalysisRunId,
      @status,
      @expiresAt,
      @telegramChatId,
      @telegramMessageId,
      @createdAt,
      @updatedAt
    )
  `);

  const insertProposalStatement = database.prepare(`
    INSERT INTO enrichment_proposals (
      id,
      batch_id,
      entity_type,
      entity_id,
      field_code,
      field_title,
      action_type,
      current_value_json,
      proposed_value_json,
      normalized_value_json,
      confidence,
      evidence_snippet,
      status,
      created_at,
      updated_at
    ) VALUES (
      @id,
      @batchId,
      @entityType,
      @entityId,
      @fieldCode,
      @fieldTitle,
      @actionType,
      @currentValueJson,
      @proposedValueJson,
      @normalizedValueJson,
      @confidence,
      @evidenceSnippet,
      @status,
      @createdAt,
      @updatedAt
    )
  `);

  const selectBatchSql = `
    SELECT
      id,
      call_id AS callId,
      activity_id AS activityId,
      deal_id AS dealId,
      contact_id AS contactId,
      manager_id AS managerId,
      call_analysis_run_id AS callAnalysisRunId,
      status,
      expires_at AS expiresAt,
      telegram_chat_id AS telegramChatId,
      telegram_message_id AS telegramMessageId,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM enrichment_proposal_batches
  `;

  const getBatchByIdStatement = database.prepare(`
    ${selectBatchSql}
    WHERE id = ?
  `);
  const getBatchByCallIdStatement = database.prepare(`
    ${selectBatchSql}
    WHERE call_id = ?
  `);
  const listProposalsStatement = database.prepare(`
    SELECT
      id,
      batch_id AS batchId,
      entity_type AS entityType,
      entity_id AS entityId,
      field_code AS fieldCode,
      field_title AS fieldTitle,
      action_type AS actionType,
      current_value_json AS currentValueJson,
      proposed_value_json AS proposedValueJson,
      normalized_value_json AS normalizedValueJson,
      confidence,
      evidence_snippet AS evidenceSnippet,
      status,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM enrichment_proposals
    WHERE batch_id = ?
    ORDER BY created_at ASC, id ASC
  `);
  const getProposalByIdStatement = database.prepare(`
    SELECT
      id,
      batch_id AS batchId,
      entity_type AS entityType,
      entity_id AS entityId,
      field_code AS fieldCode,
      field_title AS fieldTitle,
      action_type AS actionType,
      current_value_json AS currentValueJson,
      proposed_value_json AS proposedValueJson,
      normalized_value_json AS normalizedValueJson,
      confidence,
      evidence_snippet AS evidenceSnippet,
      status,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM enrichment_proposals
    WHERE id = ?
  `);
  const insertEventStatement = database.prepare(`
    INSERT INTO enrichment_proposal_events (
      id,
      batch_id,
      proposal_id,
      actor_type,
      actor_id,
      action,
      before_status,
      after_status,
      reason,
      metadata_json,
      created_at
    ) VALUES (
      @id,
      @batchId,
      @proposalId,
      @actorType,
      @actorId,
      @action,
      @beforeStatus,
      @afterStatus,
      @reason,
      @metadataJson,
      @createdAt
    )
  `);
  const listEventsStatement = database.prepare(`
    SELECT
      id,
      batch_id AS batchId,
      proposal_id AS proposalId,
      actor_type AS actorType,
      actor_id AS actorId,
      action,
      before_status AS beforeStatus,
      after_status AS afterStatus,
      reason,
      metadata_json AS metadataJson,
      created_at AS createdAt
    FROM enrichment_proposal_events
    WHERE batch_id = ?
    ORDER BY created_at ASC, id ASC
  `);
  const insertTelegramTokenStatement = database.prepare(`
    INSERT INTO telegram_enrichment_action_tokens (
      token,
      batch_id,
      proposal_id,
      action,
      manager_id,
      telegram_chat_id,
      expires_at,
      used_at,
      created_at
    ) VALUES (
      @token,
      @batchId,
      @proposalId,
      @action,
      @managerId,
      @telegramChatId,
      @expiresAt,
      NULL,
      @createdAt
    )
  `);
  const getTelegramTokenStatement = database.prepare(`
    SELECT
      token,
      batch_id AS batchId,
      proposal_id AS proposalId,
      action,
      manager_id AS managerId,
      telegram_chat_id AS telegramChatId,
      expires_at AS expiresAt,
      used_at AS usedAt,
      created_at AS createdAt
    FROM telegram_enrichment_action_tokens
    WHERE token = ?
  `);
  const markTelegramTokenUsedStatement = database.prepare(`
    UPDATE telegram_enrichment_action_tokens
    SET used_at = @usedAt
    WHERE token = @token
      AND used_at IS NULL
  `);
  const getProposalStatusStatement = database.prepare(`
    SELECT
      id,
      batch_id AS batchId,
      status
    FROM enrichment_proposals
    WHERE id = ?
  `);
  const updateProposalStatusStatement = database.prepare(`
    UPDATE enrichment_proposals
    SET status = @status,
      updated_at = @updatedAt
    WHERE id = @proposalId
  `);
  const updateBatchStatusStatement = database.prepare(`
    UPDATE enrichment_proposal_batches
    SET status = @status,
      updated_at = @updatedAt
    WHERE id = @batchId
  `);
  const updateBatchTelegramMessageStatement = database.prepare(`
    UPDATE enrichment_proposal_batches
    SET telegram_chat_id = @telegramChatId,
      telegram_message_id = @telegramMessageId,
      updated_at = @updatedAt
    WHERE id = @batchId
  `);
  const listProposalStatusesStatement = database.prepare(`
    SELECT status
    FROM enrichment_proposals
    WHERE batch_id = ?
  `);
  const listExpiredPendingBatchesStatement = database.prepare(`
    SELECT id
    FROM enrichment_proposal_batches
    WHERE status = 'pending'
      AND expires_at <= ?
    ORDER BY expires_at ASC, id ASC
  `);
  const expirePendingProposalsStatement = database.prepare(`
    UPDATE enrichment_proposals
    SET status = 'expired',
      updated_at = @expiredAt
    WHERE batch_id = @batchId
      AND status = 'pending'
  `);

  function appendEvent(input: EnrichmentProposalEventInput) {
    insertEventStatement.run({
      ...input,
      metadataJson: stringifyOptionalJson(input.metadata)
    });
  }

  function getProposalStatus(proposalId: string) {
    const row = getProposalStatusStatement.get(proposalId) as
      | {
          id: string;
          batchId: string;
          status: EnrichmentProposalStatus;
        }
      | undefined;

    if (!row) {
      throw new Error(`Enrichment proposal not found: ${proposalId}`);
    }

    return row;
  }

  function refreshBatchStatus(batchId: string, updatedAt: string) {
    const rows = listProposalStatusesStatement.all(batchId) as Array<{
      status: EnrichmentProposalStatus;
    }>;
    const status = resolveBatchStatus(rows.map((row) => row.status));
    updateBatchStatusStatement.run({ batchId, status, updatedAt });
  }

  const createBatchTransaction = database.transaction(
    (input: CreateEnrichmentProposalBatchInput) => {
      insertBatchStatement.run({
        ...input,
        telegramChatId: input.telegramChatId ?? null,
        telegramMessageId: input.telegramMessageId ?? null
      });

      for (const proposal of input.proposals) {
        insertProposalStatement.run({
          ...proposal,
          batchId: proposal.batchId ?? input.id,
          currentValueJson: stringifyOptionalJson(proposal.currentValue),
          proposedValueJson: JSON.stringify(proposal.proposedValue),
          normalizedValueJson: JSON.stringify(proposal.normalizedValue)
        });
      }
    }
  );

  const markDecisionTransaction = database.transaction(
    (input: MarkEnrichmentProposalDecisionInput) => {
      const proposal = getProposalStatus(input.proposalId);
      if (proposal.status !== "pending") {
        return false;
      }

      updateProposalStatusStatement.run({
        proposalId: input.proposalId,
        status: input.status,
        updatedAt: input.decidedAt
      });
      appendEvent({
        id: input.eventId,
        batchId: proposal.batchId,
        proposalId: input.proposalId,
        actorType: "manager",
        actorId: input.actorId,
        action: `proposal.${input.status}`,
        beforeStatus: proposal.status,
        afterStatus: input.status,
        reason: input.reason ?? null,
        metadata: input.metadata ?? null,
        createdAt: input.decidedAt
      });
      refreshBatchStatus(proposal.batchId, input.decidedAt);
      return true;
    }
  );

  const markAppliedTransaction = database.transaction(
    (input: MarkEnrichmentProposalAppliedInput) => {
      const proposal = getProposalStatus(input.proposalId);
      updateProposalStatusStatement.run({
        proposalId: input.proposalId,
        status: "applied",
        updatedAt: input.appliedAt
      });
      appendEvent({
        id: input.eventId,
        batchId: proposal.batchId,
        proposalId: input.proposalId,
        actorType: input.actorType ?? "system",
        actorId: input.actorId ?? null,
        action: "proposal.applied",
        beforeStatus: proposal.status,
        afterStatus: "applied",
        reason: null,
        metadata: input.metadata ?? null,
        createdAt: input.appliedAt
      });
      refreshBatchStatus(proposal.batchId, input.appliedAt);
    }
  );

  const markFailedTransaction = database.transaction(
    (input: MarkEnrichmentProposalFailedInput) => {
      const status = input.status ?? "failed";
      const proposal = getProposalStatus(input.proposalId);
      updateProposalStatusStatement.run({
        proposalId: input.proposalId,
        status,
        updatedAt: input.failedAt
      });
      appendEvent({
        id: input.eventId,
        batchId: proposal.batchId,
        proposalId: input.proposalId,
        actorType: input.actorType ?? "system",
        actorId: input.actorId ?? null,
        action: `proposal.${status}`,
        beforeStatus: proposal.status,
        afterStatus: status,
        reason: input.reason,
        metadata: input.metadata ?? null,
        createdAt: input.failedAt
      });
      refreshBatchStatus(proposal.batchId, input.failedAt);
    }
  );

  const expirePendingTransaction = database.transaction((expiredAt: string) => {
    const batches = listExpiredPendingBatchesStatement.all(expiredAt) as Array<{
      id: string;
    }>;

    for (const batch of batches) {
      expirePendingProposalsStatement.run({ batchId: batch.id, expiredAt });
      updateBatchStatusStatement.run({
        batchId: batch.id,
        status: "expired",
        updatedAt: expiredAt
      });
      appendEvent({
        id: randomUUID(),
        batchId: batch.id,
        proposalId: null,
        actorType: "system",
        actorId: null,
        action: "batch.expired",
        beforeStatus: "pending",
        afterStatus: "expired",
        reason: "expires_at reached",
        metadata: null,
        createdAt: expiredAt
      });
    }
  });

  return {
    createEnrichmentProposalBatch(input) {
      createBatchTransaction(input);
      return Promise.resolve();
    },

    async getEnrichmentProposalBatch(batchId) {
      const row = getBatchByIdStatement.get(batchId) as
        | EnrichmentProposalBatchRow
        | undefined;
      return row ? readBatch(row) : null;
    },

    async getEnrichmentProposalBatchByCallId(callId) {
      const row = getBatchByCallIdStatement.get(callId) as
        | EnrichmentProposalBatchRow
        | undefined;
      return row ? readBatch(row) : null;
    },

    async getEnrichmentProposal(proposalId) {
      const row = getProposalByIdStatement.get(proposalId) as
        | EnrichmentProposalRow
        | undefined;
      return row ? readProposal(row) : null;
    },

    async listEnrichmentProposals(batchId) {
      const rows = listProposalsStatement.all(batchId) as EnrichmentProposalRow[];
      return rows.map(readProposal);
    },

    async listEnrichmentProposalEvents(batchId) {
      const rows = listEventsStatement.all(batchId) as EnrichmentProposalEventRow[];
      return rows.map(readEvent);
    },

    createTelegramEnrichmentActionToken(
      input: CreateTelegramEnrichmentActionTokenInput
    ) {
      insertTelegramTokenStatement.run(input);
      return Promise.resolve();
    },

    async getTelegramEnrichmentActionToken(token) {
      const row = getTelegramTokenStatement.get(token) as
        | TelegramEnrichmentActionTokenRow
        | undefined;
      return row ? readTelegramToken(row) : null;
    },

    markTelegramEnrichmentActionTokenUsed(
      input: MarkTelegramEnrichmentActionTokenUsedInput
    ) {
      const result = markTelegramTokenUsedStatement.run(input);
      return Promise.resolve(result.changes > 0);
    },

    updateEnrichmentProposalBatchTelegramMessage(
      input: UpdateEnrichmentProposalBatchTelegramMessageInput
    ) {
      updateBatchTelegramMessageStatement.run(input);
      return Promise.resolve();
    },

    appendEnrichmentProposalEvent(input) {
      appendEvent(input);
      return Promise.resolve();
    },

    markEnrichmentProposalDecision(input) {
      return Promise.resolve(markDecisionTransaction(input));
    },

    markEnrichmentProposalApplied(input) {
      markAppliedTransaction(input);
      return Promise.resolve();
    },

    markEnrichmentProposalFailed(input) {
      markFailedTransaction(input);
      return Promise.resolve();
    },

    expirePendingEnrichmentProposals(input) {
      expirePendingTransaction(input.expiredAt);
      return Promise.resolve();
    }
  };
}
