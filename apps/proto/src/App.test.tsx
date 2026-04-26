import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/App'

function createResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

describe('CRM Prototype App', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (!init || init.method === 'GET') {
          return createResponse({ comments: [], updatedAt: null })
        }

        const next = JSON.parse(String(init.body)) as { comments: unknown[] }
        return createResponse({
          comments: next.comments,
          updatedAt: '2026-04-10T12:00:00.000Z',
        })
      }),
    )
  })

  it('renders the leadgen-based dashboard shell', async () => {
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: /^pdca-дашборд метрик$/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^отчет по продажам$/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/фильтры периода и среза/i)).toBeInTheDocument()
  })

  it('shows compact filter panel and adds comparison period on demand', async () => {
    render(<App />)

    expect(screen.getByDisplayValue('2026-03-01')).toBeInTheDocument()
    expect(screen.queryByText(/период 1/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /применить фильтры/i })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /\+ сравнение/i }))

    expect(screen.getByText(/период 1/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue('2026-02-01')).toBeInTheDocument()
  })

  it('switches to the cohort report and renders cohort kpis', async () => {
    render(<App />)

    await userEvent.click(
      screen.getAllByRole('button', { name: /когортный отчет/i })[0]!,
    )

    expect(screen.getByText(/средняя когортная конверсия/i)).toBeInTheDocument()
    expect(screen.getAllByText(/во 2 месяц/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/когортная матрица/i)).toBeInTheDocument()
    expect(screen.getByText(/распределение по менеджерам/i)).toBeInTheDocument()
    expect(screen.getByText(/матрица пересчитывается по менеджерам/i)).toBeInTheDocument()
    expect(screen.queryByText(/^успешное закрытие$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^от созданных$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^пик закрытия$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^среднее закрытие$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^длинный хвост$/i)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^по источникам$/i }))

    expect(screen.getByText(/распределение по источникам/i)).toBeInTheDocument()
    expect(screen.getByText(/платный поиск/i)).toBeInTheDocument()
  })

  it('shows selected managers and sources inside cohort slices', async () => {
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: /^менеджеры$/i }))
    await userEvent.click(screen.getAllByText(/егоров андрей/i).at(-1)!)
    await userEvent.keyboard('{Escape}')

    await userEvent.click(screen.getByRole('button', { name: /^источники$/i }))
    await userEvent.click(screen.getAllByText(/платный поиск/i).at(-1)!)
    await userEvent.keyboard('{Escape}')

    await userEvent.click(
      screen.getAllByRole('button', { name: /когортный отчет/i })[0]!,
    )

    await userEvent.click(screen.getByRole('button', { name: /^по менеджерам$/i }))
    expect(screen.getByText(/выбраны менеджеры:/i).parentElement).toHaveTextContent(/егоров андрей/i)

    await userEvent.click(screen.getByRole('button', { name: /^по источникам$/i }))
    expect(screen.getByText(/выбраны источники:/i).parentElement).toHaveTextContent(/платный поиск/i)
  })

  it('renders activity report as a stage matrix with call statistics', async () => {
    render(<App />)

    await userEvent.click(
      screen.getByRole('button', { name: /отчет активности/i }),
    )

    expect(screen.getByText(/матрица активности/i)).toBeInTheDocument()
    expect(screen.getByText(/база входящая/i)).toBeInTheDocument()
    expect(screen.getByText(/на передаче/i)).toBeInTheDocument()
    expect(screen.getAllByText(/закрыто дел/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/создано дел/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/успешные >30 сек/i)).toBeInTheDocument()
    expect(screen.getByText(/недозвоны/i)).toBeInTheDocument()
    expect(screen.getByText(/процентную динамику/i)).toBeInTheDocument()
    expect(screen.getAllByText(/\+18%/).length).toBeGreaterThan(0)
  })

  it('renders the funnel flow report as a separate scene', async () => {
    render(<App />)

    await userEvent.click(
      screen.getByRole('button', { name: /движение по воронке/i }),
    )

    expect(screen.getByText(/пропускная способность и очереди/i)).toBeInTheDocument()
    expect(screen.getByText(/стадии: основной vs сравнение 1/i)).toBeInTheDocument()
    expect(screen.getByText(/фокус toc/i)).toBeInTheDocument()
    expect(screen.queryByText(/темный столбец/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/пс\/день ·/i)).not.toBeInTheDocument()
    expect(screen.getAllByText(/буфер очереди/i).length).toBeGreaterThan(0)
    expect(screen.queryByText(/буфер по этапам/i)).not.toBeInTheDocument()
    expect(screen.queryAllByTestId(/toc-buffer-badge-/)).toHaveLength(0)
  })

  it('shows a hover tooltip on the funnel flow chart', async () => {
    render(<App />)

    await userEvent.click(
      screen.getByRole('button', { name: /движение по воронке/i }),
    )

    fireEvent.mouseEnter(screen.getByTestId('toc-current-bar-0'))

    expect(screen.getByText(/пс 23 \/ день/i)).toBeInTheDocument()
    expect(screen.getAllByText(/буфер: 3.7 дн./i).length).toBeGreaterThan(0)
  })

  it('opens searchable manager selection', async () => {
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: /менеджеры/i }))

    expect(screen.getByPlaceholderText(/поиск менеджера/i)).toBeInTheDocument()
    expect(screen.getAllByText(/егоров андрей/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/ромашова ольга/i)).toBeInTheDocument()
  })

  it('toggles comment mode', async () => {
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: /^comment mode$/i }))

    expect(
      screen.getByRole('button', { name: /^выйти из comment mode$/i }),
    ).toBeInTheDocument()
  })

  it('places a comment pin at the clicked shell coordinate and closes editor after save', async () => {
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: /^comment mode$/i }))

    const shell = screen.getByRole('presentation')
    vi.spyOn(shell, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 1000,
      height: 1000,
      top: 0,
      left: 0,
      right: 1000,
      bottom: 1000,
      toJSON: () => ({}),
    } as DOMRect)

    fireEvent.click(shell, { clientX: 100, clientY: 200 })

    const textarea = screen.getByPlaceholderText(/комментарий к точке интерфейса/i)
    await userEvent.type(textarea, 'Проверка точки')
    await userEvent.click(screen.getByRole('button', { name: /^сохранить$/i }))

    const pin = await screen.findByRole('button', { name: /^Комментарий 1$/ })
    expect(pin).toHaveStyle({ left: '10%', top: '20%' })

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/комментарий к точке интерфейса/i)).toBeDisabled()
    })
  })

  it('archives a comment and hides its pin from the current scene', async () => {
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: /^comment mode$/i }))

    const shell = screen.getByRole('presentation')
    vi.spyOn(shell, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 1000,
      height: 1000,
      top: 0,
      left: 0,
      right: 1000,
      bottom: 1000,
      toJSON: () => ({}),
    } as DOMRect)

    fireEvent.click(shell, { clientX: 100, clientY: 200 })

    await userEvent.type(
      screen.getByPlaceholderText(/комментарий к точке интерфейса/i),
      'Архивный комментарий',
    )
    await userEvent.click(screen.getByRole('button', { name: /^сохранить$/i }))

    const pin = await screen.findByRole('button', { name: /^Комментарий 1$/ })
    await userEvent.click(pin)
    await userEvent.click(screen.getByRole('button', { name: /^в архив$/i }))

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^Комментарий 1$/ })).not.toBeInTheDocument()
    })
  })
})
