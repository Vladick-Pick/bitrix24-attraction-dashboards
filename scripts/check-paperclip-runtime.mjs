#!/usr/bin/env node
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const timeoutMs = 30_000

function sanitize(value) {
  return String(value)
    .replace(/gh[opsu]_[A-Za-z0-9_]+/g, 'gh*_********')
    .replace(/(token:\s*)[A-Za-z0-9_.*-]+/gi, '$1[redacted]')
    .replace(/(api[-_]?key[=:]\s*)[^\s]+/gi, '$1[redacted]')
}

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout: timeoutMs,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  return {
    status: result.status,
    error: result.error,
    output: sanitize(`${result.stdout ?? ''}${result.stderr ?? ''}`).trim(),
  }
}

function shortOutput(output) {
  return output.split('\n').filter(Boolean).slice(0, 4).join('\n')
}

const configPaths = [
  process.env.CODEX_HOME ? join(process.env.CODEX_HOME, 'config.toml') : null,
  join(homedir(), '.codex', 'config.toml'),
].filter((path, index, paths) => path && paths.indexOf(path) === index)

const configText = configPaths
  .filter((path) => existsSync(path))
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n')

const checks = []

function pass(name, note = '') {
  checks.push({ name, status: 'pass', note })
}

function fail(name, note) {
  checks.push({ name, status: 'fail', note })
}

function commandCheck(name, command, args, remediation) {
  const result = run(command, args)
  if (result.status === 0) {
    pass(name, shortOutput(result.output))
    return
  }

  const details = [result.error?.message, shortOutput(result.output), remediation]
    .filter(Boolean)
    .join('\n')
  fail(name, details)
}

function commandOutputCheck(name, command, args, validate, remediation) {
  const result = run(command, args)
  const output = result.output.trim()

  if (result.status === 0 && validate(output)) {
    pass(name, shortOutput(output))
    return
  }

  const details = [result.error?.message, shortOutput(output), remediation]
    .filter(Boolean)
    .join('\n')
  fail(name, details)
}

if (configText.includes('[mcp_servers.context7]')) {
  pass('Context7 MCP is configured')
} else {
  fail(
    'Context7 MCP is configured',
    'Add [mcp_servers.context7] to the Codex config before dependency-sensitive work.',
  )
}

if (configText.includes('[mcp_servers.playwright]')) {
  pass('Playwright MCP is configured')
} else {
  fail(
    'Playwright MCP is configured',
    'Add [mcp_servers.playwright] to the Codex config before UI verification work.',
  )
}

commandCheck(
  'GitHub CLI is authenticated',
  'gh',
  ['auth', 'status'],
  'Install/authenticate gh or provide another approved GitHub publish path.',
)

commandCheck(
  'GitHub repo metadata is accessible',
  'gh',
  ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'],
  'Grant repo read/write access before claiming PR, merge, or deploy readiness.',
)

commandOutputCheck(
  'GitHub repo push permission is available',
  'gh',
  ['repo', 'view', '--json', 'viewerPermission', '--jq', '.viewerPermission'],
  (output) => ['ADMIN', 'MAINTAIN', 'WRITE'].includes(output.toUpperCase()),
  'Grant GitHub write permission before claiming PR, merge, deploy, or branch publish readiness.',
)

commandCheck(
  'Git origin main is readable',
  'git',
  ['ls-remote', '--heads', 'origin', 'main'],
  'Configure repository remote credentials before implementation or verification work.',
)

commandCheck(
  'Context7 MCP package resolves',
  'npx',
  ['--yes', '@upstash/context7-mcp', '--help'],
  'Fix npm/npx access or preinstall the Context7 MCP package in the agent runtime.',
)

commandCheck(
  'Playwright MCP package resolves',
  'npx',
  ['--yes', '@playwright/mcp@latest', '--help'],
  'Fix npm/npx access and install browser system dependencies before visual checks.',
)

const playwrightTempDir = mkdtempSync(join(tmpdir(), 'paperclip-playwright-'))
try {
  commandCheck(
    'Playwright Chromium can launch',
    'npx',
    [
      '--yes',
      'playwright@latest',
      'screenshot',
      '--browser',
      'chromium',
      'about:blank',
      join(playwrightTempDir, 'blank.png'),
    ],
    'Install Playwright browsers and system dependencies before claiming browser or visual verification.',
  )
} finally {
  rmSync(playwrightTempDir, { force: true, recursive: true })
}

for (const check of checks) {
  const prefix = check.status === 'pass' ? 'PASS' : 'FAIL'
  console.log(`${prefix} ${check.name}`)
  if (check.note) {
    console.log(
      check.note
        .split('\n')
        .map((line) => `  ${line}`)
        .join('\n'),
    )
  }
}

const failed = checks.filter((check) => check.status === 'fail')
if (failed.length > 0) {
  console.error(`\n${failed.length} Paperclip runtime check(s) failed.`)
  process.exit(1)
}

console.log('\nPaperclip runtime checks passed.')
