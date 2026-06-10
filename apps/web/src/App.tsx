import { type FormEvent, useEffect, useState } from 'react'

import { apiClient } from '@/lib/api-client'
import type { AuthUser } from '@/proto/types'
import { ProtoApp } from '@/proto/proto-app'

type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated'

function getErrorStatus(error: unknown) {
  return error && typeof error === 'object' && 'status' in error
    ? Number((error as { status?: unknown }).status)
    : undefined
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : ''
}

function resolveAuthError(error: unknown) {
  const status = getErrorStatus(error)
  const message = getErrorMessage(error)

  if (message === 'INVALID_CREDENTIALS') {
    return 'Неверный логин или пароль.'
  }

  if (status === 401 || message === 'SESSION_EXPIRED') {
    return 'Сессия истекла. Войдите снова.'
  }

  if (!status) {
    return 'Нет соединения с сервером.'
  }

  return 'Не удалось выполнить вход.'
}

function LoginScreen({
  error,
  submitting,
  onSubmit,
}: {
  error: string | null
  submitting: boolean
  onSubmit: (input: { login: string; password: string }) => Promise<void>
}) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onSubmit({
      login,
      password,
    })
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col justify-center">
        <div className="border border-slate-700 bg-slate-900 p-6 shadow-2xl shadow-black/30">
          <p className="subtle-label text-slate-400">Модули Bitrix24</p>
          <h1 className="mt-2 text-3xl font-bold">Вход в дашборд</h1>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-slate-300">Логин</span>
              <input
                autoComplete="username"
                className="w-full border border-slate-700 bg-slate-950 px-3 py-2.5 text-base text-slate-100 outline-none transition focus:border-sky-400"
                name="login"
                value={login}
                onChange={(event) => setLogin(event.target.value)}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-slate-300">Пароль</span>
              <input
                autoComplete="current-password"
                className="w-full border border-slate-700 bg-slate-950 px-3 py-2.5 text-base text-slate-100 outline-none transition focus:border-sky-400"
                name="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {error ? (
              <div className="border border-rose-500/40 bg-rose-950/50 px-3 py-2 text-sm text-rose-100">
                {error}
              </div>
            ) : null}
            <button
              className="btn btn-primary w-full justify-center"
              disabled={submitting}
              type="submit"
            >
              {submitting ? 'Вход...' : 'Войти'}
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}

function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking')
  const [authError, setAuthError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    let cancelled = false
    const unsubscribe = apiClient.onUnauthorized(() => {
      setAuthStatus('unauthenticated')
      setAuthError('Сессия истекла. Войдите снова.')
    })

    apiClient
      .getCurrentUser()
      .then((response) => {
        if (!cancelled) {
          setCurrentUser(response.user)
          setAuthStatus('authenticated')
          setAuthError(null)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setAuthStatus('unauthenticated')
          setCurrentUser(null)
          setAuthError(getErrorStatus(error) === 401 ? null : resolveAuthError(error))
        }
      })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  async function handleLogin(input: { login: string; password: string }) {
    setSubmitting(true)
    setAuthError(null)

    try {
      await apiClient.login(input)
      const response = await apiClient.getCurrentUser()
      setCurrentUser(response.user)
      setAuthStatus('authenticated')
    } catch (error) {
      setAuthStatus('unauthenticated')
      setCurrentUser(null)
      setAuthError(resolveAuthError(error))
    } finally {
      setSubmitting(false)
    }
  }

  if (authStatus === 'checking') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
        <div role="status">Проверяем сессию...</div>
      </main>
    )
  }

  if (authStatus === 'unauthenticated') {
    return (
      <LoginScreen
        error={authError}
        submitting={submitting}
        onSubmit={handleLogin}
      />
    )
  }

  return <ProtoApp currentUser={currentUser} />
}

export default App
