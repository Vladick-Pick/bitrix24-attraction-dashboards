import { useCallback, useEffect, useState } from 'react'

import {
  fetchCommentStore,
  saveCommentStore,
  shouldUseServerComments,
} from '@/proto/comments-api'
import { apiClient } from '@/lib/api-client'
import type { ProtoComment, ProtoCommentContext } from '@/proto/types'

type Status = 'loading' | 'ready' | 'saving' | 'error'

function normalizeComment(comment: ProtoComment): ProtoComment {
  return {
    ...comment,
    status: comment.status ?? 'open',
    archivedAt: comment.archivedAt ?? null,
  }
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
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
    async (comment: ProtoComment, context?: ProtoCommentContext | null) => {
      setStatus('saving')
      setError(null)

      try {
        const isExisting = comments.some((item) => item.id === comment.id)
        const savedComment = isExisting
          ? await apiClient.updateComment(comment.id, { text: comment.text })
          : await apiClient.createComment({
              sceneId: comment.sceneId,
              x: comment.x,
              y: comment.y,
              text: comment.text,
              context: context ?? comment.context ?? null,
              ...(comment.anchor ? { anchor: comment.anchor } : {}),
            })
        setComments((current) =>
          current.some((item) => item.id === savedComment.id)
            ? current.map((item) => (item.id === savedComment.id ? savedComment : item))
            : [...current, savedComment],
        )
        setUpdatedAt(savedComment.updatedAt)
        setStatus('ready')
      } catch (saveError) {
        if (shouldUseServerComments()) {
          setStatus('error')
          setError(errorMessage(saveError, 'Не удалось сохранить комментарий'))
          throw saveError
        }

        const nextComments = comments.some((item) => item.id === comment.id)
          ? comments.map((item) => (item.id === comment.id ? comment : item))
          : [...comments, comment]
        await persist(nextComments)
      }
    },
    [comments, persist],
  )

  const removeComment = useCallback(
    async (commentId: string) => {
      if (shouldUseServerComments()) {
        const deleteError = new Error('Удаление серверных комментариев недоступно')
        setStatus('error')
        setError(deleteError.message)
        throw deleteError
      }

      await persist(comments.filter((item) => item.id !== commentId))
    },
    [comments, persist],
  )

  const archiveComment = useCallback(
    async (commentId: string) => {
      setStatus('saving')
      setError(null)

      try {
        const archived = await apiClient.archiveComment(commentId)
        setComments((current) =>
          current.map((item) => (item.id === commentId ? archived : item)),
        )
        setUpdatedAt(archived.updatedAt)
        setStatus('ready')
      } catch (archiveError) {
        if (shouldUseServerComments()) {
          setStatus('error')
          setError(errorMessage(archiveError, 'Не удалось архивировать комментарий'))
          throw archiveError
        }

        const now = new Date().toISOString()
        await persist(
          comments.map((item) =>
            item.id === commentId
              ? { ...item, status: 'archived', archivedAt: now, updatedAt: now }
              : item,
          ),
        )
      }
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
