import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('useProtoComments dashboard API', () => {
  afterEach(() => {
    vi.doUnmock('@/lib/api-client')
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('keeps failed dashboard rework comments visible and actionable', async () => {
    vi.stubEnv('VITE_PROTO_COMMENTS_ENDPOINT', '/api/comments')

    const failedComment = {
      id: 'comment-1',
      moduleId: 'attraction',
      sceneId: 'sales',
      x: 0.25,
      y: 0.4,
      text: 'Дата встречи есть в атрибутах',
      status: 'open',
      archivedAt: null,
      createdAt: '2026-05-12T15:00:00.000Z',
      updatedAt: '2026-05-12T16:05:00.000Z',
      paperclipIssueId: 'issue-143570',
      paperclipIssueIdentifier: 'BIT-6',
      paperclipStatus: 'failed',
      paperclipSyncStatus: 'failed',
      paperclipError: 'Paperclip issue comment failed.',
    }

    vi.doMock('@/lib/api-client', () => {
      class ApiClientError extends Error {
        readonly status: number | undefined
        readonly payload: unknown

        constructor(message: string, status?: number, payload?: unknown) {
          super(message)
          this.name = 'ApiClientError'
          this.status = status
          this.payload = payload
        }
      }

      return {
        ApiClientError,
        apiClient: {
          getComments: vi.fn(async () => ({
            comments: [
              {
                ...failedComment,
                updatedAt: '2026-05-12T16:00:00.000Z',
                paperclipStatus: 'done',
                paperclipSyncStatus: 'sent',
                paperclipError: null,
              },
            ],
            updatedAt: '2026-05-12T16:00:00.000Z',
          })),
          reworkComment: vi.fn(async () => {
            throw new ApiClientError('PAPERCLIP_REWORK_FAILED', 502, {
              comment: failedComment,
            })
          }),
        },
      }
    })

    const { useProtoComments } = await import('@/proto/use-proto-comments')
    const { result } = renderHook(() => useProtoComments())

    await waitFor(() => {
      expect(result.current.comments).toHaveLength(1)
    })

    let reworkResult = true
    await act(async () => {
      reworkResult = await result.current.reworkComment(
        'comment-1',
        'Покажите предупреждение в таймлайне',
      )
    })

    expect(reworkResult).toBe(false)
    expect(result.current.status).toBe('ready')
    expect(result.current.error).toMatch(/не удалось отправить комментарий/i)
    expect(result.current.error).toMatch(/текст доработки не доставлен/i)
    expect(result.current.error).not.toMatch(/статус комментария сохранен/i)
    expect(result.current.comments[0]).toMatchObject({
      id: 'comment-1',
      paperclipStatus: 'failed',
      paperclipSyncStatus: 'failed',
      paperclipError: 'Paperclip issue comment failed.',
      updatedAt: '2026-05-12T16:05:00.000Z',
    })
  })
})
