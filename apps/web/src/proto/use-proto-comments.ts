import { useCallback, useEffect, useState } from 'react'

import {
  archiveComment as archiveServerComment,
  createComment as createServerComment,
  fetchCommentStore,
  retryComment as retryServerComment,
  saveCommentStore,
  updateComment as updateServerComment,
  usesDashboardCommentApi,
} from '@/proto/comments-api'
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
      if (usesDashboardCommentApi()) {
        setStatus('saving')
        setError(null)

        try {
          const existing = comments.find((item) => item.id === comment.id)
          const response = existing
            ? await updateServerComment(comment.id, {
                text: comment.text,
                ...(comment.context ? { context: comment.context } : {}),
              })
            : await createServerComment({
                sceneId: comment.sceneId,
                x: comment.x,
                y: comment.y,
                text: comment.text,
                ...(comment.anchor ? { anchor: comment.anchor } : {}),
                ...(comment.context ? { context: comment.context } : {}),
              })
          const saved = normalizeComment(response.comment)
          setComments((current) =>
            current.some((item) => item.id === saved.id)
              ? current.map((item) => (item.id === saved.id ? saved : item))
              : [
                  ...current.filter((item) => item.id !== comment.id),
                  saved,
                ],
          )
          setUpdatedAt(saved.updatedAt)
          setStatus('ready')
        } catch (saveError) {
          setStatus('error')
          setError(
            saveError instanceof Error
              ? saveError.message
              : 'Не удалось сохранить комментарий',
          )
        }
        return
      }

      const nextComments = comments.some((item) => item.id === comment.id)
        ? comments.map((item) => (item.id === comment.id ? comment : item))
        : [...comments, comment]

      await persist(nextComments)
    },
    [comments, persist],
  )

  const archiveComment = useCallback(
    async (commentId: string) => {
      if (usesDashboardCommentApi()) {
        setStatus('saving')
        setError(null)

        try {
          const response = await archiveServerComment(commentId)
          const archived = normalizeComment(response.comment)
          setComments((current) =>
            current.map((item) => (item.id === commentId ? archived : item)),
          )
          setUpdatedAt(archived.updatedAt)
          setStatus('ready')
        } catch (archiveError) {
          setStatus('error')
          setError(
            archiveError instanceof Error
              ? archiveError.message
              : 'Не удалось архивировать комментарий',
          )
        }
        return
      }

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

  const removeComment = useCallback(
    async (commentId: string) => {
      if (usesDashboardCommentApi()) {
        await archiveComment(commentId)
        return
      }

      await persist(comments.filter((item) => item.id !== commentId))
    },
    [archiveComment, comments, persist],
  )

  const retryComment = useCallback(async (commentId: string) => {
    if (!usesDashboardCommentApi()) {
      return
    }

    setStatus('saving')
    setError(null)

    try {
      const response = await retryServerComment(commentId)
      const retried = normalizeComment(response.comment)
      setComments((current) =>
        current.map((item) => (item.id === commentId ? retried : item)),
      )
      setUpdatedAt(retried.updatedAt)
      setStatus('ready')
    } catch (retryError) {
      setStatus('error')
      setError(
        retryError instanceof Error
          ? retryError.message
          : 'Не удалось повторить отправку в Paperclip',
      )
    }
  }, [])

  return {
    comments,
    updatedAt,
    status,
    error,
    upsertComment,
    removeComment,
    archiveComment,
    retryComment,
  }
}
