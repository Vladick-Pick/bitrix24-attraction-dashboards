import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
import assert from "node:assert/strict";

import {
  buildWorkloadLocalCounts,
  summarizeWorkloadBitrixRows
} from "./bitrix-readonly-proof.mjs";

const require = createRequire(new URL("../../../apps/api/package.json", import.meta.url));
const Database = require("better-sqlite3");

test("buildWorkloadLocalCounts scopes leadgen workload rows by category, manager, and range", () => {
  const directory = mkdtempSync(join(tmpdir(), "bitrix-proof-"));
  const dbPath = join(directory, "leadgen.db");
  const db = new Database(dbPath);

  try {
    db.exec(`
      CREATE TABLE deal_snapshots (
        id TEXT PRIMARY KEY,
        category_id TEXT,
        assigned_by_id TEXT,
        date_create TEXT NOT NULL
      );
      CREATE TABLE activity_snapshots (
        id TEXT PRIMARY KEY,
        owner_type_id TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        provider_id TEXT,
        responsible_id TEXT,
        created_time TEXT NOT NULL,
        completed INTEGER NOT NULL,
        completed_time TEXT
      );
      CREATE TABLE activity_binding_snapshots (
        activity_id TEXT NOT NULL,
        owner_type_id TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        PRIMARY KEY (activity_id, owner_type_id, owner_id)
      );
      CREATE TABLE stage_history_snapshots (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        category_id TEXT,
        created_time TEXT NOT NULL
      );
      CREATE TABLE call_snapshots (
        id TEXT PRIMARY KEY,
        crm_activity_id TEXT,
        portal_user_id TEXT,
        call_start_date TEXT NOT NULL,
        crm_entity_type TEXT,
        crm_entity_id TEXT
      );
    `);

    db.prepare(
      "INSERT INTO deal_snapshots (id, category_id, assigned_by_id, date_create) VALUES (?, ?, ?, ?)"
    ).run("100", "28", "8244", "2026-05-12T10:00:00+03:00");
    db.prepare(
      "INSERT INTO deal_snapshots (id, category_id, assigned_by_id, date_create) VALUES (?, ?, ?, ?)"
    ).run("101", "28", "8244", "2026-05-18T10:00:00+03:00");
    db.prepare(
      "INSERT INTO deal_snapshots (id, category_id, assigned_by_id, date_create) VALUES (?, ?, ?, ?)"
    ).run("102", "10", "8244", "2026-05-12T10:00:00+03:00");
    db.prepare(
      "INSERT INTO deal_snapshots (id, category_id, assigned_by_id, date_create) VALUES (?, ?, ?, ?)"
    ).run("103", "28", "9999", "2026-05-12T10:00:00+03:00");

    db.prepare(
      "INSERT INTO activity_snapshots (id, owner_type_id, owner_id, provider_id, responsible_id, created_time, completed, completed_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run("200", "2", "100", "VOXIMPLANT_CALL", "8244", "2026-05-13T10:00:00+03:00", 1, "2026-05-13T10:30:00+03:00");
    db.prepare(
      "INSERT INTO activity_snapshots (id, owner_type_id, owner_id, provider_id, responsible_id, created_time, completed, completed_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run("201", "2", "100", "CRM_TASK", "8244", "2026-05-10T10:00:00+03:00", 1, "2026-05-14T10:30:00+03:00");
    db.prepare(
      "INSERT INTO activity_snapshots (id, owner_type_id, owner_id, provider_id, responsible_id, created_time, completed, completed_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run("202", "2", "101", "VOXIMPLANT_CALL", "8244", "2026-05-13T10:00:00+03:00", 0, null);

    db.prepare(
      "INSERT INTO activity_binding_snapshots (activity_id, owner_type_id, owner_id) VALUES (?, ?, ?)"
    ).run("200", "2", "100");
    db.prepare(
      "INSERT INTO activity_binding_snapshots (activity_id, owner_type_id, owner_id) VALUES (?, ?, ?)"
    ).run("202", "2", "101");

    db.prepare(
      "INSERT INTO stage_history_snapshots (id, owner_id, category_id, created_time) VALUES (?, ?, ?, ?)"
    ).run("300", "100", "28", "2026-05-12T11:00:00+03:00");
    db.prepare(
      "INSERT INTO stage_history_snapshots (id, owner_id, category_id, created_time) VALUES (?, ?, ?, ?)"
    ).run("301", "101", "28", "2026-05-12T11:00:00+03:00");

    db.prepare(
      "INSERT INTO call_snapshots (id, crm_activity_id, portal_user_id, call_start_date, crm_entity_type, crm_entity_id) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("400", "200", "8244", "2026-05-13T10:00:00+03:00", "DEAL", "100");
    db.prepare(
      "INSERT INTO call_snapshots (id, crm_activity_id, portal_user_id, call_start_date, crm_entity_type, crm_entity_id) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("401", null, "8244", "2026-05-14T10:00:00+03:00", null, null);
    db.prepare(
      "INSERT INTO call_snapshots (id, crm_activity_id, portal_user_id, call_start_date, crm_entity_type, crm_entity_id) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("402", "202", "8244", "2026-05-14T10:00:00+03:00", "DEAL", "101");

    const counts = buildWorkloadLocalCounts({
      localDb: dbPath,
      categoryId: "28",
      managerIds: ["8244"],
      rangeFrom: "2026-05-11T00:00:00.000+03:00",
      rangeTo: "2026-05-17T23:59:59.999+03:00"
    });

    assert.deepEqual(counts, {
      scopedDealIds: ["100"],
      counts: {
        dealsInRange: 1,
        activitiesForDealsTotal: 2,
        activitiesCreatedInRange: 1,
        activitiesCompletedInRange: 2,
        callActivitiesForDeals: 1,
        activityBindingsForCallActivities: 1,
        stageHistoryForDealsTotal: 1,
        stageHistoryForDealsInRange: 1,
        callsByActivity: 1,
        supplementalCallsInRange: 3,
        callsUnion: 3
      }
    });
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("summarizeWorkloadBitrixRows deduplicates rows by persisted keys and accepts boolean completed values", () => {
  const summary = summarizeWorkloadBitrixRows({
    dealRows: [{ ID: "100" }],
    activityRows: [
      {
        ID: "200",
        CREATED: "2026-05-13T10:00:00+03:00",
        COMPLETED: true,
        COMPLETED_DATE: "2026-05-13T10:30:00+03:00",
        PROVIDER_ID: "VOXIMPLANT_CALL"
      },
      {
        ID: "200",
        CREATED: "2026-05-13T10:00:00+03:00",
        COMPLETED: true,
        COMPLETED_DATE: "2026-05-13T10:30:00+03:00",
        PROVIDER_ID: "VOXIMPLANT_CALL"
      }
    ],
    bindingRows: [
      { activityId: "200", entityTypeId: "2", entityId: "100" },
      { activityId: "200", entityTypeId: "2", entityId: "100" }
    ],
    stageHistoryRows: [{ ID: "300", CREATED_TIME: "2026-05-13T11:00:00+03:00" }],
    callRowsByActivity: [{ ID: "400" }, { ID: "400" }],
    supplementalCallRows: [{ ID: "400" }, { ID: "401" }],
    rangeFrom: "2026-05-11T00:00:00.000+03:00",
    rangeTo: "2026-05-17T23:59:59.999+03:00"
  });

  assert.deepEqual(summary.counts, {
    dealsInRange: 1,
    activitiesForDealsTotal: 1,
    activitiesCreatedInRange: 1,
    activitiesCompletedInRange: 1,
    callActivitiesForDeals: 1,
    activityBindingsForCallActivities: 1,
    stageHistoryForDealsTotal: 1,
    stageHistoryForDealsInRange: 1,
    callsByActivity: 1,
    supplementalCallsInRange: 2,
    callsUnion: 2
  });
});
