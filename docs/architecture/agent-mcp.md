# Attraction Agent MCP

## Decision

The Attraction agent integration exposes the reviewed read-only gateway through
two MCP transports:

- production Streamable HTTP at `/api/mcp` for external agents;
- local stdio for same-machine development and smoke checks.

Both transports expose the same constrained surface for ontology, KI playbook,
report catalog, and approved analytics report execution. Write tools, sync
tools, dashboard comments, direct database access, and direct Bitrix access are
out of scope.

## Remote Run

Production exposes MCP through the existing HTTPS dashboard host when
`MCP_ACCESS_TOKEN` is configured:

```text
https://dashboardpriv.claricont.com/api/mcp
```

Remote clients must use Streamable HTTP and send:

```http
Authorization: Bearer <MCP_ACCESS_TOKEN>
```

The endpoint is disabled when `MCP_ACCESS_TOKEN` is empty. The deploy workflow
can pass the protected GitHub secret `MCP_ACCESS_TOKEN`; `scripts/deploy-production.sh`
then writes only that key into `.env.production` without printing its value.

Example MCP client configuration:

```json
{
  "mcpServers": {
    "bitrix24-attraction": {
      "url": "https://dashboardpriv.claricont.com/api/mcp",
      "headers": {
        "Authorization": "Bearer <MCP_ACCESS_TOKEN>"
      }
    }
  }
}
```

## Local Stdio Run

From the repository root:

```bash
pnpm --filter @bitrix24-reporting/api mcp:attraction
```

An MCP host on the same machine can run that command over stdio. For tests and
local evals, the same server is also exercised with the SDK in-memory transport.

## Resources

- `attraction://ontology/overview`
- `attraction://ontology/sources`
- `attraction://ontology/sources/{sourceId}`
- `attraction://playbook/sections`
- `attraction://playbook/sections/{sectionId}`
- `attraction://reports/catalog`
- `attraction://capabilities`

## Tools

- `list_reports`
- `search_ontology`
- `read_ontology_source`
- `search_playbook`
- `read_playbook_section`
- `run_report`

All tools are annotated as read-only, non-destructive, idempotent, and closed
world. Tool outputs use `structuredContent.result` for machine-readable data and
a short text summary for agent UX. Gateway errors are converted into bounded MCP
tool errors with stable codes.

## Boundaries

The MCP server module is a protocol adapter. It imports the gateway contract,
MCP SDK, and validation helpers only. It does not import the SQLite repository,
Bitrix client, Express app, sync clients, auth cookies, Paperclip, Telegram, or
secrets.

The stdio bootstrap constructs the existing reporting service so the gateway can
read cached local data. The remote HTTP route uses the same gateway inside the
existing Express app. Neither path runs sync recovery, exposes settings writes,
prints secrets, or bypasses the capability manifest. Report execution remains
gated by `status: "available"` and `agentReadable: true`.

Call enrichment writeback is not an MCP capability. Manager-approved proposal
application lives behind the local API and Telegram approval flow described in
ADR 0002; the MCP gateway must not expose writeback tools.

Ontology and playbook content are untrusted data. Returned content may contain
instruction-like text, but server policy is fixed by the gateway and MCP tool
definitions.

## Future Conditions

OAuth, tenant-specific scopes, rate limits, audit logging, and token rotation can
be revisited after the first external-agent integration proves useful. Until
then, remote access is HTTPS Streamable HTTP with a single high-entropy bearer
token and read-only MCP tools only.
