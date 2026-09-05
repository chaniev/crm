import { Alert, Paper, Stack, Text } from '@mantine/core'
import { IconAlertCircle, IconReportMoney } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  RefreshButton,
} from '../shared/ux'
import type {
  FinancialReportPeriod,
  FinancialReportResponse,
} from '../../lib/api'
import type {
  FinanceScopeContext,
  FinanceScopeFilters,
} from './FinanceReportScope'
import { fe15FinanceText } from '../../resources/fe-15-finance'


export type FinanceFailedRequest = {
  message: string
  requestKey: string
  requestedScope: FinanceScopeContext
}

type FinanceScopeHeaderProps = {
  displayedReport: FinancialReportResponse | null
  displayedScope: FinanceScopeContext | null
  isRefreshing: boolean
  requestedScope: FinanceScopeContext
}

type FinanceReportSurfaceProps = {
  children: ReactNode
  displayedScope: FinanceScopeContext | null
  failedRequest: FinanceFailedRequest | null
  initialError: string | null
  isInitialLoading: boolean
  isMobile: boolean | undefined
  onRetry: () => void
  report: FinancialReportResponse | null
}

type FinanceKpiStripProps = {
  report: FinancialReportResponse
}

type FinanceKpiItem = {
  label: string
  value: string
}

const displayDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

export function FinanceScopeHeader({
  displayedReport,
  displayedScope,
  isRefreshing,
  requestedScope,
}: FinanceScopeHeaderProps) {
  const reportPrefix = displayedReport ? fe15FinanceText.financeReportPresentation_string_e6a83dba : fe15FinanceText.financeReportPresentation_string_e08bc1c8
  const periodLabel = displayedReport
    ? formatReportPeriod(displayedReport.period)
    : formatRequestedPeriod(requestedScope.filters)
  const scope = displayedScope ?? requestedScope
  const scopeText = fe15FinanceText.financeReportPresentation_scopeText_f9ca0c09(scope.branchLabel, scope.trainerLabel)

  return (
    <section
      aria-label={`${reportPrefix}: ${periodLabel}. ${scopeText}`}
      className="finance-scope-header"
      data-testid="finance-scope-header"
    >
      <Stack gap={4}>
        <Text className="finance-scope-header__period" fw={800}>
          {reportPrefix}{fe15FinanceText.financeReportPresentation_jsxText_e7ac0786}{periodLabel}
        </Text>
        <Text className="finance-scope-header__scope" c="dimmed" title={scopeText}>
          {scopeText}
        </Text>
        {isRefreshing ? (
          <Text
            aria-live="polite"
            className="finance-scope-header__status"
            c="dimmed"
            size="sm"
          >
            {fe15FinanceText.financeReportPresentation_jsxText_3ad52700}{formatScopeInline(requestedScope)}{fe15FinanceText.financeReportPresentation_jsxText_d03502c4}{' '}
            {formatRequestedPeriod(requestedScope.filters)}
          </Text>
        ) : null}
      </Stack>
    </section>
  )
}

export function FinanceReportSurface({
  children,
  displayedScope,
  failedRequest,
  initialError,
  isInitialLoading,
  isMobile,
  onRetry,
  report,
}: FinanceReportSurfaceProps) {
  if (isInitialLoading) {
    return <LoadingState label={fe15FinanceText.financeReportPresentation_label_8f5cc749} />
  }

  if (!report && initialError) {
    return (
      <ErrorState
        action={<RefreshButton label={fe15FinanceText.financeReportPresentation_label_5189135a} onClick={onRetry} />}
        message={initialError}
        title={fe15FinanceText.financeReportPresentation_title_22598730}
      />
    )
  }

  if (!report) {
    return null
  }

  const isEmpty = isZeroFinancialReport(report)

  return (
    <Stack className="finance-report-surface" gap="md">
      {failedRequest && displayedScope ? (
        <Alert
          aria-live="polite"
          className="finance-report-stale-alert"
          color="yellow"
          icon={<IconAlertCircle size={18} />}
          title={fe15FinanceText.financeReportPresentation_title_9687bd44}
          variant="light"
        >
          <Stack gap="xs">
            <Text size="sm">
              {formatStaleMessage({
                displayedPeriod: formatReportPeriod(report.period),
                displayedScope,
                requestedScope: failedRequest.requestedScope,
              })}
            </Text>
            <Text c="dimmed" size="sm">
              {failedRequest.message}
            </Text>
            <RefreshButton label={fe15FinanceText.financeReportPresentation_label_976e03d3} onClick={onRetry} />
          </Stack>
        </Alert>
      ) : null}

      {isEmpty ? (
        <FinanceEmptyReportState />
      ) : (
        <>
          <FinanceKpiStrip report={report} />
          <div data-finance-breakdowns={isMobile ? 'mobile' : 'desktop'}>
            {children}
          </div>
        </>
      )}
    </Stack>
  )
}

function FinanceKpiStrip({ report }: FinanceKpiStripProps) {
  const items: FinanceKpiItem[] = [
    {
      label: fe15FinanceText.financeReportPresentation_label_5a4cd443,
      value: formatCount(report.totals.soldMembershipCount),
    },
    {
      label: fe15FinanceText.financeReportPresentation_label_6a187a49,
      value: formatMoney(report.totals.grossSales),
    },
    {
      label: fe15FinanceText.financeReportPresentation_label_e8fdd443,
      value: formatMoney(report.totals.refundTotal),
    },
    {
      label: fe15FinanceText.financeReportPresentation_label_eed36406,
      value: formatMoney(report.totals.netTotal),
    },
    {
      label: fe15FinanceText.financeReportPresentation_label_193f5e49,
      value: formatCount(report.totals.newClientsCount),
    },
  ]

  return (
    <div className="finance-kpi-strip" data-testid="finance-totals">
      {items.map((item, index) => (
        <Paper
          className={[
            'finance-kpi-strip__item',
            index === items.length - 1
              ? 'finance-kpi-strip__item--wide-mobile'
              : null,
          ]
            .filter(Boolean)
            .join(' ')}
          key={item.label}
          radius="var(--radius-inner)"
          withBorder
        >
          <Text className="finance-kpi-strip__label" c="dimmed" fw={700}>
            {item.label}
          </Text>
          <Text className="finance-kpi-strip__value" fw={800}>
            {item.value}
          </Text>
        </Paper>
      ))}
    </div>
  )
}

function FinanceEmptyReportState() {
  return (
    <EmptyState
      description={fe15FinanceText.financeReportPresentation_description_be8c12e8}
      icon={<IconReportMoney size={28} />}
      title={fe15FinanceText.financeReportPresentation_title_20c61586}
    />
  )
}

function isZeroFinancialReport(report: FinancialReportResponse) {
  return (
    report.totals.soldMembershipCount === 0 &&
    report.totals.grossSales === 0 &&
    report.totals.refundTotal === 0 &&
    report.totals.netTotal === 0 &&
    report.totals.newClientsCount === 0
  )
}

function formatReportPeriod(period: FinancialReportPeriod) {
  return `${formatDateValue(period.from)}–${formatDateValue(period.to)}`
}

function formatRequestedPeriod(filters: FinanceScopeFilters) {
  if (filters.periodPreset === 'custom') {
    const from = filters.from ? formatDateValue(filters.from) : fe15FinanceText.financeReportPresentation_string_7739db0f
    const to = filters.to ? formatDateValue(filters.to) : fe15FinanceText.financeReportPresentation_string_7739db0f

    return `${from}–${to}`
  }

  const presetLabel = {
    month: fe15FinanceText.financeReportPresentation_month_c9086654,
    quarter: fe15FinanceText.financeReportPresentation_quarter_2727c94f,
    year: fe15FinanceText.financeReportPresentation_year_d3b04324,
  }[filters.periodPreset]

  return fe15FinanceText.financeReportPresentation_template_edb2357a(presetLabel, formatDateValue(filters.anchorDate))
}

function formatScopeInline(scope: FinanceScopeContext) {
  return fe15FinanceText.financeReportPresentation_template_e68a10c0(scope.branchLabel, scope.trainerLabel)
}

function formatStaleMessage({
  displayedPeriod,
  displayedScope,
  requestedScope,
}: {
  displayedPeriod: string
  displayedScope: FinanceScopeContext
  requestedScope: FinanceScopeContext
}) {
  const sameRequestContext =
    areScopeLabelsEqual(displayedScope, requestedScope) &&
    areScopeFiltersEqual(displayedScope.filters, requestedScope.filters)

  if (sameRequestContext) {
    return fe15FinanceText.financeReportPresentation_template_175bf575(displayedPeriod)
  }

  return [
    fe15FinanceText.financeReportPresentation_template_a67459b7(formatScopeInline(requestedScope)),
    `${formatRequestedPeriod(requestedScope.filters)}.`,
    fe15FinanceText.financeReportPresentation_template_d4e70149(displayedPeriod),
    `${formatScopeInline(displayedScope)}.`,
  ].join(' ')
}

function areScopeLabelsEqual(
  first: FinanceScopeContext,
  second: FinanceScopeContext,
) {
  return (
    first.branchLabel === second.branchLabel &&
    first.trainerLabel === second.trainerLabel
  )
}

function areScopeFiltersEqual(
  first: FinanceScopeFilters,
  second: FinanceScopeFilters,
) {
  const samePeriod =
    first.periodPreset === second.periodPreset &&
    (first.periodPreset === 'custom'
      ? first.from === second.from && first.to === second.to
      : first.anchorDate === second.anchorDate)

  return (
    samePeriod &&
    first.branchId === second.branchId &&
    first.trainerId === second.trainerId
  )
}

function formatDateValue(value: string) {
  if (!value) {
    return fe15FinanceText.financeReportPresentation_string_7739db0f
  }

  const [year, month, day] = value.split('-').map(Number)

  if (!year || !month || !day) {
    return value
  }

  return displayDateFormatter.format(new Date(year, month - 1, day))
}

const moneyFormatter = new Intl.NumberFormat('ru-RU', {
  currency: 'RUB',
  maximumFractionDigits: 0,
  style: 'currency',
})

const countFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 0,
})

function formatCount(value: number) {
  return countFormatter.format(value)
}

function formatMoney(value: number) {
  return moneyFormatter.format(value)
}
