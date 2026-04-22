import { useCallback, useEffect, useState } from 'react'

import { fetchCommentStore, saveCommentStore } from '@/proto/comments-api'
import type { ProtoComment } from '@/proto/types'

type Status = 'loading' | 'ready' | 'saving' | 'error'

function normalizeComment(comment: ProtoComment): ProtoComment {
  return {
    ...comment,
    status: comment.status ?? 'open',
    archivedAt: comment.archivedAt ?? null,
  }
}

export function useProtoComments() {
  const [comments, setComments] = useState<ProtoComment[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const store = await fetchCommentStore()

        if (cancelled) {
          return
        }

        setComments(store.comments.map(normalizeComment))
        setUpdatedAt(store.updatedAt)
        setStatus('ready')
      } catch (loadError) {
        if (cancelled) {
          return
        }

        setStatus('error')
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Не удалось загрузить комментарии',
        )
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  const persist = useCallback(async (nextComments: ProtoComment[]) => {
    setComments(nextComments)
    setStatus('saving')
    setError(null)

    try {
      const store = await saveCommentStore(nextComments)
      setComments(store.comments.map(normalizeComment))
      setUpdatedAt(store.updatedAt)
      setStatus('ready')
    } catch (saveError) {
      setStatus('error')
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Не удалось сохранить комментарии',
      )
    }
  }, [])

  const upsertComment = useCallback(
    async (comment: ProtoComment) => {
      const nextComments = comments.some((item) => item.id === comment.id)
        ? comments.map((item) => (item.id === comment.id ? comment : item))
        : [...comments, comment]

      await persist(nextComments)
    },
    [comments, persist],
  )

  const removeComment = useCallback(
    async (commentId: string) => {
      await persist(comments.filter((item) => item.id !== commentId))
    },
    [comments, persist],
  )

  const archiveComment = useCallback(
    async (commentId: string) => {
      const now = new Date().toISOString()
      await persist(
        comments.map((item) =>
          item.id === commentId
            ? { ...item, status: 'archived', archivedAt: now, updatedAt: now }
            : item,
        ),
      )
    },
    [comments, persist],
  )

  return {
    comments,
    updatedAt,
    status,
    error,
    upsertComment,
    removeComment,
    archiveComment,
  }
}
