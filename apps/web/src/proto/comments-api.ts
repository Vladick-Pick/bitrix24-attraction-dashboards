import type { CommentStore, ProtoComment } from '@/proto/types'

const COMMENTS_ENDPOINT = '/__proto/comments'

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`)
  }

  return (await response.json()) as T
}

export async function fetchCommentStore() {
  const response = await fetch(COMMENTS_ENDPOINT)
  return readJson<CommentStore>(response)
}

export async function saveCommentStore(comments: ProtoComment[]) {
  const response = await fetch(COMMENTS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ comments }),
  })

  return readJson<CommentStore>(response)
}
