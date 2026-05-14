import { useCallback, useEffect, useState } from 'react'

import { ApiClientError } from '@/lib/api-client'
import {
  archiveComment as archiveServerComment,
  createComment as createServerComment,
  fetchCommentStore,
  reworkComment as reworkServerComment,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getCommentFromApiError(error: unknown) {
  if (!(error instanceof ApiClientError) || !isRecord(error.payload)) {
    return null
  }

  const comment = error.payload.comment
  return isRecord(comment) ? normalizeComment(comment as unknown as ProtoComment) : null
}

function formatCommentError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback

  if (message === 'PAPERCLIP_REWORK_FAILED') {
    return 'Не удалось отправить комментарий команде разработки. Статус комментария сохранен, можно повторить позже.'
  }

  if (message === 'PAPERCLIP_NOT_CONFIGURED') {
    return 'Команда разработки сейчас недоступна. Статус комментария сохранен, можно повторить позже.'
  }

  return message.replace(/paperclip/gi, 'команда разработки')
}

export function useProtoComments(moduleId = 'attraction') {
  const [comments, setComments] = useState<ProtoComment[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const store = await fetchCommentStore(moduleId)

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
  }, [moduleId])

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
            ? await updateServerComment(
                comment.id,
                {
                  text: comment.text,
                  ...(comment.context ? { context: comment.context } : {}),
                },
                moduleId,
              )
            : await createServerComment(
                {
                sceneId: comment.sceneId,
                x: comment.x,
                y: comment.y,
                text: comment.text,
                ...(comment.anchor ? { anchor: comment.anchor } : {}),
                ...(comment.context ? { context: comment.context } : {}),
                },
                moduleId,
              )
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
    [comments, moduleId, persist],
  )

  const archiveComment = useCallback(
    async (commentId: string) => {
      if (usesDashboardCommentApi()) {
        setStatus('saving')
        setError(null)

        try {
          const response = await archiveServerComment(commentId, moduleId)
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
    [comments, moduleId, persist],
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
      const response = await retryServerComment(commentId, moduleId)
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
          : 'Не удалось повторить отправку в команду разработки',
      )
    }
  }, [moduleId])

  const reworkComment = useCallback(async (commentId: string, text: string) => {
    if (!usesDashboardCommentApi()) {
      return false
    }

    setStatus('saving')
    setError(null)

    try {
      const response = await reworkServerComment(commentId, { text }, moduleId)
      const reworked = normalizeComment(response.comment)
      setComments((current) =>
        current.map((item) => (item.id === commentId ? reworked : item)),
      )
      setUpdatedAt(reworked.updatedAt)
      setStatus('ready')
      return true
    } catch (reworkError) {
      const failedComment = getCommentFromApiError(reworkError)
      if (failedComment) {
        setComments((current) =>
          current.map((item) => (item.id === commentId ? failedComment : item)),
        )
        setUpdatedAt(failedComment.updatedAt)
        setStatus('ready')
      } else {
        setStatus('error')
      }
      setError(formatCommentError(reworkError, 'Не удалось вернуть комментарий в работу'))
      return false
    }
  }, [moduleId])

  return {
    comments,
    updatedAt,
    status,
    error,
    upsertComment,
    removeComment,
    archiveComment,
    retryComment,
    reworkComment,
  }
}
