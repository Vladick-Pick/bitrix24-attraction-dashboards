import path from 'node:path'
import fs from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect, Plugin } from 'vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const commentsFile = path.resolve(
  __dirname,
  '../../.codex/proto-comments/comments.json',
)

type CommentRecord = {
  id: string
  sceneId: string
  x: number
  y: number
  text: string
  createdAt: string
  updatedAt: string
}

type CommentStore = {
  comments: CommentRecord[]
  updatedAt: string | null
}

async function ensureStore() {
  await fs.mkdir(path.dirname(commentsFile), { recursive: true })
}

async function readStore(): Promise<CommentStore> {
  try {
    const raw = await fs.readFile(commentsFile, 'utf8')
    return JSON.parse(raw) as CommentStore
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { comments: [], updatedAt: null }
    }

    throw error
  }
}

async function writeStore(comments: CommentRecord[]) {
  await ensureStore()
  const payload: CommentStore = {
    comments,
    updatedAt: new Date().toISOString(),
  }
  await fs.writeFile(commentsFile, JSON.stringify(payload, null, 2))
  return payload
}

async function readBody(request: IncomingMessage) {
  const chunks: Uint8Array[] = []

  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }

  const text = Buffer.concat(chunks).toString('utf8')
  return text ? (JSON.parse(text) as { comments: CommentRecord[] }) : { comments: [] }
}

function jsonResponse(
  response: ServerResponse<IncomingMessage>,
  status: number,
  body: unknown,
) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify(body))
}

function registerCommentsApi(middlewares: Connect.Server) {
  middlewares.use(
    '/__proto/comments',
    async (
      request: IncomingMessage,
      response: ServerResponse<IncomingMessage>,
      next: Connect.NextFunction,
    ) => {
    try {
      if (request.method === 'GET') {
        jsonResponse(response, 200, await readStore())
        return
      }

      if (request.method === 'POST') {
        const body = await readBody(request)
        jsonResponse(response, 200, await writeStore(body.comments ?? []))
        return
      }

      if (request.method === 'OPTIONS') {
        jsonResponse(response, 204, null)
        return
      }

      next()
    } catch (error) {
      jsonResponse(response, 500, {
        message:
          error instanceof Error ? error.message : 'Failed to handle comments',
      })
    }
    },
  )
}

function protoCommentsPlugin(): Plugin {
  return {
    name: 'proto-comments-api',
    configureServer(server) {
      registerCommentsApi(server.middlewares)
    },
    configurePreviewServer(server) {
      registerCommentsApi(server.middlewares)
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), protoCommentsPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
