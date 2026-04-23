import { API_ENDPOINTS } from './endpoints'
import { request } from './transport'
import type {
  ChangePasswordRequest,
  LoginRequest,
  SessionResponse,
} from './types'

export async function loadSession(signal?: AbortSignal) {
  return request<SessionResponse>(API_ENDPOINTS.auth.session, { signal })
}

export async function login(payload: LoginRequest) {
  return request<SessionResponse>(API_ENDPOINTS.auth.login, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function logout() {
  return request<SessionResponse>(API_ENDPOINTS.auth.logout, {
    method: 'POST',
  })
}

export async function changePassword(payload: ChangePasswordRequest) {
  return request<SessionResponse>(API_ENDPOINTS.auth.changePassword, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
