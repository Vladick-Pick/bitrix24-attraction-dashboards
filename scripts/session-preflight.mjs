#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const timeoutMs = 30_000
const defaultBase = 'origin/main'

function sanitize(value) {
  return String(value)
    .replace(/gh[opsu]_[A-Za-z0-9_]+/g, 'gh*_********')
    .replace(/(token:\s*)[A-Za-z0-9_.*-]+/gi, '$1[redacted]')
    .replace(/(api[-_]?key[=:]\s*)[^\s]+/gi, '$1[redacted]')
    .replace(/(password[=:]\s*)[^\s]+/gi, '$1[redacted]')
}

function trimOutput(output) {
  return sanitize(output ?? '').trim()
}

function shortOutput(output, lines = 6) {
  return trimOutput(output).split('\n').filter(Boolean).slice(0, lines).join('\n')
}

function requireValue(argv, index, flag) {
  const value = argv[index + 1]
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`)
  }
  return value
}

export function parseArgs(argv, defaults = {}) {
  const options = {
    base: defaultBase,
    fetch: true,
    json: false,
    allowDirty: false,
    allowMain: false,
    cwd: process.cwd(),
    help: false,
    ...defaults,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--') {
      continue
    }

    if (arg === '--base') {
      options.base = requireValue(argv, index, '--base')
      index += 1
      continue
    }

    if (arg.startsWith('--base=')) {
      options.base = arg.slice('--base='.length)
      continue
    }

    if (arg === '--cwd') {
      options.cwd = requireValue(argv, index, '--cwd')
      index += 1
      continue
    }

    if (arg.startsWith('--cwd=')) {
      options.cwd = arg.slice('--cwd='.length)
      continue
    }

    if (arg === '--no-fetch') {
      options.fetch = false
      continue
    }

    if (arg === '--json') {
      options.json = true
      continue
    }

    if (arg === '--allow-dirty') {
      options.allowDirty = true
      continue
    }

    if (arg === '--allow-main') {
      options.allowMain = true
      continue
    }

    if (arg === '--help' || arg === '-h') {
      options.help = true
      continue
    }

    throw new Error(`Unknown option: ${arg}`)
  }

  return options
}

export function createGitRunner(cwd = process.cwd()) {
  return function runGit(args) {
    const result = spawnSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: timeoutMs,
    })

    return {
      status: typeof result.status === 'number' ? result.status : 1,
      error: result.error,
      output: trimOutput(`${result.stdout ?? ''}${result.stderr ?? ''}`),
    }
  }
}

function parseAheadBehind(output) {
  const match = trimOutput(output).match(/^(\d+)\s+(\d+)$/)
  if (!match) {
    return null
  }

  return {
    behind: Number(match[1]),
    ahead: Number(match[2]),
  }
}

function formatAheadBehind({ ahead, behind }) {
  const parts = []
  if (ahead > 0) {
    parts.push(`ahead by ${ahead} commit${ahead === 1 ? '' : 's'}`)
  }
  if (behind > 0) {
    parts.push(`behind by ${behind} commit${behind === 1 ? '' : 's'}`)
  }
  return parts.length > 0 ? parts.join(', ') : 'even'
}

function createCollector() {
  const checks = []

  return {
    checks,
    pass(name, detail = '') {
      checks.push({ name, status: 'pass', detail })
    },
    warn(name, detail, remediation = '') {
      checks.push({ name, status: 'warn', detail, remediation })
    },
    fail(name, detail, remediation = '') {
      checks.push({ name, status: 'fail', detail, remediation })
    },
  }
}

function commandFailureDetail(result) {
  return [result.error?.message, shortOutput(result.output)].filter(Boolean).join('\n')
}

function finish(options, checks, meta) {
  const failures = checks.filter((check) => check.status === 'fail')
  const warnings = checks.filter((check) => check.status === 'warn')

  return {
    ok: failures.length === 0,
    base: options.base,
    checks,
    failures,
    warnings,
    meta,
  }
}

export function evaluatePreflight(options, runGit = createGitRunner(options.cwd)) {
  const { checks, pass, warn, fail } = createCollector()
  const meta = {
    cwd: options.cwd,
    base: options.base,
  }

  const repo = runGit(['rev-parse', '--is-inside-work-tree'])
  if (repo.status !== 0 || trimOutput(repo.output) !== 'true') {
    fail(
      'Git repository detected',
      commandFailureDetail(repo) || 'Current directory is not inside a git work tree.',
      'Run this command from the repository root or a git worktree created for the task.',
    )
    return finish(options, checks, meta)
  }
  pass('Git repository detected')

  const root = runGit(['rev-parse', '--show-toplevel'])
  if (root.status === 0) {
    meta.root = trimOutput(root.output)
    pass('Repository root resolved', meta.root)
  } else {
    warn('Repository root resolved', commandFailureDetail(root), 'Use git status manually before editing.')
  }

  if (options.fetch) {
    const fetch = runGit(['fetch', '--prune', 'origin'])
    if (fetch.status === 0) {
      pass('Origin refs are fetched', shortOutput(fetch.output) || 'origin fetched')
    } else {
      fail(
        'Origin refs are fetched',
        commandFailureDetail(fetch),
        'Fix git remote read access, then run the preflight again before editing.',
      )
    }
  } else {
    warn(
      'Origin refs are fetched',
      'Skipped because --no-fetch was provided.',
      'Use --no-fetch only in an intentionally offline runtime after confirming refs were updated externally.',
    )
  }

  const origin = runGit(['remote', 'get-url', 'origin'])
  if (origin.status === 0 && trimOutput(origin.output)) {
    meta.origin = trimOutput(origin.output)
    pass('Origin remote exists', meta.origin)
  } else {
    fail(
      'Origin remote exists',
      commandFailureDetail(origin) || 'Remote origin is missing.',
      'Configure origin before starting repository work.',
    )
  }

  const base = runGit(['rev-parse', '--verify', '--quiet', options.base])
  const baseAvailable = base.status === 0
  if (baseAvailable) {
    pass('Base ref exists', options.base)
  } else {
    fail(
      'Base ref exists',
      commandFailureDetail(base) || `${options.base} is unavailable.`,
      'Fetch origin or choose a valid --base ref before continuing.',
    )
  }

  const branch = runGit(['branch', '--show-current'])
  const branchName = trimOutput(branch.output)
  meta.branch = branchName

  if (branch.status !== 0 || !branchName) {
    fail(
      'Task branch is safe for implementation',
      commandFailureDetail(branch) || 'Detached HEAD is not safe for ordinary implementation work.',
      'Create or switch to a named codex/<task-name> branch without discarding local changes.',
    )
  } else if (branchName === 'main' && !options.allowMain) {
    fail(
      'Task branch is safe for implementation',
      'Current branch is main.',
      'Create a codex/<task-name> branch from the updated base before implementation work.',
    )
  } else if (!branchName.startsWith('codex/')) {
    warn(
      'Task branch is safe for implementation',
      `Current branch is ${branchName}, not codex/<task-name>.`,
      'Use codex/<task-name> branches for normal agent implementation work.',
    )
  } else {
    pass('Task branch is safe for implementation', branchName)
  }

  const status = runGit(['status', '--short'])
  const shortStatus = trimOutput(status.output)
  if (status.status !== 0) {
    fail(
      'Working tree is clean',
      commandFailureDetail(status),
      'Inspect git status before editing.',
    )
  } else if (shortStatus && !options.allowDirty) {
    fail(
      'Working tree is clean',
      shortOutput(shortStatus),
      'Preserve existing user or agent work in a named branch and commit before starting new work.',
    )
  } else if (shortStatus) {
    warn(
      'Working tree is clean',
      shortOutput(shortStatus),
      'Allowed only because --allow-dirty was provided. Read git diff and confirm this is the same active task before editing.',
    )
  } else {
    pass('Working tree is clean')
  }

  if (baseAvailable) {
    const baseDivergence = runGit(['rev-list', '--left-right', '--count', `${options.base}...HEAD`])
    const parsed = parseAheadBehind(baseDivergence.output)

    if (baseDivergence.status !== 0 || !parsed) {
      fail(
        'Branch contains latest base',
        commandFailureDetail(baseDivergence) || `Could not parse divergence from ${options.base}.`,
        'Inspect the branch relationship manually before editing.',
      )
    } else if (parsed.behind > 0) {
      fail(
        'Branch contains latest base',
        `HEAD is behind ${options.base} by ${parsed.behind} commit${parsed.behind === 1 ? '' : 's'} and ahead by ${parsed.ahead}.`,
        'Do not overwrite work. Preserve local commits, then merge the latest base through a reviewed git operation.',
      )
    } else {
      meta.baseDivergence = parsed
      pass('Branch contains latest base', `${options.base}: ${formatAheadBehind(parsed)}`)
    }
  }

  const upstream = runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'])
  const upstreamName = trimOutput(upstream.output)
  if (upstream.status !== 0 || !upstreamName) {
    warn(
      'Current branch upstream',
      'No upstream is configured for the current branch.',
      'This is acceptable before first push; push the branch before PR/CI/deploy work.',
    )
  } else {
    meta.upstream = upstreamName
    const upstreamDivergence = runGit(['rev-list', '--left-right', '--count', `${upstreamName}...HEAD`])
    const parsed = parseAheadBehind(upstreamDivergence.output)
    if (upstreamDivergence.status !== 0 || !parsed) {
      warn(
        'Current branch upstream',
        commandFailureDetail(upstreamDivergence) || `Could not parse divergence from ${upstreamName}.`,
        'Inspect git status --branch before claiming branch sync.',
      )
    } else if (parsed.behind > 0) {
      fail(
        'Current branch upstream',
        `HEAD is behind ${upstreamName} by ${parsed.behind} commit${parsed.behind === 1 ? '' : 's'} and ahead by ${parsed.ahead}.`,
        'Inspect remote branch changes and merge without discarding local work.',
      )
    } else {
      meta.upstreamDivergence = parsed
      pass('Current branch upstream', `${upstreamName}: ${formatAheadBehind(parsed)}`)
    }
  }

  if (baseAvailable) {
    const cherry = runGit(['cherry', '-v', options.base, 'HEAD'])
    const entries = trimOutput(cherry.output).split('\n').filter(Boolean)
    if (cherry.status !== 0) {
      warn(
        'Branch unique patch review',
        commandFailureDetail(cherry),
        'Inspect git log manually before deciding whether the branch still has unique work.',
      )
    } else if (entries.length > 0 && entries.every((line) => line.startsWith('-'))) {
      warn(
        'Branch unique patch review',
        'All branch commits appear patch-equivalent to the base.',
        'Start a fresh branch from the updated base unless this is an intentional audit branch.',
      )
    } else {
      pass('Branch unique patch review', entries.length === 0 ? 'No unique commits yet.' : `${entries.length} unique patch entry found.`)
    }
  }

  const branchStatus = runGit(['status', '--branch', '--short'])
  if (branchStatus.status === 0) {
    meta.status = trimOutput(branchStatus.output)
    pass('Branch status captured', shortOutput(branchStatus.output))
  } else {
    warn('Branch status captured', commandFailureDetail(branchStatus), 'Run git status --branch --short manually.')
  }

  const worktrees = runGit(['worktree', 'list', '--porcelain'])
  if (worktrees.status === 0) {
    meta.worktrees = trimOutput(worktrees.output)
    pass('Worktree list captured', shortOutput(worktrees.output, 10))
  } else {
    warn('Worktree list captured', commandFailureDetail(worktrees), 'Run git worktree list manually.')
  }

  return finish(options, checks, meta)
}

function printHuman(result) {
  for (const check of result.checks) {
    const prefix = check.status.toUpperCase()
    console.log(`${prefix} ${check.name}`)
    if (check.detail) {
      console.log(
        check.detail
          .split('\n')
          .map((line) => `  ${line}`)
          .join('\n'),
      )
    }
    if (check.remediation) {
      console.log(`  Next: ${check.remediation}`)
    }
  }

  if (result.ok) {
    const warningText =
      result.warnings.length > 0
        ? ` with ${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}`
        : ''
    console.log(`\nSession preflight passed${warningText}.`)
    return
  }

  console.error(
    `\nSession preflight failed: ${result.failures.length} failure${result.failures.length === 1 ? '' : 's'}, ${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}.`,
  )
}

function usage() {
  return `Usage: pnpm session:preflight [--base origin/main] [--no-fetch] [--json]

Checks that a new Codex or Paperclip work session is based on the latest visible project state.

Options:
  --base <ref>      Base ref that must not be ahead of HEAD. Default: origin/main.
  --no-fetch        Skip git fetch --prune origin. Use only in intentionally offline runtimes.
  --allow-dirty     Permit dirty worktree only when continuing the same active task after reading git diff.
  --allow-main      Permit main only for read-only or emergency maintenance checks.
  --cwd <path>      Repository path to check.
  --json            Print machine-readable result.
  -h, --help        Show this help.
`
}

function isDirectRun() {
  return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
}

if (isDirectRun()) {
  try {
    const options = parseArgs(process.argv.slice(2))
    if (options.help) {
      console.log(usage())
      process.exit(0)
    }

    const result = evaluatePreflight(options)
    if (options.json) {
      console.log(JSON.stringify(result, null, 2))
    } else {
      printHuman(result)
    }
    process.exit(result.ok ? 0 : 1)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(2)
  }
}
