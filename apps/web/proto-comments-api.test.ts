import { Readable } from 'node:stream'
import type { IncomingMessage } from 'node:http'
import { describe, expect, it } from 'vitest'

import {
  ProtoCommentsHttpError,
  isAllowedProtoCommentsRequest,
  parseCommentsPayload,
  readJsonRequestBody,
  shouldRegisterDevComments,
  shouldRegisterPreviewComments,
} from '../../scripts/proto-comments-api'

function createRequest(
  body: string,
  headers: Record<string, string | undefined> = {},
) {
  const request = Readable.from(body ? [Buffer.from(body)] : []) as IncomingMessage

  Object.defineProperty(request, 'headers', {
    value: headers,
  })

  return request
}

describe('proto comments api hardening', () => {
  it('allows same-localhost requests and rejects cross-origin writes', () => {
    expect(
      isAllowedProtoCommentsRequest({
        headers: {
          host: 'localhost:5173',
          origin: 'http://localhost:5173',
        },
      }),
    ).toBe(true)

    expect(
      isAllowedProtoCommentsRequest({
        headers: {
          host: '127.0.0.1:5173',
          origin: 'https://example.test',
        },
      }),
    ).toBe(false)

    expect(
      isAllowedProtoCommentsRequest({
        headers: {
          host: 'example.test',
          origin: 'http://localhost:5173',
        },
      }),
    ).toBe(false)
  })

  it('validates comment payload shape before persistence', () => {
    expect(
      parseCommentsPayload({
        comments: [
          {
            id: 'comment-1',
            sceneId: 'sales',
            x: 0.42,
            y: 0.17,
            text: 'Проверить подпись',
            status: 'archived',
            archivedAt: '2026-04-26T12:00:00.000Z',
            createdAt: '2026-04-26T10:00:00.000Z',
            updatedAt: '2026-04-26T12:00:00.000Z',
          },
        ],
      }).comments,
    ).toHaveLength(1)

    expect(() =>
      parseCommentsPayload({
        comments: [
          {
            id: 1,
            sceneId: [],
            x: 'NaN',
            y: null,
            text: { nested: true },
            createdAt: 0,
            updatedAt: false,
          },
        ],
      }),
    ).toThrow(ProtoCommentsHttpError)
  })

  it('limits body size and requires json content type', async () => {
    await expect(
      readJsonRequestBody(
        createRequest('', {
          'content-type': 'application/json',
          'content-length': '2048',
        }),
        { maxBytes: 32 },
      ),
    ).rejects.toMatchObject({
      status: 413,
      code: 'payload_too_large',
    })

    await expect(
      readJsonRequestBody(
        createRequest('{"comments":[]}', {
          'content-type': 'text/plain',
        }),
        { maxBytes: 1024 },
      ),
    ).rejects.toMatchObject({
      status: 415,
      code: 'unsupported_media_type',
    })
  })

  it('returns a stable invalid json error without parser details', async () => {
    await expect(
      readJsonRequestBody(
        createRequest('{', {
          'content-type': 'application/json',
        }),
        { maxBytes: 1024 },
      ),
    ).rejects.toMatchObject({
      status: 400,
      code: 'invalid_json',
      message: 'Invalid JSON payload',
    })
  })

  it('keeps preview comments disabled unless explicitly enabled', () => {
    expect(shouldRegisterDevComments({})).toBe(true)
    expect(shouldRegisterDevComments({ PROTO_COMMENTS_ENABLED: 'false' })).toBe(
      false,
    )
    expect(shouldRegisterPreviewComments({})).toBe(false)
    expect(
      shouldRegisterPreviewComments({ PROTO_COMMENTS_ENABLED: 'true' }),
    ).toBe(true)
  })
})
