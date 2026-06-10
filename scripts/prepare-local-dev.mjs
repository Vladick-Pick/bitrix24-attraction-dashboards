import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ENV_EXAMPLE_PATH = resolve(ROOT_DIR, '.env.example')
const ENV_PATH = resolve(ROOT_DIR, '.env')
const WEB_ENV_PATH = resolve(ROOT_DIR, 'apps/web/.env.local')

function parseEnv(content) {
  return content
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .reduce((entries, line) => {
      const separatorIndex = line.indexOf('=')
      const key = line.slice(0, separatorIndex).trim()
      const value = line.slice(separatorIndex + 1).trim()

      if (key) {
        entries[key] = value
      }

      return entries
    }, {})
}

function upsertEnvValue(content, key, value) {
  const lines = content.split(/\r?\n/u)
  const entry = `${key}=${value}`
  const lineIndex = lines.findIndex((line) => line.startsWith(`${key}=`))

  if (lineIndex >= 0) {
    lines[lineIndex] = entry
  } else {
    if (lines.at(-1)?.trim()) {
      lines.push('')
    }

    lines.push(entry)
  }

  return `${lines.join('\n').replace(/\n*$/u, '')}\n`
}

export function prepareLocalDev() {
  let createdEnv = false

  if (!existsSync(ENV_PATH)) {
    copyFileSync(ENV_EXAMPLE_PATH, ENV_PATH)
    createdEnv = true
  }

  const envSource = readFileSync(ENV_PATH, 'utf8')
  const env = parseEnv(envSource)
  const apiPort = env.API_PORT || '8787'
  const apiTarget = `http://127.0.0.1:${apiPort}`

  mkdirSync(dirname(WEB_ENV_PATH), { recursive: true })

  const existingWebEnv = existsSync(WEB_ENV_PATH)
    ? readFileSync(WEB_ENV_PATH, 'utf8')
    : ''
  const nextWebEnv = upsertEnvValue(
    upsertEnvValue(existingWebEnv, 'VITE_API_BASE_URL', ''),
    'VITE_DEV_API_TARGET',
    apiTarget,
  )

  if (nextWebEnv !== existingWebEnv) {
    writeFileSync(WEB_ENV_PATH, nextWebEnv, 'utf8')
  }

  const bitrixConfigured =
    env.BITRIX24_PORTAL_HOST &&
    env.BITRIX24_PORTAL_HOST !== 'your-portal.bitrix24.ru' &&
    env.BITRIX24_WEBHOOK_USER_ID &&
    env.BITRIX24_WEBHOOK_USER_ID !== '1' &&
    env.BITRIX24_WEBHOOK_TOKEN &&
    env.BITRIX24_WEBHOOK_TOKEN !== 'replace-me'

  return {
    apiBaseUrl: '',
    apiTarget,
    bitrixConfigured: Boolean(bitrixConfigured),
    createdEnv,
    envPath: ENV_PATH,
    webEnvPath: WEB_ENV_PATH,
  }
}

const isDirectRun =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
  const result = prepareLocalDev()

  console.log(`[setup] env file: ${result.createdEnv ? 'created' : 'ready'} -> ${result.envPath}`)
  console.log(`[setup] web env: ready -> ${result.webEnvPath}`)
  console.log(`[setup] web api base url: same-origin /api`)
  console.log(`[setup] dev api proxy target: ${result.apiTarget}`)

  if (!result.bitrixConfigured) {
    console.log(
      '[setup] Bitrix24 webhook is still using placeholder values. UI will start, but live refresh will stay unavailable until .env is updated.',
    )
  }
}
