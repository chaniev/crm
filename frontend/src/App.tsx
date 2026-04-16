import { useEffect, useState } from 'react'
import './App.css'

type HealthCheckEntry = {
  status: string
  description?: string
  duration: string
}

type HealthPayload = {
  status: string
  totalDuration: string
  timestamp: string
  checks: Record<string, HealthCheckEntry>
}

async function fetchHealth(apiBasePath: string, signal?: AbortSignal) {
  const response = await fetch(`${apiBasePath}/health/ready`, { signal })
  const payload = (await response.json()) as HealthPayload

  if (!response.ok) {
    throw new Error(`Backend readiness check returned ${payload.status}.`)
  }

  return payload
}

function App() {
  const [health, setHealth] = useState<HealthPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const apiBasePath = import.meta.env.VITE_API_BASE_PATH ?? '/api'

  async function loadHealth(signal?: AbortSignal) {
    setLoading(true)
    setError(null)

    try {
      const payload = await fetchHealth(apiBasePath, signal)
      setHealth(payload)
    } catch (requestError) {
      if (signal?.aborted) {
        return
      }

      setHealth(null)
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unknown error while contacting the backend.',
      )
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController()

    async function loadInitialHealth() {
      setLoading(true)
      setError(null)

      try {
        const payload = await fetchHealth(apiBasePath, controller.signal)
        setHealth(payload)
      } catch (requestError) {
        if (controller.signal.aborted) {
          return
        }

        setHealth(null)
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unknown error while contacting the backend.',
        )
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadInitialHealth()

    return () => controller.abort()
  }, [apiBasePath])

  const statusTone = error ? 'status status--error' : 'status status--ok'

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero__copy">
          <p className="eyebrow">Stage 0</p>
          <h1>Каркас CRM готов к локальному запуску</h1>
          <p className="lead">
            Frontend работает через Vite, backend на .NET 10, база данных живет
            в контейнере PostgreSQL.
          </p>
        </div>

        <div className="hero__panel">
          <p className={statusTone}>
            {loading && 'Проверяем readiness backend...'}
            {!loading && !error && `Backend ${health?.status ?? 'Unknown'}`}
            {!loading && error && 'Backend недоступен'}
          </p>

          <button className="action" onClick={() => void loadHealth()}>
            Обновить статус
          </button>
        </div>
      </section>

      <section className="grid">
        <article className="card">
          <p className="card__label">Сервисы</p>
          <ul className="service-list">
            <li>
              <strong>frontend</strong>
              <span>React + Vite на порту 3000</span>
            </li>
            <li>
              <strong>backend</strong>
              <span>.NET 10 API на порту 8080</span>
            </li>
            <li>
              <strong>db</strong>
              <span>PostgreSQL в отдельном контейнере</span>
            </li>
          </ul>
        </article>

        <article className="card">
          <p className="card__label">API readiness</p>
          {health ? (
            <div className="health">
              <p className="health__headline">{health.status}</p>
              <p>Общее время проверки: {health.totalDuration}</p>
              <p>Проверок: {Object.keys(health.checks).length}</p>
              {Object.entries(health.checks).map(([name, check]) => (
                <div className="health__row" key={name}>
                  <span>{name}</span>
                  <span>{check.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">
              {error ?? 'Результат проверки появится после первого запроса.'}
            </p>
          )}
        </article>

        <article className="card card--wide">
          <p className="card__label">Что уже настроено</p>
          <div className="checklist">
            <p>Docker Compose поднимает frontend, backend и PostgreSQL.</p>
            <p>Backend получает строку подключения к БД через env-переменные.</p>
            <p>
              Стартовая страница проверяет readiness backend через proxy
              <code>{apiBasePath}/health/ready</code>.
            </p>
          </div>
        </article>
      </section>
    </main>
  )
}

export default App
