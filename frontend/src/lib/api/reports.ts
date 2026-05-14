import {
  API_ENDPOINTS,
  FINANCIAL_REPORT_QUERY_KEYS,
} from './endpoints'
import { appendSearchParam } from './read-helpers'
import { request } from './transport'
import type {
  FinancialReportResponse,
  GetFinancialReportParams,
} from './types'

export function buildFinancialReportQueryString(
  params: GetFinancialReportParams,
) {
  const searchParams = new URLSearchParams()

  appendSearchParam(
    searchParams,
    FINANCIAL_REPORT_QUERY_KEYS.periodPreset,
    params.periodPreset,
  )
  appendSearchParam(
    searchParams,
    FINANCIAL_REPORT_QUERY_KEYS.anchorDate,
    params.anchorDate,
  )
  appendSearchParam(searchParams, FINANCIAL_REPORT_QUERY_KEYS.from, params.from)
  appendSearchParam(searchParams, FINANCIAL_REPORT_QUERY_KEYS.to, params.to)
  appendSearchParam(searchParams, FINANCIAL_REPORT_QUERY_KEYS.branchId, params.branchId)
  appendSearchParam(
    searchParams,
    FINANCIAL_REPORT_QUERY_KEYS.trainerId,
    params.trainerId,
  )

  return searchParams.toString()
}

export async function getFinancialReport(
  params: GetFinancialReportParams,
  signal?: AbortSignal,
) {
  const query = buildFinancialReportQueryString(params)

  return request<FinancialReportResponse>(
    `${API_ENDPOINTS.reports.financial}?${query}`,
    { signal },
  )
}
