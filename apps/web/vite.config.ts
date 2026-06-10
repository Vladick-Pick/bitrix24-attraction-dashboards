import path from 'node:path'
import type { Plugin } from 'vite'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import {
  registerProtoCommentsApi,
  shouldRegisterDevComments,
  shouldRegisterPreviewComments,
} from '../../scripts/proto-comments-api'

const commentsFile = path.resolve(
  __dirname,
  '../../.codex/proto-comments/comments.json',
)

function protoCommentsPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'proto-comments-api',
    configureServer(server) {
      if (shouldRegisterDevComments(env)) {
        registerProtoCommentsApi(server.middlewares, { commentsFile, env })
      }
    },
    configurePreviewServer(server) {
      if (shouldRegisterPreviewComments(env)) {
        return () => {
          registerProtoCommentsApi(server.middlewares, { commentsFile, env })
        }
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_DEV_API_TARGET || 'http://127.0.0.1:8787'

  return {
    plugins: [react(), tailwindcss(), protoCommentsPlugin(env)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
