import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import App from '@/App'

function createResponse(body: unknown) {
  return {
    ok: true,
    json: async () => body,
  } satisfies Partial<Response> as Response
}

describe('App', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('falls back to preview data when the local API is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    render(<App />)

    expect(
      await screen.findByRole('heading', {
        name: /beautiful local reporting/i,
      }),
    ).toBeInTheDocument()

    expect(
      await screen.findByText(/preview dataset active/i),
    ).toBeInTheDocument()
  })

  it('requests a different dashboard slice when the period changes', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/api/meta')) {
        return createResponse({
          stageCatalog: [],
          wonStageIds: ['C1:WON'],
          defaultPeriodDays: 30,
          lastSync: null,
        })
      }

      if (url.includes('periodDays=90')) {
        return createResponse({
          salesOverview: {
            salesCount: 11,
            salesAmount: 910000,
            averageSaleAmount: 82727,
            newDealsCount: 30,
            conversionRate: 36.6,
            salesTimeline: [],
          },
          funnelSnapshot: [],
          sourceBreakdown: [],
        })
      }

      return createResponse({
        salesOverview: {
          salesCount: 3,
          salesAmount: 245000,
          averageSaleAmount: 81666,
          newDealsCount: 9,
          conversionRate: 33.3,
          salesTimeline: [],
        },
        funnelSnapshot: [],
        sourceBreakdown: [],
      })
    })

    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    await screen.findByText('245 000')

    await userEvent.click(
      within(screen.getByRole('group', { name: 'Select report period' })).getByText('90d'),
    )

    await screen.findByText('910 000')

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/dashboard?periodDays=90'),
        expect.any(Object),
      )
    })
  })

  it('posts to the sync endpoint when refresh is requested', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url.includes('/api/sync')) {
        return createResponse({
          syncRunId: 19,
          leadsSynced: 17,
          dealsSynced: 14,
          mode: 'delta',
          modifiedAfter: '2026-04-08T00:00:00.000Z',
          finishedAt: '2026-04-09T08:00:00.000Z',
        })
      }

      if (url.includes('/api/meta')) {
        return createResponse({
          stageCatalog: [],
          wonStageIds: [],
          defaultPeriodDays: 30,
          lastSync: {
            finishedAt: '2026-04-09T08:00:00.000Z',
            leadsSynced: 17,
            dealsSynced: 14,
            mode: 'delta',
          },
        })
      }

      expect(init?.method ?? 'GET').toBe('GET')

      return createResponse({
        salesOverview: {
          salesCount: 4,
          salesAmount: 326000,
          averageSaleAmount: 81500,
          newDealsCount: 12,
          conversionRate: 33.3,
          salesTimeline: [],
        },
        funnelSnapshot: [],
        sourceBreakdown: [],
      })
    })

    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    await screen.findByText('326 000')

    await userEvent.click(screen.getAllByRole('button', { name: /refresh/i }).at(0)!)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/sync'),
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })
})
