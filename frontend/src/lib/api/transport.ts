import {
  API_ENDPOINTS,
  CSRF_HEADER_NAME,
  DEFAULT_REQUEST_ERROR_MESSAGE,
  GET_METHOD,
  HEAD_METHOD,
  JSON_CONTENT_TYPE,
  apiBasePath,
} from './endpoints'
import { ApiError, type ClientImportIssue } from './errors'

type ProblemPayload = {
  type?: string
  title?: string
  detail?: string
  code?: string
  errorCode?: string
  errors?: Record<string, string[]>
  operationId?: unknown
  issues?: unknown
  csrfToken?: string
}

let csrfToken = ''
let onUnauthorized: (() => void) | undefined

// Capture the authenticated boundary at dispatch so a late 401 cannot sign out a new session.
export function observeProtectedUnauthorized(handler: () => void) {
  onUnauthorized = handler
  return () => {
    if (onUnauthorized === handler) onUnauthorized = undefined
  }
}

export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const sessionObserver = onUnauthorized
  const method = (init.method ?? GET_METHOD).toUpperCase()
  const headers = new Headers(init.headers)
  const isFormDataBody = init.body instanceof FormData

  headers.set('Accept', JSON_CONTENT_TYPE)

  if (init.body && !isFormDataBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', JSON_CONTENT_TYPE)
  }

  if (method !== GET_METHOD && method !== HEAD_METHOD && csrfToken) {
    headers.set(CSRF_HEADER_NAME, csrfToken)
  }

  const response = await fetch(`${apiBasePath}${path}`, {
    ...init,
    method,
    headers,
    credentials: 'include',
  })

  if (response.status === 401 && sessionObserver === onUnauthorized &&
      path !== API_ENDPOINTS.auth.session && path !== API_ENDPOINTS.auth.login &&
      path !== API_ENDPOINTS.config.current) {
    sessionObserver?.()
  }
  const contentType = response.headers.get('content-type') ?? ''
  const payload = isJsonContentType(contentType)
    ? ((await response.json()) as ProblemPayload & T)
    : null

  if (payload?.csrfToken && sessionObserver === onUnauthorized && !init.signal?.aborted) {
    csrfToken = payload.csrfToken
  }

  if (!response.ok) {
    throw new ApiError(
      payload?.detail ?? payload?.title ?? DEFAULT_REQUEST_ERROR_MESSAGE,
      response.status,
      payload?.errors ?? {},
      payload?.code ?? payload?.errorCode ?? normalizeProblemType(payload?.type) ?? null,
      typeof payload?.operationId === 'string' ? payload.operationId : null,
      mapImportIssues(payload?.issues),
    )
  }

  return payload as T
}

function normalizeProblemType(type: string | undefined) {
  const slug = type?.split('/').filter(Boolean).at(-1)

  return slug ? slug.replaceAll('-', '_') : null
}

function isJsonContentType(contentType: string) {
  const normalizedContentType = contentType
    .split(';', 1)[0]
    ?.trim()
    .toLowerCase()

  return (
    normalizedContentType === JSON_CONTENT_TYPE ||
    normalizedContentType?.endsWith('+json') === true
  )
}

function mapImportIssues(value: unknown): ClientImportIssue[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is ClientImportIssue => item !== null && typeof item === 'object' &&
    (item.row === null || Number.isSafeInteger(item.row) && item.row > 0) &&
    (item.field === null || typeof item.field === 'string') && typeof item.code === 'string' && typeof item.message === 'string')
}
