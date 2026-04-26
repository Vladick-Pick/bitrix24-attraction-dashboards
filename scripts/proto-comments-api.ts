import fs from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'

const DEFAULT_MAX_BODY_BYTES = 256 * 1024
const MAX_COMMENTS = 500
const MAX_ID_LENGTH = 200
const MAX_TEXT_LENGTH = 5_000

const localHostnames = new Set(['localhost', '127.0.0.1', '::1'])
const commentKeys = new Set([
  'id',
  'sceneId',
  'x',
  'y',
  'text',
  'status',
  'archivedAt',
  'createdAt',
  'updatedAt',
])

export type CommentRecord = {
  id: string
  sceneId: string
  x: number
  y: number
  text: string
  status?: 'open' | 'archived'
  archivedAt?: string | null
  createdAt: string
  updatedAt: string
}

export type CommentStore = {
  comments: CommentRecord[]
  updatedAt: string | null
}

type HeaderValue = string | string[] | undefined

export type ProtoCommentsRequest = {
  headers: Record<string, HeaderValue>
}

export type ProtoCommentsEnv = {
  PROTO_COMMENTS_ENABLED?: string
  PROTO_COMMENTS_ALLOWED_ORIGINS?: string
}

export type ProtoCommentsMiddlewareStack = {
  use(
    route: string,
    handler: (
      request: IncomingMessage,
      response: ServerResponse<IncomingMessage>,
      next: (error?: unknown) => void,
    ) => void,
  ): void
}

export type RegisterProtoCommentsOptions = {
  commentsFile: string
  env?: ProtoCommentsEnv
  maxBodyBytes?: number
}

export class ProtoCommentsHttpError extends Error {
  readonly status: number
  readonly code: string

  constructor(
    status: number,
    code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ProtoCommentsHttpError'
    this.status = status
    this.code = code
  }
}

function firstHeader(value: HeaderValue) {
  return Array.isArray(value) ? value[0] : value
}

function parseOrigin(value: string) {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function getHostnameFromHostHeader(host: string) {
  try {
    const parsed = new URL(`http://${host}`)
    return parsed.hostname.replace(/^\[(.*)\]$/, '$1').toLowerCase()
  } catch {
    return null
  }
}

function isLocalHostHeader(host: string | undefined) {
  if (!host) {
    return false
  }

  const hostname = getHostnameFromHostHeader(host.trim())
  return hostname !== null && localHostnames.has(hostname)
}

function isLocalOrigin(origin: string) {
  try {
    const parsed = new URL(origin)
    return localHostnames.has(parsed.hostname.toLowerCase())
  } catch {
    return false
  }
}

function parseAllowedOrigins(env: ProtoCommentsEnv = {}) {
  return new Set(
    (env.PROTO_COMMENTS_ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((origin) => parseOrigin(origin.trim()))
      .filter((origin): origin is string => origin !== null),
  )
}

function getAllowedRequestOrigin(
  request: ProtoCommentsRequest,
  env: ProtoCommentsEnv = {},
) {
  const origin = firstHeader(request.headers.origin)

  if (!origin) {
    return null
  }

  const normalizedOrigin = parseOrigin(origin)
  if (!normalizedOrigin) {
    return null
  }

  if (isLocalOrigin(normalizedOrigin)) {
    return normalizedOrigin
  }

  return parseAllowedOrigins(env).has(normalizedOrigin) ? normalizedOrigin : null
}

export function isAllowedProtoCommentsRequest(
  request: ProtoCommentsRequest,
  env: ProtoCommentsEnv = {},
) {
  const host = firstHeader(request.headers.host)

  if (!isLocalHostHeader(host)) {
    return false
  }

  const origin = firstHeader(request.headers.origin)
  return !origin || getAllowedRequestOrigin(request, env) !== null
}

export function shouldRegisterDevComments(env: ProtoCommentsEnv = {}) {
  return env.PROTO_COMMENTS_ENABLED !== 'false'
}

export function shouldRegisterPreviewComments(env: ProtoCommentsEnv = {}) {
  return env.PROTO_COMMENTS_ENABLED === 'true'
}

function assertObject(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ProtoCommentsHttpError(400, 'invalid_payload', message)
  }

  return value as Record<string, unknown>
}

function assertString(value: unknown, field: string, maxLength = MAX_ID_LENGTH) {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
    throw new ProtoCommentsHttpError(
      400,
      'invalid_payload',
      `Invalid comment ${field}`,
    )
  }

  return value
}

function assertIsoDate(value: unknown, field: string) {
  const text = assertString(value, field, 100)

  if (!Number.isFinite(Date.parse(text))) {
    throw new ProtoCommentsHttpError(
      400,
      'invalid_payload',
      `Invalid comment ${field}`,
    )
  }

  return text
}

function parseCommentRecord(value: unknown): CommentRecord {
  const record = assertObject(value, 'Invalid comment record')

  for (const key of Object.keys(record)) {
    if (!commentKeys.has(key)) {
      throw new ProtoCommentsHttpError(
        400,
        'invalid_payload',
        `Unsupported comment field ${key}`,
      )
    }
  }

  const x = record.x
  const y = record.y

  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x < 0 ||
    x > 1 ||
    y < 0 ||
    y > 1
  ) {
    throw new ProtoCommentsHttpError(
      400,
      'invalid_payload',
      'Invalid comment coordinates',
    )
  }

  const status = record.status
  if (status !== undefined && status !== 'open' && status !== 'archived') {
    throw new ProtoCommentsHttpError(
      400,
      'invalid_payload',
      'Invalid comment status',
    )
  }

  const archivedAt = record.archivedAt
  if (
    archivedAt !== undefined &&
    archivedAt !== null &&
    (typeof archivedAt !== 'string' || !Number.isFinite(Date.parse(archivedAt)))
  ) {
    throw new ProtoCommentsHttpError(
      400,
      'invalid_payload',
      'Invalid comment archivedAt',
    )
  }

  const comment: CommentRecord = {
    id: assertString(record.id, 'id'),
    sceneId: assertString(record.sceneId, 'sceneId'),
    x,
    y,
    text: assertString(record.text, 'text', MAX_TEXT_LENGTH),
    createdAt: assertIsoDate(record.createdAt, 'createdAt'),
    updatedAt: assertIsoDate(record.updatedAt, 'updatedAt'),
  }

  if (status !== undefined) {
    comment.status = status
  }

  if (archivedAt !== undefined) {
    comment.archivedAt = archivedAt
  }

  return comment
}

export function parseCommentsPayload(value: unknown) {
  const payload = assertObject(value, 'Invalid comments payload')
  const comments = payload.comments

  if (!Array.isArray(comments) || comments.length > MAX_COMMENTS) {
    throw new ProtoCommentsHttpError(
      400,
      'invalid_payload',
      'Invalid comments payload',
    )
  }

  return {
    comments: comments.map(parseCommentRecord),
  }
}

function parseCommentStore(value: unknown): CommentStore {
  const store = assertObject(value, 'Invalid comments store')
  const payload = parseCommentsPayload({ comments: store.comments })
  const updatedAt = store.updatedAt

  if (
    updatedAt !== null &&
    updatedAt !== undefined &&
    (typeof updatedAt !== 'string' || !Number.isFinite(Date.parse(updatedAt)))
  ) {
    throw new ProtoCommentsHttpError(
      500,
      'invalid_store',
      'Invalid comments store',
    )
  }

  return {
    comments: payload.comments,
    updatedAt: updatedAt ?? null,
  }
}

export async function readJsonRequestBody(
  request: IncomingMessage,
  options: { maxBytes?: number } = {},
) {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BODY_BYTES
  const contentType = firstHeader(request.headers['content-type'])

  if (!contentType?.toLowerCase().includes('application/json')) {
    throw new ProtoCommentsHttpError(
      415,
      'unsupported_media_type',
      'Content-Type must be application/json',
    )
  }

  const contentLength = firstHeader(request.headers['content-length'])
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new ProtoCommentsHttpError(
      413,
      'payload_too_large',
      'Comments payload is too large',
    )
  }

  const chunks: Uint8Array[] = []
  let totalBytes = 0

  for await (const chunk of request) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
    totalBytes += buffer.byteLength

    if (totalBytes > maxBytes) {
      throw new ProtoCommentsHttpError(
        413,
        'payload_too_large',
        'Comments payload is too large',
      )
    }

    chunks.push(buffer)
  }

  const text = Buffer.concat(chunks).toString('utf8')

  try {
    return text ? (JSON.parse(text) as unknown) : { comments: [] }
  } catch {
    throw new ProtoCommentsHttpError(400, 'invalid_json', 'Invalid JSON payload')
  }
}

async function readStore(commentsFile: string): Promise<CommentStore> {
  try {
    const raw = await fs.readFile(commentsFile, 'utf8')
    return parseCommentStore(JSON.parse(raw))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { comments: [], updatedAt: null }
    }

    throw error
  }
}

async function writeStore(commentsFile: string, comments: CommentRecord[]) {
  await fs.mkdir(path.dirname(commentsFile), { recursive: true })

  const payload: CommentStore = {
    comments,
    updatedAt: new Date().toISOString(),
  }

  await fs.writeFile(commentsFile, JSON.stringify(payload, null, 2))
  return payload
}

function jsonResponse(
  response: ServerResponse<IncomingMessage>,
  status: number,
  body: unknown,
) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json')

  if (status === 204) {
    response.end()
    return
  }

  response.end(JSON.stringify(body))
}

function setCorsHeaders(
  request: IncomingMessage,
  response: ServerResponse<IncomingMessage>,
  env: ProtoCommentsEnv,
) {
  const origin = getAllowedRequestOrigin(request, env)

  if (!origin) {
    return
  }

  response.setHeader('Access-Control-Allow-Origin', origin)
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  response.setHeader('Vary', 'Origin')
}

function errorResponse(error: unknown) {
  if (error instanceof ProtoCommentsHttpError) {
    return {
      status: error.status,
      body: {
        error: error.message,
        code: error.code,
      },
    }
  }

  return {
    status: 500,
    body: {
      error: 'Failed to handle comments',
      code: 'internal_error',
    },
  }
}

export function registerProtoCommentsApi(
  middlewares: ProtoCommentsMiddlewareStack,
  options: RegisterProtoCommentsOptions,
) {
  const env = options.env ?? process.env
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES

  middlewares.use(
    '/__proto/comments',
    async (
      request: IncomingMessage,
      response: ServerResponse<IncomingMessage>,
      next: (error?: unknown) => void,
    ) => {
      try {
        if (!isAllowedProtoCommentsRequest(request, env)) {
          jsonResponse(response, 403, {
            error: 'Forbidden',
            code: 'forbidden',
          })
          return
        }

        setCorsHeaders(request, response, env)

        if (request.method === 'GET') {
          jsonResponse(response, 200, await readStore(options.commentsFile))
          return
        }

        if (request.method === 'POST') {
          const body = parseCommentsPayload(
            await readJsonRequestBody(request, { maxBytes: maxBodyBytes }),
          )
          jsonResponse(
            response,
            200,
            await writeStore(options.commentsFile, body.comments),
          )
          return
        }

        if (request.method === 'OPTIONS') {
          jsonResponse(response, 204, null)
          return
        }

        next()
      } catch (error) {
        const { status, body } = errorResponse(error)
        jsonResponse(response, status, body)
      }
    },
  )
}
