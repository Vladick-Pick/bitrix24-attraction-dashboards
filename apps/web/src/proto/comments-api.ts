import type { CommentStore, ProtoComment, ProtoCommentContext } from '@/proto/types'
import { apiClient } from '@/lib/api-client'

const COMMENTS_ENDPOINT =
  import.meta.env.VITE_PROTO_COMMENTS_ENDPOINT ??
  (import.meta.env.DEV ? '/__proto/comments' : '/api/comments')

function shouldUseServerComments() {
  return COMMENTS_ENDPOINT.startsWith('/api/')
}

function shouldUseDashboardComments() {
  return COMMENTS_ENDPOINT === '/api/comments'
}

export function usesDashboardCommentApi() {
  return shouldUseDashboardComments()
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`)
  }

  return (await response.json()) as T
}

export async function fetchCommentStore(moduleId = 'attraction') {
  if (shouldUseDashboardComments()) {
    return apiClient.getComments(moduleId)
  }

  if (shouldUseServerComments()) {
    return apiClient.getProtoComments()
  }

  const response = await fetch(COMMENTS_ENDPOINT)
  return readJson<CommentStore>(response)
}

export async function saveCommentStore(comments: ProtoComment[]) {
  if (shouldUseServerComments()) {
    return apiClient.saveProtoComments(comments)
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

export async function createComment(
  input: {
    sceneId: string
    x: number
    y: number
    text: string
    anchor?: ProtoComment['anchor']
    context?: ProtoCommentContext
  },
  moduleId = 'attraction',
) {
  if (shouldUseDashboardComments()) {
    return apiClient.createComment(
      {
        sceneId: input.sceneId,
        x: input.x,
        y: input.y,
        text: input.text,
        ...(input.anchor ? { anchor: input.anchor } : {}),
        ...(input.context ? { context: input.context } : {}),
      },
      moduleId,
    )
  }

  return { comment: input as ProtoComment }
}

export async function updateComment(
  id: string,
  input: {
    text?: string
    context?: ProtoCommentContext
  },
  moduleId = 'attraction',
) {
  if (shouldUseDashboardComments()) {
    return apiClient.updateComment(id, input, moduleId)
  }

  return { comment: { id, ...input } as ProtoComment }
}

export async function archiveComment(id: string, moduleId = 'attraction') {
  if (shouldUseDashboardComments()) {
    return apiClient.archiveComment(id, moduleId)
  }

  return {
    comment: {
      id,
      status: 'archived',
      archivedAt: new Date().toISOString(),
    } as ProtoComment,
  }
}

export async function retryComment(id: string, moduleId = 'attraction') {
  if (shouldUseDashboardComments()) {
    return apiClient.retryComment(id, moduleId)
  }

  return { comment: { id } as ProtoComment }
}

export async function reworkComment(
  id: string,
  input: { text: string },
  moduleId = 'attraction',
) {
  if (shouldUseDashboardComments()) {
    return apiClient.reworkComment(id, input, moduleId)
  }

  return { comment: { id } as ProtoComment }
}
