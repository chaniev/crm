import { useCallback, useEffect, useState } from 'react'
import { Alert, Badge, Group, Paper, Stack, Text } from '@mantine/core'
import {
  IconAlertCircle,
  IconRefresh,
  IconUserCheck,
} from '@tabler/icons-react'
import {
  getGroupTrainerSubstitutions,
  type GroupTrainerSubstitution,
  type GroupTrainerSubstitutionsResponse,
} from '../../lib/api'
import {
  Button,
  EmptyState,
  LoadingState,
  ResponsiveButtonGroup,
  SectionHeader,
} from '../shared/ux'
import { fe14GroupStaffingText } from '../../resources/fe-14-group-staffing'


const HISTORY_TAKE = 20

type GroupTrainerSubstitutionsSectionProps = {
  groupId: string
}

const STATUS_LABELS: Record<GroupTrainerSubstitution['status'], string> = {
  Active: fe14GroupStaffingText.groupTrainerSubstitutionsSection_active_68505b6d,
  Upcoming: fe14GroupStaffingText.groupTrainerSubstitutionsSection_upcoming_c4c9abc1,
  Expired: fe14GroupStaffingText.groupTrainerSubstitutionsSection_expired_b459ff8f,
  Cancelled: fe14GroupStaffingText.groupTrainerSubstitutionsSection_cancelled_23a2a9bf,
}

const STATUS_COLORS: Record<GroupTrainerSubstitution['status'], string> = {
  Active: 'teal',
  Upcoming: 'var(--crm-brand-primary-soft)',
  Expired: 'gray',
  Cancelled: 'red',
}

export function GroupTrainerSubstitutionsSection({
  groupId,
}: GroupTrainerSubstitutionsSectionProps) {
  const [data, setData] = useState<GroupTrainerSubstitutionsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [historyOpened, setHistoryOpened] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const loadFirstPage = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setLoadError(null)
    setHistoryError(null)

    try {
      const nextData = await getGroupTrainerSubstitutions(
        groupId,
        { historySkip: 0, historyTake: HISTORY_TAKE },
        signal,
      )
      setData(nextData)
    } catch (error) {
      if (signal?.aborted) {
        return
      }

      setLoadError(error instanceof Error ? error.message : fe14GroupStaffingText.groupTrainerSubstitutionsSection_string_0cb0e0e6)
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
      }
    }
  }, [groupId])

  useEffect(() => {
    const controller = new AbortController()

    void loadFirstPage(controller.signal)

    return () => controller.abort()
  }, [groupId, loadFirstPage])

  async function loadMoreHistory() {
    if (!data || historyLoading) {
      return
    }

    setHistoryLoading(true)
    setHistoryError(null)

    try {
      const nextData = await getGroupTrainerSubstitutions(groupId, {
        historySkip: data.history.items.length,
        historyTake: HISTORY_TAKE,
      })
      setData({
        ...nextData,
        history: {
          ...nextData.history,
          items: [...data.history.items, ...nextData.history.items],
          totalCount: nextData.history.totalCount,
          skip: 0,
          take: data.history.items.length + nextData.history.items.length,
        },
      })
    } catch (error) {
      setHistoryError(
        error instanceof Error ? error.message : fe14GroupStaffingText.groupTrainerSubstitutionsSection_string_e92898f1,
      )
    } finally {
      setHistoryLoading(false)
    }
  }

  const historyItems = data?.history.items ?? []
  const historyTotalCount = data?.history.totalCount ?? 0
  const hasMoreHistory = data
    ? data.history.items.length < data.history.totalCount
    : false

  return (
    <section aria-labelledby="group-trainer-substitutions-title">
      <Stack gap="lg">
        <SectionHeader
          description={fe14GroupStaffingText.groupTrainerSubstitutionsSection_description_bfe9a56a}
          title={fe14GroupStaffingText.groupTrainerSubstitutionsSection_title_4e2bc0cd}
          titleId="group-trainer-substitutions-title"
        />

        {loading ? (
          <LoadingState label={fe14GroupStaffingText.groupTrainerSubstitutionsSection_label_10365fea} />
        ) : null}

        {!loading && loadError ? (
          <Alert
            color="red"
            icon={<IconAlertCircle size={18} />}
            role="alert"
            title={fe14GroupStaffingText.groupTrainerSubstitutionsSection_title_3b8a3e5b}
            variant="light"
          >
            <Stack gap="sm">
              <Text>{loadError}</Text>
              <ResponsiveButtonGroup>
                <Button
                  leftSection={<IconRefresh size={18} />}
                  onClick={() => void loadFirstPage()}
                  variant="secondary"
                >
                  {fe14GroupStaffingText.groupTrainerSubstitutionsSection_jsxText_34a89a26}</Button>
              </ResponsiveButtonGroup>
            </Stack>
          </Alert>
        ) : null}

        {historyError ? (
          <Alert
            color="red"
            icon={<IconAlertCircle size={18} />}
            role="alert"
            title={fe14GroupStaffingText.groupTrainerSubstitutionsSection_title_2e1514c4}
            variant="light"
          >
            {historyError}
          </Alert>
        ) : null}

        {!loading && !loadError && data ? (
          <Stack gap="md">
            <Alert color="gray" variant="light">
              {fe14GroupStaffingText.groupTrainerSubstitutionsSection_jsxText_993cc81f}</Alert>

            <Stack gap="sm">
              <Text component="h3" fw={700} size="md">
                {fe14GroupStaffingText.groupTrainerSubstitutionsSection_jsxText_7ca077e4}</Text>

              {data.current.length === 0 ? (
                <EmptyState
                  description={fe14GroupStaffingText.groupTrainerSubstitutionsSection_description_fcc54bde}
                  icon={<IconUserCheck size={24} />}
                  title={fe14GroupStaffingText.groupTrainerSubstitutionsSection_title_38aa0143}
                />
              ) : (
                <Stack aria-label={fe14GroupStaffingText.groupTrainerSubstitutionsSection_ariaLabel_8c0dc67f} gap="sm" role="list">
                  {data.current.map((substitution) => (
                    <SubstitutionCard
                      key={substitution.id}
                      substitution={substitution}
                    />
                  ))}
                </Stack>
              )}
            </Stack>

            <Stack gap="sm">
              <Group justify="space-between" wrap="wrap">
                <Stack gap={2}>
                  <Text component="h3" fw={700} size="md">
                    {fe14GroupStaffingText.groupTrainerSubstitutionsSection_jsxText_1417b779}</Text>
                  <Text c="dimmed" size="sm">
                    {fe14GroupStaffingText.groupTrainerSubstitutionsSection_jsxText_1a48f320}{historyItems.length} {fe14GroupStaffingText.groupTrainerSubstitutionsSection_jsxText_7f4adf31}{historyTotalCount}
                  </Text>
                </Stack>
                <Button
                  aria-controls="group-trainer-substitutions-history"
                  aria-expanded={historyOpened}
                  disabled={historyTotalCount === 0}
                  onClick={() => setHistoryOpened((opened) => !opened)}
                  variant="subtle"
                >
                  {historyOpened ? fe14GroupStaffingText.groupTrainerSubstitutionsSection_string_f3b6b22a : fe14GroupStaffingText.groupTrainerSubstitutionsSection_string_2d015c26}
                </Button>
              </Group>

              {historyOpened ? (
                <Stack
                  aria-label={fe14GroupStaffingText.groupTrainerSubstitutionsSection_ariaLabel_c3c5b156}
                  gap="sm"
                  id="group-trainer-substitutions-history"
                  role="list"
                >
                  {historyItems.map((substitution) => (
                    <SubstitutionCard
                      key={substitution.id}
                      substitution={substitution}
                    />
                  ))}

                  {hasMoreHistory ? (
                    <ResponsiveButtonGroup>
                      <Button
                        loading={historyLoading}
                        onClick={() => void loadMoreHistory()}
                        variant="secondary"
                      >
                        {fe14GroupStaffingText.groupTrainerSubstitutionsSection_jsxText_c6826c78}</Button>
                    </ResponsiveButtonGroup>
                  ) : null}
                </Stack>
              ) : null}
            </Stack>
          </Stack>
        ) : null}
      </Stack>
    </section>
  )
}

type SubstitutionCardProps = {
  substitution: GroupTrainerSubstitution
}

function SubstitutionCard({
  substitution,
}: SubstitutionCardProps) {
  return (
    <Paper
      className="list-row-card group-trainer-substitution-row"
      data-testid={`group-trainer-substitution-${substitution.id}`}
      radius="24px"
      role="listitem"
      withBorder
    >
      <Stack gap="md">
        <Group align="flex-start" justify="space-between" wrap="wrap">
          <Stack gap={6}>
            <Group gap="sm" wrap="wrap">
              <Text fw={700}>{substitution.substituteTrainer.fullName}</Text>
              <Badge color={STATUS_COLORS[substitution.status]} radius="xl" variant="light">
                {STATUS_LABELS[substitution.status]}
              </Badge>
              {!substitution.substituteTrainer.isActive ? (
                <Badge color="gray" radius="xl" variant="outline">
                  {fe14GroupStaffingText.groupTrainerSubstitutionsSection_jsxText_5539f6e6}</Badge>
              ) : null}
            </Group>
            <Text c="dimmed" size="sm">
              {fe14GroupStaffingText.groupTrainerSubstitutionsSection_jsxText_8541e28c}{substitution.substituteTrainer.login}
            </Text>
            <Text c="dimmed" size="sm">
              <time dateTime={substitution.startsOn}>
                {fe14GroupStaffingText.groupTrainerSubstitutionsSection_jsxText_a1f5d39a}{formatDateOnly(substitution.startsOn)}
              </time>
              {' - '}
              <time dateTime={substitution.endsOn}>
                {fe14GroupStaffingText.groupTrainerSubstitutionsSection_jsxText_51ad1397}{formatDateOnly(substitution.endsOn)} {fe14GroupStaffingText.groupTrainerSubstitutionsSection_jsxText_e072195b}</time>
            </Text>
          </Stack>
        </Group>
      </Stack>
    </Paper>
  )
}

function formatDateOnly(value: string) {
  const [year, month, day] = value.split('-')

  return year && month && day ? `${day}.${month}.${year}` : value
}
