import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Accordion,
  Alert,
  Badge,
  Group,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useMediaQuery } from '@mantine/hooks'
import {
  IconAlertCircle,
  IconCalendarEvent,
  IconChartBar,
  IconReportMoney,
} from '@tabler/icons-react'
import {
  ApiError,
  applyFieldErrors,
  getBranches,
  getFinancialReport,
  getTrainerOptions,
  type AuthenticatedUser,
  type Branch,
  type FinancialReportBranchBreakdownRow,
  type FinancialReportGroupBreakdownRow,
  type FinancialReportPeriodPreset,
  type FinancialReportResponse,
  type FinancialReportTotals,
  type FinancialReportTrainerBreakdownRow,
  type GetFinancialReportParams,
  type TrainerOption,
} from '../../lib/api'
import {
  CompactFilterPanel,
  EmptyState,
  ErrorState,
  LoadingState,
  PageLayout,
  PageSection,
  RefreshButton,
  SectionHeader,
  type CompactFilterItem,
  type CompactFilterPlacement,
} from '../shared/ux'

type FinanceReportsScreenProps = {
  user: AuthenticatedUser
}

type FinanceFilterValues = {
  periodPreset: FinancialReportPeriodPreset
  anchorDate: string
  from: string
  to: string
  branchId: string | null
  trainerId: string | null
}

type BreakdownColumn<Row> = {
  key: string
  label: string
  render: (row: Row) => ReactNode
  numeric?: boolean
}

type MobileBreakdownMetric<Row> = {
  label: string
  value: (row: Row) => ReactNode
}

const periodOptions: Array<{
  value: FinancialReportPeriodPreset
  label: string
}> = [
  { value: 'month', label: 'Месяц' },
  { value: 'quarter', label: 'Квартал' },
  { value: 'year', label: 'Год' },
  { value: 'custom', label: 'Период' },
]

const duplicatedBreakdownHint =
  'Итоги сверху считаются без дублей. В разбивке по группам и тренерам одна и та же продажа может попасть в несколько строк, если клиент был связан с несколькими группами или тренерами в выбранный период. Поэтому сумма строк в этих таблицах может быть больше итогов.'

const moneyFormatter = new Intl.NumberFormat('ru-RU', {
  currency: 'RUB',
  maximumFractionDigits: 0,
  style: 'currency',
})

const countFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 0,
})

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

export function FinanceReportsScreen({ user }: FinanceReportsScreenProps) {
  const canViewFinance =
    user.permissions.canViewFinancialReports &&
    user.allowedSections.includes('Finance')
  const form = useForm<FinanceFilterValues>({
    initialValues: createInitialFilterValues(),
  })
  const formRef = useRef(form)
  const reportRef = useRef<FinancialReportResponse | null>(null)
  const [appliedFilters, setAppliedFilters] = useState<FinanceFilterValues>(() =>
    createInitialFilterValues(),
  )
  const [branches, setBranches] = useState<Branch[]>([])
  const [trainers, setTrainers] = useState<TrainerOption[]>([])
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [report, setReport] = useState<FinancialReportResponse | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  const [filterError, setFilterError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const isMobile = useMediaQuery('(max-width: 48em)')

  useEffect(() => {
    formRef.current = form
  }, [form])

  useEffect(() => {
    reportRef.current = report
  }, [report])

  useEffect(() => {
    if (!canViewFinance) {
      setBranches([])
      setTrainers([])
      setOptionsError(null)
      setOptionsLoading(false)
      return
    }

    const controller = new AbortController()

    async function loadOptions() {
      setOptionsLoading(true)
      setOptionsError(null)

      try {
        const [nextBranches, nextTrainers] = await Promise.all([
          getBranches({ includeArchived: false }, controller.signal),
          getTrainerOptions(controller.signal),
        ])

        if (controller.signal.aborted) {
          return
        }

        setBranches(nextBranches)
        setTrainers(nextTrainers)
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setOptionsError(
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить списки фильтров.',
        )
      } finally {
        if (!controller.signal.aborted) {
          setOptionsLoading(false)
        }
      }
    }

    void loadOptions()

    return () => controller.abort()
  }, [canViewFinance])

  useEffect(() => {
    if (!canViewFinance) {
      setReport(null)
      setReportError(null)
      setFilterError(null)
      setReportLoading(false)
      return
    }

    const controller = new AbortController()

    async function loadReport() {
      setReportLoading(true)
      setReportError(null)
      setFilterError(null)

      try {
        const nextReport = await getFinancialReport(
          toFinancialReportParams(appliedFilters),
          controller.signal,
        )

        if (controller.signal.aborted) {
          return
        }

        setReport(nextReport)
        formRef.current.clearErrors()
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        const message =
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить финансовый отчет.'

        if (error instanceof ApiError) {
          const nextFieldErrors = applyFieldErrors(error.fieldErrors)

          if (Object.keys(nextFieldErrors).length > 0) {
            formRef.current.setErrors(nextFieldErrors)
            setFilterError(message)
            focusFirstInvalidField(Object.keys(nextFieldErrors)[0])
          }
        }

        setReportError(
          reportRef.current
            ? 'Не удалось обновить отчет. Показаны предыдущие данные.'
            : message,
        )
      } finally {
        if (!controller.signal.aborted) {
          setReportLoading(false)
        }
      }
    }

    void loadReport()

    return () => controller.abort()
  }, [appliedFilters, canViewFinance, reloadKey])

  const branchOptions = useMemo(
    () =>
      branches.map((branch) => ({
        value: branch.id,
        label: branch.name,
      })),
    [branches],
  )
  const trainerOptions = useMemo(
    () =>
      trainers.map((trainer) => ({
        value: trainer.id,
        label: trainer.login
          ? `${trainer.fullName} (${trainer.login})`
          : trainer.fullName,
      })),
    [trainers],
  )

  function applyFilters(values: FinanceFilterValues) {
    const nextFilters = normalizeFilterValues(values)

    form.setValues(nextFilters)
    form.clearErrors()
    setFilterError(null)
    setAppliedFilters(nextFilters)
  }

  function updateFilters(nextFilters: Partial<FinanceFilterValues>) {
    const nextValues = normalizeFilterValues({
      ...form.values,
      ...nextFilters,
    })

    applyFilters(nextValues)
  }

  function handleResetFilters() {
    const nextFilters = createClearedFilterValues()

    form.setValues(nextFilters)
    form.clearErrors()
    setFilterError(null)
    setAppliedFilters(nextFilters)
  }

  if (!canViewFinance) {
    return (
      <PageLayout data-testid="finance-screen" title="Финансы">
        <PageSection>
          <ErrorState
            message="Этот экран доступен только пользователям, которым backend выдал доступ к разделу финансов."
            title="Финансовые отчеты недоступны"
          />
        </PageSection>
      </PageLayout>
    )
  }

  const hasReport = Boolean(report)
  const isInitialReportLoading = reportLoading && !hasReport
  const isRefreshingReport = reportLoading && hasReport
  const filterErrorMessages = Object.values(form.errors).filter(
    (message): message is string => typeof message === 'string' && message.length > 0,
  )
  const primaryFilters = [
    {
      key: 'periodPreset',
      label: 'Быстрый период',
      render: (placement) => (
        <CompactFilterField label="Быстрый период" placement={placement}>
          <SegmentedControl
            aria-label="Быстрый период"
            data={periodOptions}
            onChange={(value) =>
              updateFilters({
                periodPreset: value as FinancialReportPeriodPreset,
              })
            }
            value={form.values.periodPreset}
          />
        </CompactFilterField>
      ),
    },
    {
      key: 'branchId',
      label: 'Филиал',
      render: () => (
        <Select
          clearable
          data={branchOptions}
          disabled={optionsLoading}
          label="Филиал"
          name="branchId"
          onChange={(value) => updateFilters({ branchId: value })}
          placeholder="Все филиалы"
          searchable
          value={form.values.branchId}
        />
      ),
    },
    {
      key: 'trainerId',
      label: 'Тренер',
      render: () => (
        <Select
          clearable
          data={trainerOptions}
          disabled={optionsLoading}
          label="Тренер"
          name="trainerId"
          onChange={(value) => updateFilters({ trainerId: value })}
          placeholder="Все тренеры"
          searchable
          value={form.values.trainerId}
        />
      ),
    },
  ] satisfies CompactFilterItem[]
  const secondaryFilters = [
    ...(form.values.periodPreset === 'custom'
      ? [
          {
            key: 'from',
            label: 'С',
            render: (placement: CompactFilterPlacement) => (
              <TextInput
                error={placement === 'inline' ? undefined : form.errors.from}
                label="С"
                leftSection={<IconCalendarEvent size={16} />}
                name="from"
                onChange={(event) => updateFilters({ from: event.currentTarget.value })}
                type="date"
                value={form.values.from}
              />
            ),
          },
          {
            key: 'to',
            label: 'По',
            render: (placement: CompactFilterPlacement) => (
              <TextInput
                error={placement === 'inline' ? undefined : form.errors.to}
                label="По"
                leftSection={<IconCalendarEvent size={16} />}
                name="to"
                onChange={(event) => updateFilters({ to: event.currentTarget.value })}
                type="date"
                value={form.values.to}
              />
            ),
          },
        ]
      : [
          {
            key: 'anchorDate',
            label: 'Дата в периоде',
            render: (placement: CompactFilterPlacement) => (
              <TextInput
                error={placement === 'inline' ? undefined : form.errors.anchorDate}
                label="Дата в периоде"
                leftSection={<IconCalendarEvent size={16} />}
                name="anchorDate"
                onChange={(event) =>
                  updateFilters({ anchorDate: event.currentTarget.value })
                }
                type="date"
                value={form.values.anchorDate}
              />
            ),
          },
        ]),
  ] satisfies CompactFilterItem[]

  return (
    <PageLayout
      actions={
        <RefreshButton
          loading={isRefreshingReport}
          onClick={() => setReloadKey((current) => current + 1)}
        />
      }
      data-testid="finance-screen"
      title="Финансы"
    >
      <Stack gap="sm">
        {optionsError ? (
          <Alert
            color="yellow"
            icon={<IconAlertCircle size={18} />}
            title="Списки фильтров не загрузились"
            variant="light"
          >
            {optionsError}
          </Alert>
        ) : null}

        {filterError ? (
          <Alert
            color="red"
            icon={<IconAlertCircle size={18} />}
            title="Проверьте фильтры"
            variant="light"
          >
            <Stack gap={4}>
              <Text>{filterError}</Text>
              {filterErrorMessages.map((message) => (
                <Text key={message}>{message}</Text>
              ))}
            </Stack>
          </Alert>
        ) : null}

        <CompactFilterPanel
          className="finance-report-toolbar"
          data-testid="finance-filter-panel"
          onReset={handleResetFilters}
          primary={primaryFilters}
          secondary={secondaryFilters}
        />
      </Stack>

      <PageSection>
        <Stack gap="lg">
          <SectionHeader
            actions={
              report ? (
                <Badge color="brand.1" radius="xl" variant="light">
                  {formatPeriodRange(report.period.from, report.period.to)}
                </Badge>
              ) : null
            }
            title="Итоги отчета"
          />

          {isInitialReportLoading ? (
            <LoadingState label="Загружаем финансовый отчет..." />
          ) : null}

          {!isInitialReportLoading && reportError && !report ? (
            <ErrorState
              action={
                <RefreshButton
                  label="Повторить"
                  onClick={() => setReloadKey((current) => current + 1)}
                />
              }
              message={reportError}
              title="Отчет не загрузился"
            />
          ) : null}

          {reportError && report ? (
            <Alert
              color="yellow"
              icon={<IconAlertCircle size={18} />}
              title="Отчет не обновился"
              variant="light"
            >
              {reportError}
            </Alert>
          ) : null}

          {report ? (
            <FinanceReportResults isMobile={isMobile} report={report} />
          ) : null}
        </Stack>
      </PageSection>
    </PageLayout>
  )
}

type FinanceReportResultsProps = {
  report: FinancialReportResponse
  isMobile: boolean | undefined
}

function FinanceReportResults({ report, isMobile }: FinanceReportResultsProps) {
  return (
    <Stack gap="lg">
      <SimpleGrid
        className="finance-metrics-grid"
        cols={{ base: 1, sm: 2, lg: 5 }}
        data-testid="finance-totals"
      >
        <FinanceMetric
          description="Продажи за период"
          label="Продано абонементов"
          value={formatCount(report.totals.soldMembershipCount)}
        />
        <FinanceMetric
          description="Сумма продаж"
          label="Выручка"
          value={formatMoney(report.totals.grossSales)}
        />
        <FinanceMetric
          description="Возвраты за период"
          label="Возвраты"
          value={formatMoney(report.totals.refundTotal)}
        />
        <FinanceMetric
          description="Итоговая сумма"
          label="Чистая выручка"
          value={formatMoney(report.totals.netTotal)}
        />
        <FinanceMetric
          description="Новые клиенты"
          label="Новые клиенты"
          value={formatCount(report.totals.newClientsCount)}
        />
      </SimpleGrid>

      {isZeroReport(report) ? (
        <EmptyState
          description="Измените период или снимите фильтры."
          icon={<IconReportMoney size={28} />}
          title="За выбранный период операций нет."
        />
      ) : null}

      {isMobile ? (
        <MobileBreakdowns report={report} />
      ) : (
        <DesktopBreakdowns report={report} />
      )}
    </Stack>
  )
}

type FinanceMetricProps = {
  label: string
  value: string
  description: string
}

function CompactFilterField({
  children,
  label,
}: {
  children: ReactNode
  label: string
  placement: CompactFilterPlacement
}) {
  return (
    <Stack className="compact-filter-field" gap={4}>
      <Text className="compact-filter-field__label">{label}</Text>
      {children}
    </Stack>
  )
}

function FinanceMetric({ label, value, description }: FinanceMetricProps) {
  return (
    <Paper className="finance-metric-card" radius="var(--radius-inner)" withBorder>
      <Stack gap={4}>
        <Text c="dimmed" fw={700} size="xs" tt="uppercase">
          {label}
        </Text>
        <Text className="finance-metric-card__value" fw={800}>
          {value}
        </Text>
        <Text c="dimmed" size="xs">
          {description}
        </Text>
      </Stack>
    </Paper>
  )
}

function DesktopBreakdowns({ report }: { report: FinancialReportResponse }) {
  return (
    <div className="finance-breakdown-grid">
      <BranchBreakdownSection rows={report.branchBreakdown} />
      <TrainerBreakdownSection rows={report.trainerBreakdown} />
      <div className="finance-breakdown-grid__wide">
        <GroupBreakdownSection rows={report.groupBreakdown} />
      </div>
    </div>
  )
}

function MobileBreakdowns({ report }: { report: FinancialReportResponse }) {
  return (
    <Accordion
      className="finance-mobile-breakdowns"
      defaultValue={['branches', 'trainers', 'groups']}
      multiple
      variant="separated"
    >
      <Accordion.Item value="branches">
        <Accordion.Control>По филиалам</Accordion.Control>
        <Accordion.Panel>
          <BranchBreakdownSection mobile rows={report.branchBreakdown} />
        </Accordion.Panel>
      </Accordion.Item>
      <Accordion.Item value="trainers">
        <Accordion.Control>По тренерам</Accordion.Control>
        <Accordion.Panel>
          <TrainerBreakdownSection mobile rows={report.trainerBreakdown} />
        </Accordion.Panel>
      </Accordion.Item>
      <Accordion.Item value="groups">
        <Accordion.Control>По группам</Accordion.Control>
        <Accordion.Panel>
          <GroupBreakdownSection mobile rows={report.groupBreakdown} />
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  )
}

function BranchBreakdownSection({
  rows,
  mobile = false,
}: {
  rows: FinancialReportBranchBreakdownRow[]
  mobile?: boolean
}) {
  return (
    <BreakdownSection
      columns={[
        {
          key: 'branch',
          label: 'Филиал',
          render: (row) => row.branchName,
        },
        ...totalsColumns<FinancialReportBranchBreakdownRow>(),
      ]}
      emptyText="По филиалам нет строк за выбранный период."
      getRowId={(row, index) => `finance-branch-row-${row.branchId}-${index}`}
      getSubtitle={() => null}
      getTitle={(row) => row.branchName}
      metrics={totalsMobileMetrics<FinancialReportBranchBreakdownRow>()}
      mobile={mobile}
      rows={rows}
      testId="finance-branch-breakdown"
      title="По филиалам"
    />
  )
}

function GroupBreakdownSection({
  rows,
  mobile = false,
}: {
  rows: FinancialReportGroupBreakdownRow[]
  mobile?: boolean
}) {
  return (
    <BreakdownSection
      columns={[
        {
          key: 'branch',
          label: 'Филиал',
          render: (row) => row.branchName,
        },
        {
          key: 'group',
          label: 'Группа',
          render: (row) => row.groupName,
        },
        ...totalsColumns<FinancialReportGroupBreakdownRow>(),
      ]}
      duplicateHint={duplicatedBreakdownHint}
      emptyText="По группам нет строк за выбранный период."
      getRowId={(row, index) => `finance-group-row-${row.groupId}-${index}`}
      getSubtitle={(row) => row.branchName}
      getTitle={(row) => row.groupName}
      metrics={totalsMobileMetrics<FinancialReportGroupBreakdownRow>()}
      mobile={mobile}
      rows={rows}
      testId="finance-group-breakdown"
      title="По группам"
    />
  )
}

function TrainerBreakdownSection({
  rows,
  mobile = false,
}: {
  rows: FinancialReportTrainerBreakdownRow[]
  mobile?: boolean
}) {
  return (
    <BreakdownSection
      columns={[
        {
          key: 'trainer',
          label: 'Тренер',
          render: (row) => row.trainerName,
        },
        ...totalsColumns<FinancialReportTrainerBreakdownRow>(),
      ]}
      duplicateHint={duplicatedBreakdownHint}
      emptyText="По тренерам нет строк за выбранный период."
      getRowId={(row, index) => `finance-trainer-row-${row.trainerId}-${index}`}
      getSubtitle={() => null}
      getTitle={(row) => row.trainerName}
      metrics={totalsMobileMetrics<FinancialReportTrainerBreakdownRow>()}
      mobile={mobile}
      rows={rows}
      testId="finance-trainer-breakdown"
      title="По тренерам"
    />
  )
}

type BreakdownSectionProps<Row> = {
  title: string
  rows: Row[]
  columns: Array<BreakdownColumn<Row>>
  metrics: Array<MobileBreakdownMetric<Row>>
  emptyText: string
  testId: string
  getRowId: (row: Row, index: number) => string
  getTitle: (row: Row) => string
  getSubtitle: (row: Row) => string | null
  duplicateHint?: string
  mobile?: boolean
}

function BreakdownSection<Row>({
  title,
  rows,
  columns,
  metrics,
  emptyText,
  testId,
  getRowId,
  getTitle,
  getSubtitle,
  duplicateHint,
  mobile = false,
}: BreakdownSectionProps<Row>) {
  return (
    <section className="finance-breakdown-section" data-testid={testId}>
      <Stack gap="sm">
        <Stack gap={4}>
          <Group gap="xs" wrap="wrap">
            <IconChartBar size={18} />
            <Text fw={800}>{title}</Text>
            <Badge radius="xl" variant="light">
              {rows.length}
            </Badge>
          </Group>
          {duplicateHint ? (
            <Text c="dimmed" size="sm">
              {duplicateHint}
            </Text>
          ) : null}
        </Stack>

        {rows.length === 0 ? (
          <Text c="dimmed" size="sm">
            {emptyText}
          </Text>
        ) : mobile ? (
          <Stack gap="sm">
            {rows.map((row, index) => (
              <Paper
                className="finance-breakdown-mobile-row"
                data-testid={getRowId(row, index)}
                key={getRowId(row, index)}
                radius="var(--radius-inner)"
                withBorder
              >
                <Stack gap="sm">
                  <Stack gap={2}>
                    <Text fw={800}>{getTitle(row)}</Text>
                    {getSubtitle(row) ? (
                      <Text c="dimmed" size="sm">
                        {getSubtitle(row)}
                      </Text>
                    ) : null}
                  </Stack>
                  <SimpleGrid cols={2}>
                    {metrics.map((metric) => (
                      <BreakdownMobileMetric
                        key={metric.label}
                        label={metric.label}
                        value={metric.value(row)}
                      />
                    ))}
                  </SimpleGrid>
                </Stack>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Table className="finance-breakdown-table" horizontalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                {columns.map((column) => (
                  <Table.Th
                    className={column.numeric ? 'finance-table-cell--numeric' : undefined}
                    key={column.key}
                  >
                    {column.label}
                  </Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row, index) => (
                <Table.Tr data-testid={getRowId(row, index)} key={getRowId(row, index)}>
                  {columns.map((column) => (
                    <Table.Td
                      className={column.numeric ? 'finance-table-cell--numeric' : undefined}
                      key={column.key}
                    >
                      {column.render(row)}
                    </Table.Td>
                  ))}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Stack>
    </section>
  )
}

function BreakdownMobileMetric({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="finance-breakdown-mobile-metric">
      <Text c="dimmed" fw={700} size="xs" tt="uppercase">
        {label}
      </Text>
      <Text fw={700} size="sm">
        {value}
      </Text>
    </div>
  )
}

function totalsColumns<Row extends FinancialReportTotals>(): Array<
  BreakdownColumn<Row>
> {
  return [
    {
      key: 'soldMembershipCount',
      label: 'Продажи',
      numeric: true,
      render: (row) => formatCount(row.soldMembershipCount),
    },
    {
      key: 'grossSales',
      label: 'Выручка',
      numeric: true,
      render: (row) => formatMoney(row.grossSales),
    },
    {
      key: 'refundTotal',
      label: 'Возвраты',
      numeric: true,
      render: (row) => formatMoney(row.refundTotal),
    },
    {
      key: 'netTotal',
      label: 'Чистая',
      numeric: true,
      render: (row) => formatMoney(row.netTotal),
    },
    {
      key: 'newClientsCount',
      label: 'Новые',
      numeric: true,
      render: (row) => formatCount(row.newClientsCount),
    },
  ]
}

function totalsMobileMetrics<Row extends FinancialReportTotals>(): Array<
  MobileBreakdownMetric<Row>
> {
  return [
    {
      label: 'Продажи',
      value: (row) => formatCount(row.soldMembershipCount),
    },
    {
      label: 'Выручка',
      value: (row) => formatMoney(row.grossSales),
    },
    {
      label: 'Возвраты',
      value: (row) => formatMoney(row.refundTotal),
    },
    {
      label: 'Чистая',
      value: (row) => formatMoney(row.netTotal),
    },
    {
      label: 'Новые',
      value: (row) => formatCount(row.newClientsCount),
    },
  ]
}

function createInitialFilterValues(): FinanceFilterValues {
  const today = new Date()
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

  return {
    periodPreset: 'month',
    anchorDate: toDateInputValue(today),
    from: toDateInputValue(firstDayOfMonth),
    to: toDateInputValue(today),
    branchId: null,
    trainerId: null,
  }
}

function createClearedFilterValues(): FinanceFilterValues {
  return {
    periodPreset: 'month',
    anchorDate: '',
    from: '',
    to: '',
    branchId: null,
    trainerId: null,
  }
}

function normalizeFilterValues(values: FinanceFilterValues): FinanceFilterValues {
  return {
    periodPreset: values.periodPreset,
    anchorDate: values.anchorDate.trim(),
    from: values.from.trim(),
    to: values.to.trim(),
    branchId: values.branchId?.trim() || null,
    trainerId: values.trainerId?.trim() || null,
  }
}

function toFinancialReportParams(
  values: FinanceFilterValues,
): GetFinancialReportParams {
  const branchId = values.branchId || undefined
  const trainerId = values.trainerId || undefined

  if (values.periodPreset === 'custom') {
    return {
      periodPreset: 'custom',
      from: values.from || undefined,
      to: values.to || undefined,
      branchId,
      trainerId,
    }
  }

  return {
    periodPreset: values.periodPreset,
    anchorDate: values.anchorDate || undefined,
    branchId,
    trainerId,
  }
}

function focusFirstInvalidField(field: string) {
  window.requestAnimationFrame(() => {
    const control = document.querySelector<HTMLElement>(
      `[name="${escapeAttributeValue(field)}"]`,
    )

    control?.focus()
  })
}

function escapeAttributeValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatCount(value: number) {
  return countFormatter.format(value)
}

function formatMoney(value: number) {
  return moneyFormatter.format(value)
}

function formatPeriodRange(from: string, to: string) {
  return `${formatDate(from)} - ${formatDate(to)}`
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)

  if (!year || !month || !day) {
    return value
  }

  return dateFormatter.format(new Date(year, month - 1, day))
}

function isZeroReport(report: FinancialReportResponse) {
  return (
    report.totals.soldMembershipCount === 0 &&
    report.totals.grossSales === 0 &&
    report.totals.refundTotal === 0 &&
    report.totals.netTotal === 0 &&
    report.totals.newClientsCount === 0
  )
}
