import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Badge,
  Button,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import {
  IconCalendarWeek,
  IconClockHour4,
  IconMapPin,
  IconPencil,
  IconUsers,
} from '@tabler/icons-react'
import {
  getGroups,
  type TrainingGroupListItem,
} from '../../lib/api'
import {
  buildGroupWeekSchedule,
  formatDurationMinutes,
  formatTrainingStartTime,
} from '../../lib/groupSchedule'
import {
  ErrorState,
  LoadingState,
  PageCard,
  PageHeader,
  RefreshButton,
  ResponsiveButtonGroup,
} from '../shared/ux'

const SCHEDULE_GROUPS_PAGE_SIZE = 100

type GroupScheduleScreenProps = {
  canManageGroups: boolean
  onEditGroup: (groupId: string) => void
}

export function GroupScheduleScreen({
  canManageGroups,
  onEditGroup,
}: GroupScheduleScreenProps) {
  const [groups, setGroups] = useState<TrainingGroupListItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const firstLoadRef = useRef(true)
  const weekSchedule = useMemo(() => buildGroupWeekSchedule(groups), [groups])

  useEffect(() => {
    const controller = new AbortController()
    const isInitialLoad = firstLoadRef.current

    async function load() {
      if (isInitialLoad) {
        setLoading(true)
      } else {
        setRefreshing(true)
      }

      setError(null)

      try {
        const response = await getAccessibleScheduleGroups(controller.signal)

        setGroups(response.items)
        setTotalCount(response.totalCount)
      } catch (loadError) {
        if (controller.signal.aborted) {
          return
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Не удалось загрузить расписание.',
        )
      } finally {
        if (!controller.signal.aborted) {
          firstLoadRef.current = false
          setLoading(false)
          setRefreshing(false)
        }
      }
    }

    void load()

    return () => controller.abort()
  }, [reloadKey])

  const isInitialLoading = loading && groups.length === 0
  const hasStaleSchedule = groups.length > 0

  return (
    <Stack className="dashboard-stack schedule-screen" data-testid="schedule-screen" gap="xl">
      <PageCard className="page-header-card">
        <PageHeader
          actions={(
            <ResponsiveButtonGroup justify="flex-end">
              <RefreshButton
                label="Обновить"
                loading={loading || refreshing}
                onClick={() => setReloadKey((currentKey) => currentKey + 1)}
              />
            </ResponsiveButtonGroup>
          )}
          description="Недельный список групповых занятий показывает только группы, доступные текущему пользователю."
          eyebrow={(
            <Group gap="sm">
              <Badge color="brand.1" radius="xl" size="lg" variant="light">
                Групповые занятия
              </Badge>
              <Badge color="sand" radius="xl" size="lg" variant="light">
                Показано {groups.length} из {totalCount}
              </Badge>
            </Group>
          )}
          title="Расписание"
        />
      </PageCard>

      {isInitialLoading ? (
        <PageCard>
          <LoadingState label="Загружаем расписание..." />
        </PageCard>
      ) : null}

      {!isInitialLoading && error ? (
        <PageCard>
          <ErrorState
            action={(
              <RefreshButton
                label="Повторить"
                loading={refreshing}
                onClick={() => setReloadKey((currentKey) => currentKey + 1)}
                variant="secondary"
              />
            )}
            message={error}
            title={
              hasStaleSchedule
                ? 'Не удалось обновить расписание'
                : 'Расписание не загрузилось'
            }
          />
        </PageCard>
      ) : null}

      {!isInitialLoading && (!error || hasStaleSchedule) ? (
        <Paper
          className="surface-card surface-card--wide schedule-board"
          data-testid="schedule-board"
          radius="var(--radius-card)"
          withBorder
        >
          <SimpleGrid className="schedule-week-grid" cols={{ base: 1, sm: 2, lg: 3, xl: 4 }}>
            {weekSchedule.map((day) => (
              <Paper
                className="schedule-day-card"
                data-testid={`schedule-day-${day.weekday}`}
                key={day.weekday}
                radius="var(--radius-inner)"
                withBorder
              >
                <Stack gap="md">
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="xs" wrap="nowrap">
                      <ThemeIcon color="brand.7" radius="xl" size={32} variant="light">
                        <IconCalendarWeek size={18} />
                      </ThemeIcon>
                      <Title className="schedule-day-card__title" order={3}>
                        {day.label}
                      </Title>
                    </Group>
                    <Badge
                      data-testid={`schedule-day-count-${day.weekday}`}
                      radius="xl"
                      variant="light"
                    >
                      {day.entries.length}
                    </Badge>
                  </Group>

                  {day.entries.length === 0 ? (
                    <ScheduleDayEmpty />
                  ) : (
                    <Stack gap="sm">
                      {day.entries.map((group) => (
                        <ScheduleGroupCard
                          canManageGroups={canManageGroups}
                          group={group}
                          key={group.id}
                          onEditGroup={onEditGroup}
                          weekday={day.weekday}
                        />
                      ))}
                    </Stack>
                  )}
                </Stack>
              </Paper>
            ))}
          </SimpleGrid>
        </Paper>
      ) : null}
    </Stack>
  )
}

type ScheduleGroupCardProps = {
  canManageGroups: boolean
  group: TrainingGroupListItem
  onEditGroup: (groupId: string) => void
  weekday: number
}

function ScheduleGroupCard({
  canManageGroups,
  group,
  onEditGroup,
  weekday,
}: ScheduleGroupCardProps) {
  return (
    <Paper
      className="schedule-class-card"
      data-testid={`schedule-card-${weekday}-${group.id}`}
      radius="md"
      withBorder
    >
      <Stack gap="sm">
        <Group align="flex-start" justify="space-between" wrap="wrap">
          <Stack className="schedule-class-card__copy" gap={4}>
            <Group gap="xs" wrap="nowrap">
              <Text className="schedule-class-card__time" fw={800}>
                {formatTrainingStartTime(group.trainingStartTime)}
              </Text>
              <Text className="schedule-class-card__name" fw={800}>
                {group.name}
              </Text>
            </Group>

            <Group gap="xs" wrap="wrap">
              <Badge color="brand.1" radius="xl" variant="light">
                {group.groupTypeName}
              </Badge>
              <Badge color="sand" radius="xl" variant="light">
                {formatDurationMinutes(group.durationMinutes)}
              </Badge>
              {!group.isActive ? (
                <Badge color="gray" radius="xl" variant="light">
                  Неактивна
                </Badge>
              ) : null}
            </Group>
          </Stack>

          {canManageGroups ? (
            <Button
              aria-label={`Редактировать группу ${group.name}`}
              className="schedule-class-card__edit"
              leftSection={<IconPencil size={16} />}
              onClick={() => onEditGroup(group.id)}
              size="xs"
              variant="light"
            >
              Редактировать
            </Button>
          ) : null}
        </Group>

        <Stack gap={5}>
          <Group className="schedule-class-card__meta" gap="xs" wrap="nowrap">
            <IconMapPin size={15} />
            <Text size="sm">
              {group.branchName} · {group.hallName}
            </Text>
          </Group>
          <Group className="schedule-class-card__meta" gap="xs" wrap="nowrap">
            <IconUsers size={15} />
            <Text className="schedule-class-card__trainers" size="sm">
              {formatTrainerNames(group)}
            </Text>
          </Group>
        </Stack>
      </Stack>
    </Paper>
  )
}

function ScheduleDayEmpty() {
  return (
    <Paper className="schedule-day-empty" radius="md" withBorder>
      <Group gap="sm" wrap="nowrap">
        <ThemeIcon color="gray" radius="xl" size={34} variant="light">
          <IconClockHour4 size={18} />
        </ThemeIcon>
        <Stack gap={2}>
          <Text fw={700} size="sm">
            Занятий нет
          </Text>
          <Text c="dimmed" size="xs">
            День свободен для доступных групп.
          </Text>
        </Stack>
      </Group>
    </Paper>
  )
}

async function getAccessibleScheduleGroups(signal: AbortSignal) {
  const firstPage = await getGroups(
    { skip: 0, take: SCHEDULE_GROUPS_PAGE_SIZE },
    signal,
  )
  const items = [...firstPage.items]
  let totalCount = firstPage.totalCount

  while (items.length < totalCount) {
    const nextPage = await getGroups(
      { skip: items.length, take: SCHEDULE_GROUPS_PAGE_SIZE },
      signal,
    )

    if (nextPage.items.length === 0) {
      break
    }

    items.push(...nextPage.items)
    totalCount = Math.max(totalCount, nextPage.totalCount)
  }

  return {
    items,
    totalCount,
  }
}

function formatTrainerNames(group: TrainingGroupListItem) {
  if (group.trainerNames.length > 0) {
    return `Тренеры: ${group.trainerNames.join(', ')}`
  }

  if (group.trainers.length > 0) {
    return `Тренеры: ${group.trainers.map((trainer) => trainer.fullName).join(', ')}`
  }

  return 'Тренеры пока не назначены'
}
