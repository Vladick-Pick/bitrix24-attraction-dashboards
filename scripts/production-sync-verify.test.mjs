import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const scriptPath = new URL("./production-sync-verify.sh", import.meta.url);
const workflowPath = new URL("../.github/workflows/production-sync-verify.yml", import.meta.url);

function runValidation(env) {
  return spawnSync("bash", [scriptPath.pathname], {
    env: {
      PATH: process.env.PATH,
      PRODUCTION_SYNC_VERIFY_MODE: "validate",
      PAPERCLIP_ISSUE: "BIT-84",
      EXPECTED_COMMIT: "1234567",
      ...env
    },
    encoding: "utf8"
  });
}

test("leadgen validation accepts category 28 workload inputs without attraction deal fields", () => {
  const result = runValidation({
    MODULE: "leadgen",
    CATEGORY_ID: "28",
    RANGE_FROM: "2026-05-11T00:00:00.000Z",
    RANGE_TO: "2026-05-17T23:59:59.999Z"
  });

  assert.equal(result.status, 0, result.stderr);
});

test("attraction validation still requires exact deal, stage, and field inputs", () => {
  const result = runValidation({
    MODULE: "attraction",
    DEAL_IDS: "156080,156184",
    STAGE_ID: "C10:UC_EA3R76",
    FIELD_ID: "UF_CRM_1776949411825"
  });

  assert.equal(result.status, 0, result.stderr);
});

test("workflow exposes leadgen production operation inputs", () => {
  const workflow = readFileSync(workflowPath, "utf8");

  assert.match(workflow, /- leadgen/);
  assert.match(workflow, /category_id:/);
  assert.match(workflow, /range_from:/);
  assert.match(workflow, /range_to:/);
  assert.match(workflow, /2026-05-11T00:00:00\.000Z/);
  assert.match(workflow, /2026-05-17T23:59:59\.999Z/);
});
