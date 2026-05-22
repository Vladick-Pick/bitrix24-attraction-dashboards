import assert from 'node:assert/strict'
import test from 'node:test'

import { evaluatePreflight, parseArgs } from './session-preflight.mjs'

function makeRunner(responses) {
  const calls = []

  return {
    calls,
    run(args) {
      const key = args.join(' ')
      calls.push(key)
      const response = responses[key]

      if (!response) {
        return {
          status: 1,
          output: `unexpected git command: ${key}`,
        }
      }

      return {
        status: response.status ?? 0,
        output: response.output ?? '',
        error: response.error,
      }
    },
  }
}

function baseResponses(overrides = {}) {
  return {
    'rev-parse --is-inside-work-tree': { output: 'true\n' },
    'rev-parse --show-toplevel': { output: '/repo\n' },
    'fetch --prune origin': { output: '' },
    'remote get-url origin': { output: 'git@github.com:owner/repo.git\n' },
    'rev-parse --verify --quiet origin/main': { output: 'abc123\n' },
    'branch --show-current': { output: 'codex/example\n' },
    'status --short': { output: '' },
    'rev-list --left-right --count origin/main...HEAD': { output: '0\t1\n' },
    'rev-parse --abbrev-ref --symbolic-full-name @{u}': {
      status: 1,
      output: 'fatal: no upstream configured\n',
    },
    'cherry -v origin/main HEAD': { output: '+ 1234567 work\n' },
    'status --branch --short': { output: '## codex/example\n' },
    'worktree list --porcelain': { output: 'worktree /repo\nHEAD 1234567\nbranch refs/heads/codex/example\n' },
    ...overrides,
  }
}

function failedCheckNames(result) {
  return result.checks
    .filter((check) => check.status === 'fail')
    .map((check) => check.name)
}

test('fails on main and dirty working tree by default', () => {
  const runner = makeRunner(
    baseResponses({
      'branch --show-current': { output: 'main\n' },
      'status --short': { output: ' M apps/web/src/file.tsx\n?? tmp.txt\n' },
      'rev-list --left-right --count origin/main...HEAD': { output: '0\t0\n' },
      'cherry -v origin/main HEAD': { output: '' },
      'status --branch --short': { output: '## main...origin/main\n M apps/web/src/file.tsx\n?? tmp.txt\n' },
    }),
  )

  const result = evaluatePreflight(parseArgs([]), runner.run)

  assert.equal(result.ok, false)
  assert.deepEqual(failedCheckNames(result), [
    'Task branch is safe for implementation',
    'Working tree is clean',
  ])
})

test('fails when the task branch is behind origin main', () => {
  const runner = makeRunner(
    baseResponses({
      'rev-list --left-right --count origin/main...HEAD': { output: '2\t1\n' },
    }),
  )

  const result = evaluatePreflight(parseArgs([]), runner.run)

  assert.equal(result.ok, false)
  assert.deepEqual(failedCheckNames(result), ['Branch contains latest base'])
  assert.match(
    result.checks.find((check) => check.name === 'Branch contains latest base').detail,
    /behind origin\/main by 2 commit/,
  )
})

test('passes on a clean current task branch and fetches by default', () => {
  const runner = makeRunner(baseResponses())

  const result = evaluatePreflight(parseArgs([]), runner.run)

  assert.equal(result.ok, true)
  assert.equal(result.failures.length, 0)
  assert.deepEqual(result.warnings.map((check) => check.name), ['Current branch upstream'])
  assert.ok(runner.calls.includes('fetch --prune origin'))
})

test('supports explicit dirty continuation with a warning', () => {
  const runner = makeRunner(
    baseResponses({
      'status --short': { output: ' M apps/api/src/file.ts\n' },
      'status --branch --short': { output: '## codex/example\n M apps/api/src/file.ts\n' },
    }),
  )

  const result = evaluatePreflight(parseArgs(['--allow-dirty']), runner.run)

  assert.equal(result.ok, true)
  assert.equal(result.failures.length, 0)
  assert.ok(result.warnings.some((check) => check.name === 'Working tree is clean'))
})

test('parses base, fetch, and output flags', () => {
  const options = parseArgs(['--', '--base', 'upstream/main', '--no-fetch', '--json', '--allow-main'])

  assert.equal(options.base, 'upstream/main')
  assert.equal(options.fetch, false)
  assert.equal(options.json, true)
  assert.equal(options.allowMain, true)
})
