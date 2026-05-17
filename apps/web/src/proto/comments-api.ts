import type { CommentStore, ProtoComment } from '@/proto/types'
import { apiClient } from '@/lib/api-client'

const COMMENTS_ENDPOINT =
  import.meta.env.VITE_PROTO_COMMENTS_ENDPOINT ?? '/api/comments'

export function shouldUseServerComments() {
  return COMMENTS_ENDPOINT.startsWith('/api/')
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`)
  }

  return (await response.json()) as T
}

export async function fetchCommentStore() {
  if (shouldUseServerComments()) {
    return {
      comments: await apiClient.getComments(),
      updatedAt: null,
    }
  }

  const response = await fetch(COMMENTS_ENDPOINT)
  return readJson<CommentStore>(response)
}

export async function saveCommentStore(comments: ProtoComment[]) {
  if (shouldUseServerComments()) {
    return {
      comments,
      updatedAt: new Date().toISOString(),
    }
  }

  const response = await fetch(COMMENTS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ comments }),
  })

  return readJson<CommentStore>(response)
}
