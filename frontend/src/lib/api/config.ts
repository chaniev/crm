import { API_ENDPOINTS } from './endpoints'
import { request } from './transport'
import type { AppConfigResponse } from './types'

export async function loadAppConfig(signal?: AbortSignal) {
  return request<AppConfigResponse>(API_ENDPOINTS.config.current, { signal })
}
