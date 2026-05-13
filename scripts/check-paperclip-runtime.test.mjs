import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const scriptPath = resolve('scripts/check-paperclip-runtime.mjs')

function writeExecutable(directory, name, body) {
  const path = join(directory, name)
  writeFileSync(path, body)
  chmodSync(path, 0o755)
}

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), 'paperclip-runtime-test-'))
  const bin = join(root, 'bin')
  const codexHome = join(root, 'codex')
  return { root, bin, codexHome }
}

function prepareFixture() {
  const fixture = createFixture()
  mkdirSync(fixture.bin, { recursive: true })
  mkdirSync(fixture.codexHome, { recursive: true })
  writeFileSync(
    join(fixture.codexHome, 'config.toml'),
    '[mcp_servers.context7]\ncommand = "npx"\n\n[mcp_servers.playwright]\ncommand = "npx"\n',
  )

  writeExecutable(
    fixture.bin,
    'gh',
    `#!/usr/bin/env sh
if [ "$1 $2" = "auth status" ]; then
  echo "Logged in"
  exit 0
fi
if [ "$1 $2" = "repo view" ]; then
  case "$*" in
    *viewerPermission*) echo "\${FAKE_GH_PERMISSION:-WRITE}" ;;
    *nameWithOwner*) echo "owner/repo" ;;
    *) echo "owner/repo" ;;
  esac
  exit 0
fi
echo "unexpected gh $*" >&2
exit 1
`,
  )

  writeExecutable(
    fixture.bin,
    'git',
    `#!/usr/bin/env sh
if [ "$1" = "ls-remote" ]; then
  echo "abc123 refs/heads/main"
  exit 0
fi
echo "unexpected git $*" >&2
exit 1
`,
  )

  writeExecutable(
    fixture.bin,
    'npx',
    `#!/usr/bin/env sh
case "$*" in
  *"@upstash/context7-mcp"*)
    echo "Usage: context7-mcp"
    exit 0
    ;;
  *"@playwright/mcp@latest"*)
    echo "Usage: Playwright MCP"
    exit 0
    ;;
  *"playwright@latest screenshot"*)
    if [ "\${FAKE_PLAYWRIGHT_SCREENSHOT:-ok}" = "fail" ]; then
      echo "error while loading shared libraries: libatk-1.0.so.0" >&2
      exit 1
    fi
    last=""
    for arg do
      last="$arg"
    done
    touch "$last"
    echo "screenshot ok"
    exit 0
    ;;
esac
echo "unexpected npx $*" >&2
exit 1
`,
  )

  return fixture
}

function runCheck(fixture, env = {}) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd: resolve('.'),
    encoding: 'utf8',
    env: {
      ...process.env,
      CODEX_HOME: fixture.codexHome,
      PATH: `${fixture.bin}:${process.env.PATH ?? ''}`,
      ...env,
    },
  })
}

test('fails when GitHub repo access is read-only', () => {
  const fixture = prepareFixture()
  try {
    const result = runCheck(fixture, { FAKE_GH_PERMISSION: 'READ' })
    const output = `${result.stdout}\n${result.stderr}`

    assert.notEqual(result.status, 0)
    assert.match(output, /FAIL GitHub repo push permission is available/)
    assert.match(output, /READ/)
  } finally {
    rmSync(fixture.root, { force: true, recursive: true })
  }
})

test('fails when Playwright package resolves but Chromium cannot launch', () => {
  const fixture = prepareFixture()
  try {
    const result = runCheck(fixture, {
      FAKE_GH_PERMISSION: 'WRITE',
      FAKE_PLAYWRIGHT_SCREENSHOT: 'fail',
    })
    const output = `${result.stdout}\n${result.stderr}`

    assert.notEqual(result.status, 0)
    assert.match(output, /FAIL Playwright Chromium can launch/)
    assert.match(output, /libatk-1\.0\.so\.0/)
  } finally {
    rmSync(fixture.root, { force: true, recursive: true })
  }
})
