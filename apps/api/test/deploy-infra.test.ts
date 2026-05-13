import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = resolve(fileURLToPath(new URL("../../../", import.meta.url)));

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

describe("production deployment infrastructure", () => {
  it("keeps native module build dependencies in the Docker build stage", () => {
    const dockerfile = readRepoFile("Dockerfile");
    const buildStage = dockerfile.split("FROM node:24-bookworm-slim AS runner")[0];
    const runnerStage = dockerfile.split("FROM node:24-bookworm-slim AS runner")[1] ?? "";

    expect(buildStage).toMatch(/apt-get update && apt-get install -y --no-install-recommends/);
    expect(buildStage).toMatch(/\bpython3\b/);
    expect(buildStage).toMatch(/\bmake\b/);
    expect(buildStage).toContain("g++");
    expect(buildStage).toContain("rm -rf /var/lib/apt/lists/*");
    expect(runnerStage).not.toMatch(/apt-get install[\s\S]*(python3|make|g\+\+)/);
  });

  it("stamps and verifies the deployed image revision", () => {
    const dockerfile = readRepoFile("Dockerfile");
    const deployScript = readRepoFile("scripts/deploy-production.sh");
    const rollbackScript = readRepoFile("scripts/rollback-production.sh");
    const deployWorkflow = readRepoFile(".github/workflows/deploy-production.yml");

    expect(dockerfile).toContain("ARG SOURCE_REVISION=unknown");
    expect(dockerfile).toContain("/app/.build-revision");
    expect(deployScript).toContain('--build-arg SOURCE_REVISION="$ref"');
    expect(deployScript).toContain(".docker-source-revision");
    expect(deployScript).toContain("verify_image_revision");
    expect(deployScript).toContain("cat /app/.build-revision");
    expect(rollbackScript).toContain('--build-arg SOURCE_REVISION="$resolved_ref"');
    expect(rollbackScript).toContain(".docker-source-revision");
    expect(rollbackScript).toContain("cat /app/.build-revision");
    expect(deployWorkflow).toContain("-o ServerAliveInterval=15");
    expect(deployWorkflow).toContain("-o ServerAliveCountMax=12");
  });

  it("restores the Caddy reverse proxy before public health verification", () => {
    const deployScript = readRepoFile("scripts/deploy-production.sh");

    expect(deployScript).toContain("ensure_reverse_proxy");
    expect(deployScript).toContain("ensure_caddy_reverse_proxy");
    expect(deployScript).toContain("reverse_proxy 127.0.0.1:8787");
    expect(deployScript).toContain("caddy validate --config");
    expect(deployScript).toContain("systemctl reload caddy");
    const verifyRuntime = deployScript.slice(
      deployScript.indexOf("verify_runtime()"),
      deployScript.indexOf("main()"),
    );

    expect(verifyRuntime.indexOf("ensure_reverse_proxy")).toBeGreaterThan(-1);
    expect(verifyRuntime.indexOf("ensure_reverse_proxy")).toBeLessThan(
      verifyRuntime.indexOf("wait_for_http_code \"$HEALTH_URL\" 200"),
    );
  });

  it("fails runtime verification when reverse proxy restoration fails", () => {
    const deployScript = readRepoFile("scripts/deploy-production.sh");
    const verifyRuntime = deployScript.slice(
      deployScript.indexOf("verify_runtime()"),
      deployScript.indexOf("main()"),
    );
    const ensureReverseProxy = deployScript.slice(
      deployScript.indexOf("ensure_reverse_proxy()"),
      deployScript.indexOf("wait_for_http_code()"),
    );

    expect(verifyRuntime).toContain("if ! ensure_reverse_proxy; then");
    expect(verifyRuntime).toContain("return 1");
    expect(ensureReverseProxy).toContain("systemctl start nginx");
    expect(ensureReverseProxy).not.toContain("systemctl start nginx\n    return 0");
    expect(ensureReverseProxy).not.toContain(
      "log \"Warning: no supported reverse proxy found; public health check may fail\"\n  return 1",
    );
  });

  it("installs and configures Caddy when no supported reverse proxy exists", () => {
    const deployScript = readRepoFile("scripts/deploy-production.sh");
    const ensureReverseProxy = deployScript.slice(
      deployScript.indexOf("ensure_reverse_proxy()"),
      deployScript.indexOf("wait_for_http_code()"),
    );

    expect(deployScript).toContain("install_caddy_reverse_proxy");
    expect(deployScript).toContain("apt-get install -y --no-install-recommends caddy");
    expect(deployScript).toContain("/etc/apt/sources.list.d/caddy-stable.list");
    expect(ensureReverseProxy).toMatch(
      /if ! install_caddy_reverse_proxy; then\s+return 1\s+fi\s+if ! ensure_caddy_reverse_proxy "\$public_host"; then\s+return 1\s+fi/,
    );
    expect(ensureReverseProxy).not.toContain(
      "log \"Warning: no supported reverse proxy found; public health check may fail\"",
    );
  });

  it("fails runtime verification when non-proxy critical checks fail", () => {
    const deployScript = readRepoFile("scripts/deploy-production.sh");
    const verifyRuntime = deployScript.slice(
      deployScript.indexOf("verify_runtime()"),
      deployScript.indexOf("main()"),
    );

    expect(verifyRuntime).toMatch(
      /if ! verify_image_revision "\$expected_ref" "\$allow_missing_revision"; then\s+return 1\s+fi/,
    );
    expect(verifyRuntime).toMatch(/if ! wait_for_http_code "\$HEALTH_URL" 200; then\s+return 1\s+fi/);
    expect(verifyRuntime).toMatch(
      /if ! app_uid="\$\(docker compose -p "\$COMPOSE_PROJECT" exec -T app id -u\)"; then\s+return 1\s+fi/,
    );
  });
});
