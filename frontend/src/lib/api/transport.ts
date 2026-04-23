import {
  CSRF_HEADER_NAME,
  DEFAULT_REQUEST_ERROR_MESSAGE,
  GET_METHOD,
  HEAD_METHOD,
  JSON_CONTENT_TYPE,
  apiBasePath,
} from './endpoints'
import { ApiError } from './errors'

type ProblemPayload = {
  title?: string
  detail?: string
  errors?: Record<string, string[]>
  csrfToken?: string
}

let csrfToken = ''

export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
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

  const contentType = response.headers.get('content-type') ?? ''
  const payload = contentType.includes('application/json')
    ? ((await response.json()) as ProblemPayload & T)
    : null

  if (payload?.csrfToken) {
    csrfToken = payload.csrfToken
  }

  if (!response.ok) {
    throw new ApiError(
      payload?.detail ?? payload?.title ?? DEFAULT_REQUEST_ERROR_MESSAGE,
      response.status,
      payload?.errors ?? {},
    )
  }

  return payload as T
}
