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
  IconFilterOff,
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
  Button,
  CompactFilterPanel,
  ErrorState,
  PageLayout,
  PageSection,
  TaskToolbarRefreshAction,
  type CompactFilterItem,
  type CompactFilterPlacement,
} from '../shared/ux'
import {
  FinanceReportSurface,
  FinanceScopeHeader,
  type FinanceFailedRequest,
} from './FinanceReportPresentation'
import {
  resolveFinanceScopeLabels,
  type FinanceScopeContext,
} from './FinanceReportScope'
import { fe15FinanceText } from '../../resources/fe-15-finance'


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

type DisplayedFinancialReport = {
  report: FinancialReportResponse
  scope: FinanceScopeContext
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
  { value: 'month', label: fe15FinanceText.financeReportsScreen_label_c9086654 },
  { value: 'quarter', label: fe15FinanceText.financeReportsScreen_label_2727c94f },
  { value: 'year', label: fe15FinanceText.financeReportsScreen_label_d3b04324 },
  { value: 'custom', label: fe15FinanceText.financeReportsScreen_label_e97ca72e },
]

const duplicatedBreakdownHint =
  fe15FinanceText.financeReportsScreen_duplicatedBreakdownHint_17d94038

const moneyFormatter = new Intl.NumberFormat('ru-RU', {
  currency: 'RUB',
  maximumFractionDigits: 0,
  style: 'currency',
})

const countFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 0,
})

const financeMobileFilterQuery =
  '(max-width: 47.99em), (max-height: 30rem) and (pointer: coarse)'

export function FinanceReportsScreen({ user }: FinanceReportsScreenProps) {
  const canViewFinance =
    user.permissions.canViewFinancialReports &&
    user.allowedSections.includes('Finance')
  const initialFiltersRef = useRef<FinanceFilterValues>(createInitialFilterValues())
  const form = useForm<FinanceFilterValues>({
    initialValues: initialFiltersRef.current,
  })
  const formRef = useRef(form)
  const displayedReportRef = useRef<DisplayedFinancialReport | null>(null)
  const branchOptionsRef = useRef<Array<{ value: string; label: string }>>([])
  const trainerOptionsRef = useRef<Array<{ value: string; label: string }>>([])
  const optionsLoadingRef = useRef(false)
  const optionsErrorRef = useRef<string | null>(null)
  const [appliedFilters, setAppliedFilters] = useState<FinanceFilterValues>(() =>
    initialFiltersRef.current,
  )
  const [branches, setBranches] = useState<Branch[]>([])
  const [trainers, setTrainers] = useState<TrainerOption[]>([])
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [displayedReport, setDisplayedReport] =
    useState<DisplayedFinancialReport | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  const [failedRequest, setFailedRequest] = useState<FinanceFailedRequest | null>(null)
  const [scopeTrustError, setScopeTrustError] = useState<string | null>(null)
  const [filterError, setFilterError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const isMobile = useMediaQuery('(max-width: 48em)')
  const usesMobileFilterLayout = useMediaQuery(financeMobileFilterQuery)

  useEffect(() => {
    formRef.current = form
  }, [form])

  useEffect(() => {
    displayedReportRef.current = displayedReport
  }, [displayedReport])

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
      optionsLoadingRef.current = true
      optionsErrorRef.current = null
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

        const message =
          error instanceof Error
            ? error.message
            : fe15FinanceText.financeReportsScreen_string_74c10e83

        optionsErrorRef.current = message
        setOptionsError(message)
      } finally {
        if (!controller.signal.aborted) {
          optionsLoadingRef.current = false
          setOptionsLoading(false)
        }
      }
    }

    void loadOptions()

    return () => controller.abort()
  }, [canViewFinance])

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

  useEffect(() => {
    branchOptionsRef.current = branchOptions
    trainerOptionsRef.current = trainerOptions
  }, [branchOptions, trainerOptions])

  useEffect(() => {
    optionsLoadingRef.current = optionsLoading
    optionsErrorRef.current = optionsError
  }, [optionsError, optionsLoading])

  const selectedScopeOptionsKey = useMemo(
    () =>
      createSelectedScopeOptionsKey({
        branchOptions,
        filters: appliedFilters,
        optionsError,
        optionsLoading,
        trainerOptions,
      }),
    [appliedFilters, branchOptions, optionsError, optionsLoading, trainerOptions],
  )

  useEffect(() => {
    if (!canViewFinance) {
      setDisplayedReport(null)
      setReportError(null)
      setFailedRequest(null)
      setFilterError(null)
      setScopeTrustError(null)
      setReportLoading(false)
      return
    }

    const controller = new AbortController()

    async function loadReport() {
      const scopeResolution = resolveFinanceScopeLabels({
        branchOptions: branchOptionsRef.current,
        filters: appliedFilters,
        trainerOptions: trainerOptionsRef.current,
      })

      if (scopeResolution.kind === 'inconsistent') {
        if (
          hasSelectedScopeFilter(appliedFilters) &&
          optionsLoadingRef.current &&
          !optionsErrorRef.current
        ) {
          setScopeTrustError(null)
          setReportError(null)
          setFailedRequest(null)
          setReportLoading(false)
          return
        }

        setScopeTrustError(scopeResolution.message)
        setReportError(null)
        setFailedRequest(null)
        setReportLoading(false)
        return
      }

      setReportLoading(true)
      setReportError(null)
      setFilterError(null)
      setScopeTrustError(null)
      setFailedRequest(null)
      const requestKey = createFinanceRequestKey(appliedFilters)

      try {
        const nextReport = await getFinancialReport(
          toFinancialReportParams(appliedFilters),
          controller.signal,
        )

        if (controller.signal.aborted) {
          return
        }

        setDisplayedReport({
          report: nextReport,
          scope: scopeResolution.scope,
        })
        formRef.current.clearErrors()
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        const message =
          error instanceof Error
            ? error.message
            : fe15FinanceText.financeReportsScreen_string_0e92a776

        if (error instanceof ApiError) {
          const nextFieldErrors = applyFieldErrors(error.fieldErrors)

          if (Object.keys(nextFieldErrors).length > 0) {
            formRef.current.setErrors(nextFieldErrors)
            setFilterError(message)
            focusFirstInvalidField(Object.keys(nextFieldErrors)[0])
            setReportError(null)
            setFailedRequest(null)
            return
          }
        }

        if (displayedReportRef.current) {
          setFailedRequest({
            message,
            requestKey,
            requestedScope: scopeResolution.scope,
          })
          setReportError(null)
        } else {
          setReportError(message)
        }
      } finally {
        if (!controller.signal.aborted) {
          setReportLoading(false)
        }
      }
    }

    void loadReport()

    return () => controller.abort()
  }, [appliedFilters, canViewFinance, reloadKey, selectedScopeOptionsKey])

  function applyFilters(values: FinanceFilterValues) {
    const nextFilters = normalizeFilterValues(values)

    form.setValues(nextFilters)
    form.clearErrors()
    setFilterError(null)
    setFailedRequest(null)
    setScopeTrustError(null)
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
    const nextFilters = { ...initialFiltersRef.current }

    form.setValues(nextFilters)
    form.clearErrors()
    setFilterError(null)
    setFailedRequest(null)
    setScopeTrustError(null)
    setAppliedFilters(nextFilters)
  }

  if (!canViewFinance) {
    return (
      <PageLayout data-testid="finance-screen" showHeader={false} title={fe15FinanceText.financeReportsScreen_title_d833b857}>
        <PageSection>
          <ErrorState
            message={fe15FinanceText.financeReportsScreen_message_8808f048}
            title={fe15FinanceText.financeReportsScreen_title_662a562c}
          />
        </PageSection>
      </PageLayout>
    )
  }

  const report = displayedReport?.report ?? null
  const requestedScopeResolution = resolveFinanceScopeLabels({
    branchOptions,
    filters: appliedFilters,
    trainerOptions,
  })
  const requestedScope =
    requestedScopeResolution.kind === 'valid'
      ? requestedScopeResolution.scope
      : displayedReport?.scope ?? {
          branchLabel: fe15FinanceText.financeReportsScreen_branchLabel_1b93eb9a,
          filters: appliedFilters,
          trainerLabel: fe15FinanceText.financeReportsScreen_trainerLabel_0b471d0c,
        }
  const activeFilterCount = getActiveFilterCount(
    appliedFilters,
    initialFiltersRef.current,
  )
  const hasActiveFilters = activeFilterCount > 0
  const hasReport = Boolean(report)
  const isInitialReportLoading = reportLoading && !hasReport
  const isRefreshingReport = reportLoading && hasReport
  const activeFailedRequest =
    failedRequest?.requestKey === createFinanceRequestKey(appliedFilters)
      ? failedRequest
      : null
  const filterErrorMessages = Object.values(form.errors).filter(
    (message): message is string => typeof message === 'string' && message.length > 0,
  )
  const primaryFilters = [
    {
      key: 'periodPreset',
      label: fe15FinanceText.financeReportsScreen_label_4885445c,
      render: (placement) => (
        <CompactFilterField label={fe15FinanceText.financeReportsScreen_label_4885445c} placement={placement}>
          <SegmentedControl
            aria-label={fe15FinanceText.financeReportsScreen_label_4885445c}
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
      label: fe15FinanceText.financeReportsScreen_label_2f17c4d2,
      render: () => (
        <Select
          clearable
          data={branchOptions}
          disabled={optionsLoading}
          label={fe15FinanceText.financeReportsScreen_label_2f17c4d2}
          name="branchId"
          onChange={(value) => updateFilters({ branchId: value })}
          placeholder={fe15FinanceText.financeReportsScreen_branchLabel_1b93eb9a}
          searchable
          value={form.values.branchId}
        />
      ),
    },
    {
      key: 'trainerId',
      label: fe15FinanceText.financeReportsScreen_label_894d7ecc,
      render: () => (
        <Select
          clearable
          data={trainerOptions}
          disabled={optionsLoading}
          label={fe15FinanceText.financeReportsScreen_label_894d7ecc}
          name="trainerId"
          onChange={(value) => updateFilters({ trainerId: value })}
          placeholder={fe15FinanceText.financeReportsScreen_trainerLabel_0b471d0c}
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
            label: fe15FinanceText.financeReportsScreen_label_07b8c0e6,
            render: (placement: CompactFilterPlacement) => (
              <TextInput
                error={placement === 'inline' ? undefined : form.errors.from}
                label={fe15FinanceText.financeReportsScreen_label_07b8c0e6}
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
            label: fe15FinanceText.financeReportsScreen_label_b60ab9b4,
            render: (placement: CompactFilterPlacement) => (
              <TextInput
                error={placement === 'inline' ? undefined : form.errors.to}
                label={fe15FinanceText.financeReportsScreen_label_b60ab9b4}
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
            label: fe15FinanceText.financeReportsScreen_label_0d21a5dd,
            render: (placement: CompactFilterPlacement) => (
              <TextInput
                error={placement === 'inline' ? undefined : form.errors.anchorDate}
                label={fe15FinanceText.financeReportsScreen_label_0d21a5dd}
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
    <PageLayout data-testid="finance-screen" showHeader={false} title={fe15FinanceText.financeReportsScreen_title_d833b857}>
      <Stack gap="sm">
        {optionsError ? (
          <Alert
            color="yellow"
            icon={<IconAlertCircle size={18} />}
            title={fe15FinanceText.financeReportsScreen_title_63c4a3fc}
            variant="light"
          >
            {optionsError}
          </Alert>
        ) : null}

        {filterError ? (
          <Alert
            color="red"
            icon={<IconAlertCircle size={18} />}
            title={fe15FinanceText.financeReportsScreen_title_2c77fd50}
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

        {scopeTrustError ? (
          <Alert
            color="red"
            icon={<IconAlertCircle size={18} />}
            title={fe15FinanceText.financeReportsScreen_title_22162cc7}
            variant="light"
          >
            {scopeTrustError}
          </Alert>
        ) : null}

        <FinanceScopeHeader
          displayedReport={report}
          displayedScope={displayedReport?.scope ?? null}
          isRefreshing={isRefreshingReport}
          requestedScope={requestedScope}
        />

        <CompactFilterPanel
          actions={
            <Group className="finance-report-toolbar__actions" gap="xs" wrap="nowrap">
              {usesMobileFilterLayout && hasActiveFilters ? (
                <Button
                  aria-label={fe15FinanceText.financeReportsScreen_ariaLabel_bb6ea168}
                  className="finance-report-toolbar__mobile-reset"
                  leftSection={<IconFilterOff size={16} />}
                  onClick={handleResetFilters}
                  type="button"
                  variant="secondary"
                >
                  {fe15FinanceText.financeReportsScreen_jsxText_407f8717}</Button>
              ) : null}
              <TaskToolbarRefreshAction
                loading={reportLoading}
                onClick={() => setReloadKey((current) => current + 1)}
              />
            </Group>
          }
          className="finance-report-toolbar"
          data-testid="finance-filter-panel"
          mobileLabel={hasActiveFilters ? fe15FinanceText.financeReportsScreen_template_a545b6f5(activeFilterCount) : fe15FinanceText.financeReportsScreen_string_a69757b1}
          onReset={handleResetFilters}
          primary={primaryFilters}
          resetLabel={fe15FinanceText.financeReportsScreen_jsxText_407f8717}
          secondary={secondaryFilters}
          showReset={hasActiveFilters}
        />
      </Stack>

      <PageSection>
        <FinanceReportSurface
          displayedScope={displayedReport?.scope ?? null}
          failedRequest={activeFailedRequest}
          initialError={reportError}
          isInitialLoading={isInitialReportLoading}
          isMobile={isMobile}
          onRetry={() => setReloadKey((current) => current + 1)}
          report={scopeTrustError ? null : report}
        >
          {report ? (
            isMobile ? (
              <MobileBreakdowns report={report} />
            ) : (
              <DesktopBreakdowns report={report} />
            )
          ) : null}
        </FinanceReportSurface>
      </PageSection>
    </PageLayout>
  )
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
        <Accordion.Control>{fe15FinanceText.financeReportsScreen_jsxText_46b59b71}</Accordion.Control>
        <Accordion.Panel>
          <BranchBreakdownSection mobile rows={report.branchBreakdown} />
        </Accordion.Panel>
      </Accordion.Item>
      <Accordion.Item value="trainers">
        <Accordion.Control>{fe15FinanceText.financeReportsScreen_jsxText_fffad4a1}</Accordion.Control>
        <Accordion.Panel>
          <TrainerBreakdownSection mobile rows={report.trainerBreakdown} />
        </Accordion.Panel>
      </Accordion.Item>
      <Accordion.Item value="groups">
        <Accordion.Control>{fe15FinanceText.financeReportsScreen_jsxText_ece838e8}</Accordion.Control>
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
          label: fe15FinanceText.financeReportsScreen_label_2f17c4d2,
          render: (row) => row.branchName,
        },
        ...totalsColumns<FinancialReportBranchBreakdownRow>(),
      ]}
      emptyText={fe15FinanceText.financeReportsScreen_emptyText_3b975c5b}
      getRowId={(row, index) => `finance-branch-row-${row.branchId}-${index}`}
      getSubtitle={() => null}
      getTitle={(row) => row.branchName}
      metrics={totalsMobileMetrics<FinancialReportBranchBreakdownRow>()}
      mobile={mobile}
      rows={rows}
      testId="finance-branch-breakdown"
      title={fe15FinanceText.financeReportsScreen_jsxText_46b59b71}
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
          label: fe15FinanceText.financeReportsScreen_label_2f17c4d2,
          render: (row) => row.branchName,
        },
        {
          key: 'group',
          label: fe15FinanceText.financeReportsScreen_label_907efbd4,
          render: (row) => row.groupName,
        },
        ...totalsColumns<FinancialReportGroupBreakdownRow>(),
      ]}
      duplicateHint={duplicatedBreakdownHint}
      emptyText={fe15FinanceText.financeReportsScreen_emptyText_f08244d4}
      getRowId={(row, index) => `finance-group-row-${row.groupId}-${index}`}
      getSubtitle={(row) => row.branchName}
      getTitle={(row) => row.groupName}
      metrics={totalsMobileMetrics<FinancialReportGroupBreakdownRow>()}
      mobile={mobile}
      rows={rows}
      testId="finance-group-breakdown"
      title={fe15FinanceText.financeReportsScreen_jsxText_ece838e8}
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
          label: fe15FinanceText.financeReportsScreen_label_894d7ecc,
          render: (row) => row.trainerName,
        },
        ...totalsColumns<FinancialReportTrainerBreakdownRow>(),
      ]}
      duplicateHint={duplicatedBreakdownHint}
      emptyText={fe15FinanceText.financeReportsScreen_emptyText_77c767cb}
      getRowId={(row, index) => `finance-trainer-row-${row.trainerId}-${index}`}
      getSubtitle={() => null}
      getTitle={(row) => row.trainerName}
      metrics={totalsMobileMetrics<FinancialReportTrainerBreakdownRow>()}
      mobile={mobile}
      rows={rows}
      testId="finance-trainer-breakdown"
      title={fe15FinanceText.financeReportsScreen_jsxText_fffad4a1}
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
      label: fe15FinanceText.financeReportsScreen_label_355eef19,
      numeric: true,
      render: (row) => formatCount(row.soldMembershipCount),
    },
    {
      key: 'grossSales',
      label: fe15FinanceText.financeReportsScreen_label_6a187a49,
      numeric: true,
      render: (row) => formatMoney(row.grossSales),
    },
    {
      key: 'refundTotal',
      label: fe15FinanceText.financeReportsScreen_label_e8fdd443,
      numeric: true,
      render: (row) => formatMoney(row.refundTotal),
    },
    {
      key: 'netTotal',
      label: fe15FinanceText.financeReportsScreen_label_a748e6aa,
      numeric: true,
      render: (row) => formatMoney(row.netTotal),
    },
    {
      key: 'newClientsCount',
      label: fe15FinanceText.financeReportsScreen_label_32d5a2ea,
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
      label: fe15FinanceText.financeReportsScreen_label_355eef19,
      value: (row) => formatCount(row.soldMembershipCount),
    },
    {
      label: fe15FinanceText.financeReportsScreen_label_6a187a49,
      value: (row) => formatMoney(row.grossSales),
    },
    {
      label: fe15FinanceText.financeReportsScreen_label_e8fdd443,
      value: (row) => formatMoney(row.refundTotal),
    },
    {
      label: fe15FinanceText.financeReportsScreen_label_a748e6aa,
      value: (row) => formatMoney(row.netTotal),
    },
    {
      label: fe15FinanceText.financeReportsScreen_label_32d5a2ea,
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

function getActiveFilterCount(
  values: FinanceFilterValues,
  baseline: FinanceFilterValues,
) {
  let count = 0

  if (values.periodPreset !== baseline.periodPreset) {
    count += 1
  } else if (values.periodPreset === 'custom') {
    if (values.from !== baseline.from || values.to !== baseline.to) {
      count += 1
    }
  } else if (values.anchorDate !== baseline.anchorDate) {
    count += 1
  }

  if (values.branchId !== baseline.branchId) {
    count += 1
  }

  if (values.trainerId !== baseline.trainerId) {
    count += 1
  }

  return count
}

function hasSelectedScopeFilter(values: FinanceFilterValues) {
  return Boolean(values.branchId || values.trainerId)
}

function createSelectedScopeOptionsKey({
  filters,
  branchOptions,
  trainerOptions,
  optionsLoading,
  optionsError,
}: {
  filters: FinanceFilterValues
  branchOptions: Array<{ value: string; label: string }>
  trainerOptions: Array<{ value: string; label: string }>
  optionsLoading: boolean
  optionsError: string | null
}) {
  if (!hasSelectedScopeFilter(filters)) {
    return 'all-scope'
  }

  const branchLabel = filters.branchId
    ? branchOptions.find((option) => option.value === filters.branchId)?.label ?? ''
    : 'all'
  const trainerLabel = filters.trainerId
    ? trainerOptions.find((option) => option.value === filters.trainerId)?.label ?? ''
    : 'all'

  return [
    `branch:${filters.branchId ?? 'all'}:${branchLabel}`,
    `trainer:${filters.trainerId ?? 'all'}:${trainerLabel}`,
    `loading:${optionsLoading ? '1' : '0'}`,
    `error:${optionsError ? '1' : '0'}`,
  ].join('|')
}

function createFinanceRequestKey(values: FinanceFilterValues) {
  return JSON.stringify(toFinancialReportParams(values))
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
