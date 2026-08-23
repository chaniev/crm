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
  const reportPrefix = displayedReport ? 'Отчет' : 'Запрос'
  const periodLabel = displayedReport
    ? formatReportPeriod(displayedReport.period)
    : formatRequestedPeriod(requestedScope.filters)
  const scope = displayedScope ?? requestedScope
  const scopeText = `Филиал: ${scope.branchLabel} · Тренер: ${scope.trainerLabel}`

  return (
    <section
      aria-label={`${reportPrefix}: ${periodLabel}. ${scopeText}`}
      className="finance-scope-header"
      data-testid="finance-scope-header"
    >
      <Stack gap={4}>
        <Text className="finance-scope-header__period" fw={800}>
          {reportPrefix}: {periodLabel}
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
            Обновляем для {formatScopeInline(requestedScope)},{' '}
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
    return <LoadingState label="Загружаем финансовый отчет..." />
  }

  if (!report && initialError) {
    return (
      <ErrorState
        action={<RefreshButton label="Повторить" onClick={onRetry} />}
        message={initialError}
        title="Отчет не загрузился"
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
          title="Отчет не обновился"
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
            <RefreshButton label="Повторить обновление" onClick={onRetry} />
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
      label: 'Продано абонементов',
      value: formatCount(report.totals.soldMembershipCount),
    },
    {
      label: 'Выручка',
      value: formatMoney(report.totals.grossSales),
    },
    {
      label: 'Возвраты',
      value: formatMoney(report.totals.refundTotal),
    },
    {
      label: 'Чистая выручка',
      value: formatMoney(report.totals.netTotal),
    },
    {
      label: 'Новые клиенты',
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
      description="Измените период или снимите фильтры."
      icon={<IconReportMoney size={28} />}
      title="За выбранный период операций нет."
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
    const from = filters.from ? formatDateValue(filters.from) : 'не задано'
    const to = filters.to ? formatDateValue(filters.to) : 'не задано'

    return `${from}–${to}`
  }

  const presetLabel = {
    month: 'Месяц',
    quarter: 'Квартал',
    year: 'Год',
  }[filters.periodPreset]

  return `${presetLabel}, дата ${formatDateValue(filters.anchorDate)}`
}

function formatScopeInline(scope: FinanceScopeContext) {
  return `Филиал: ${scope.branchLabel}, Тренер: ${scope.trainerLabel}`
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
    return `Не удалось обновить отчет. Показаны ранее загруженные данные за ${displayedPeriod}.`
  }

  return [
    `Не удалось загрузить отчет для ${formatScopeInline(requestedScope)},`,
    `${formatRequestedPeriod(requestedScope.filters)}.`,
    `Показан предыдущий отчет: ${displayedPeriod},`,
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
    return 'не задано'
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
