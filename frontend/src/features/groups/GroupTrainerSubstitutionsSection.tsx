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

const HISTORY_TAKE = 20

type GroupTrainerSubstitutionsSectionProps = {
  groupId: string
}

const STATUS_LABELS: Record<GroupTrainerSubstitution['status'], string> = {
  Active: 'Активно',
  Upcoming: 'Запланировано',
  Expired: 'Завершено',
  Cancelled: 'Отменено',
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

      setLoadError(error instanceof Error ? error.message : 'Не удалось загрузить замещения.')
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
        error instanceof Error ? error.message : 'Не удалось загрузить историю замещений.',
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
          description="Старые периодные замещения доступны только для просмотра. Изменение тренера для конкретного занятия появится отдельным действием в календаре."
          title="Временные замещения"
          titleId="group-trainer-substitutions-title"
        />

        {loading ? (
          <LoadingState label="Загружаем временные замещения..." />
        ) : null}

        {!loading && loadError ? (
          <Alert
            color="red"
            icon={<IconAlertCircle size={18} />}
            role="alert"
            title="Замещения не загрузились"
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
                  Повторить загрузку замещений
                </Button>
              </ResponsiveButtonGroup>
            </Stack>
          </Alert>
        ) : null}

        {historyError ? (
          <Alert
            color="red"
            icon={<IconAlertCircle size={18} />}
            role="alert"
            title="История не загрузилась"
            variant="light"
          >
            {historyError}
          </Alert>
        ) : null}

        {!loading && !loadError && data ? (
          <Stack gap="md">
            <Alert color="gray" variant="light">
              Создание, изменение и отмена периодных замещений отключены в календаре занятий.
            </Alert>

            <Stack gap="sm">
              <Text component="h3" fw={700} size="md">
                Текущие и будущие
              </Text>

              {data.current.length === 0 ? (
                <EmptyState
                  description="Текущие и будущие временные назначения будут показаны здесь только для контроля старых данных."
                  icon={<IconUserCheck size={24} />}
                  title="Текущих и будущих замещений нет"
                />
              ) : (
                <Stack aria-label="Текущие и будущие замещения" gap="sm" role="list">
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
                    История
                  </Text>
                  <Text c="dimmed" size="sm">
                    Показано {historyItems.length} из {historyTotalCount}
                  </Text>
                </Stack>
                <Button
                  aria-controls="group-trainer-substitutions-history"
                  aria-expanded={historyOpened}
                  disabled={historyTotalCount === 0}
                  onClick={() => setHistoryOpened((opened) => !opened)}
                  variant="subtle"
                >
                  {historyOpened ? 'Скрыть историю замещений' : 'Показать историю замещений'}
                </Button>
              </Group>

              {historyOpened ? (
                <Stack
                  aria-label="История временных замещений"
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
                        Показать ещё
                      </Button>
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
                  Неактивный тренер
                </Badge>
              ) : null}
            </Group>
            <Text c="dimmed" size="sm">
              Логин: {substitution.substituteTrainer.login}
            </Text>
            <Text c="dimmed" size="sm">
              <time dateTime={substitution.startsOn}>
                с {formatDateOnly(substitution.startsOn)}
              </time>
              {' - '}
              <time dateTime={substitution.endsOn}>
                по {formatDateOnly(substitution.endsOn)} включительно
              </time>
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
