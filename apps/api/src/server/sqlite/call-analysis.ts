import type Database from "better-sqlite3";

import type {
  CallAnalysisResultRecord,
  CallAnalysisRunSummary,
  SqliteRepository
} from "../sqlite-repository.js";

type CallAnalysisRepositoryMethods = Pick<
  SqliteRepository,
  | "getCallAnalysisResult"
  | "getLatestCallAnalysisRuns"
  | "startCallAnalysisRun"
  | "saveCallAnalysisResult"
  | "finishCallAnalysisRun"
  | "failCallAnalysisRun"
>;

function parseRequiredJson<T>(value: string, label: string): T {
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new Error(`Failed to parse ${label}.`, { cause: error });
  }
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

export function createCallAnalysisRepositoryMethods(
  database: Database.Database
): CallAnalysisRepositoryMethods {
  const insertCallAnalysisRunStatement = database.prepare(`
    INSERT INTO call_analysis_runs (
      id,
      call_id,
      crm_activity_id,
      trigger_mode,
      status,
      started_at,
      recording_source,
      recording_file_id,
      model,
      prompt_version
    ) VALUES (
      @id,
      @callId,
      @crmActivityId,
      @triggerMode,
      @status,
      @startedAt,
      @recordingSource,
      @recordingFileId,
      @model,
      @promptVersion
    )
  `);

  const finishCallAnalysisRunStatement = database.prepare(`
    UPDATE call_analysis_runs
    SET
      status = @status,
      finished_at = @finishedAt,
      recording_source = @recordingSource,
      recording_file_id = @recordingFileId,
      model = @model,
      prompt_version = @promptVersion,
      error_code = NULL,
      error_message = NULL
    WHERE id = @runId
  `);

  const failCallAnalysisRunStatement = database.prepare(`
    UPDATE call_analysis_runs
    SET
      status = @status,
      finished_at = @failedAt,
      error_code = @errorCode,
      error_message = @errorMessage
    WHERE id = @runId
  `);

  const upsertCallAnalysisResultStatement = database.prepare(`
    INSERT INTO call_analysis_results (
      call_id,
      run_id,
      status,
      transcript_by_roles_json,
      full_transcript_text,
      ai_evaluation_json,
      raw_ai_evaluation_json,
      attributes_json,
      model,
      prompt_version,
      analyzed_at,
      updated_at
    ) VALUES (
      @callId,
      @runId,
      @status,
      @transcriptByRolesJson,
      @fullTranscriptText,
      @aiEvaluationJson,
      @rawAiEvaluationJson,
      @attributesJson,
      @model,
      @promptVersion,
      @analyzedAt,
      @updatedAt
    )
    ON CONFLICT(call_id) DO UPDATE SET
      run_id = excluded.run_id,
      status = excluded.status,
      transcript_by_roles_json = excluded.transcript_by_roles_json,
      full_transcript_text = excluded.full_transcript_text,
      ai_evaluation_json = excluded.ai_evaluation_json,
      raw_ai_evaluation_json = excluded.raw_ai_evaluation_json,
      attributes_json = excluded.attributes_json,
      model = excluded.model,
      prompt_version = excluded.prompt_version,
      analyzed_at = excluded.analyzed_at,
      updated_at = excluded.updated_at
  `);

  const getCallAnalysisResultStatement = database.prepare(`
    SELECT
      call_id AS callId,
      run_id AS runId,
      status,
      transcript_by_roles_json AS transcriptByRolesJson,
      full_transcript_text AS fullTranscriptText,
      ai_evaluation_json AS aiEvaluationJson,
      raw_ai_evaluation_json AS rawAiEvaluationJson,
      attributes_json AS attributesJson,
      model,
      prompt_version AS promptVersion,
      analyzed_at AS analyzedAt,
      updated_at AS updatedAt
    FROM call_analysis_results
    WHERE call_id = ?
  `);

  return {
    async getCallAnalysisResult(callId) {
      const row = getCallAnalysisResultStatement.get(callId) as
        | {
            callId: string;
            runId: string;
            status: "ready";
            transcriptByRolesJson: string;
            fullTranscriptText: string;
            aiEvaluationJson: string;
            rawAiEvaluationJson: string;
            attributesJson: string;
            model: string;
            promptVersion: string;
            analyzedAt: string;
            updatedAt: string;
          }
        | undefined;

      if (!row) {
        return null;
      }

      const aiEvaluation = parseRequiredJson<Record<string, unknown>>(
        row.aiEvaluationJson,
        "call_analysis_results.ai_evaluation_json"
      );
      const rawAiEvaluation = parseRequiredJson<Record<string, unknown>>(
        row.rawAiEvaluationJson,
        "call_analysis_results.raw_ai_evaluation_json"
      );

      return {
        callId: row.callId,
        runId: row.runId,
        status: row.status,
        transcriptByRoles: parseRequiredJson<unknown[]>(
          row.transcriptByRolesJson,
          "call_analysis_results.transcript_by_roles_json"
        ),
        fullTranscriptText: row.fullTranscriptText,
        aiEvaluation,
        rawAiEvaluation,
        attributes: parseRequiredJson<Record<string, unknown>>(
          row.attributesJson,
          "call_analysis_results.attributes_json"
        ),
        model: row.model,
        promptVersion: row.promptVersion,
        analyzedAt: row.analyzedAt,
        updatedAt: row.updatedAt
      };
    },

    async getLatestCallAnalysisRuns(callIds) {
      const uniqueCallIds = Array.from(new Set(callIds.filter(Boolean)));
      if (uniqueCallIds.length === 0) {
        return [];
      }

      const rows: CallAnalysisRunSummary[] = [];
      for (const chunk of chunkArray(uniqueCallIds, 500)) {
        const placeholders = chunk.map(() => "?").join(", ");
        rows.push(
          ...(database
            .prepare(
              `SELECT
                call_id AS callId,
                status,
                started_at AS startedAt,
                finished_at AS finishedAt,
                model,
                prompt_version AS promptVersion,
                error_code AS errorCode,
                error_message AS errorMessage
              FROM (
                SELECT
                  call_analysis_runs.*,
                  ROW_NUMBER() OVER (
                    PARTITION BY call_id
                    ORDER BY started_at DESC, id DESC
                  ) AS row_number
                FROM call_analysis_runs
                WHERE call_id IN (${placeholders})
              )
              WHERE row_number = 1`
            )
            .all(...chunk) as CallAnalysisRunSummary[])
        );
      }

      return rows;
    },

    startCallAnalysisRun(input) {
      insertCallAnalysisRunStatement.run(input);
      return Promise.resolve();
    },

    saveCallAnalysisResult(input: CallAnalysisResultRecord) {
      upsertCallAnalysisResultStatement.run({
        callId: input.callId,
        runId: input.runId,
        status: input.status,
        transcriptByRolesJson: JSON.stringify(input.transcriptByRoles),
        fullTranscriptText: input.fullTranscriptText,
        aiEvaluationJson: JSON.stringify(input.aiEvaluation),
        rawAiEvaluationJson: JSON.stringify(input.rawAiEvaluation),
        attributesJson: JSON.stringify(input.attributes),
        model: input.model,
        promptVersion: input.promptVersion,
        analyzedAt: input.analyzedAt,
        updatedAt: input.updatedAt
      });
      return Promise.resolve();
    },

    finishCallAnalysisRun(input) {
      finishCallAnalysisRunStatement.run(input);
      return Promise.resolve();
    },

    failCallAnalysisRun(input) {
      failCallAnalysisRunStatement.run(input);
      return Promise.resolve();
    }
  };
}
