import { type ReactNode } from 'react'
import {
  Alert,
  Checkbox,
  Group,
  MultiSelect,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core'
import type { UseFormReturnType } from '@mantine/form'
import {
  IconAlertCircle,
  IconCalendarWeek,
  IconClockHour4,
  IconDeviceFloppy,
  IconUserStar,
  IconUsersGroup,
} from '@tabler/icons-react'
import type { Branch, GroupType, Hall, TrainerOption } from '../../lib/api'
import {
  formatDurationMinutes,
  formatWeekdays,
  WEEKDAY_OPTIONS,
} from '../../lib/groupSchedule'
import { Button, ResponsiveButtonGroup } from '../shared/ux'
import {
  GROUPS_FORM_FALLBACK_VALUES,
  GROUPS_GRID_COLUMNS,
} from './groupManagement.constants'
import type { GroupFormValues } from './groupFormMapping'

export type GroupFormProps = {
  form: UseFormReturnType<GroupFormValues>
  formError: string | null
  branchOptions: Branch[]
  groupTypeOptions: GroupType[]
  hallOptions: Hall[]
  cancelAction: { label: string; onClick: () => void } | null
  onSubmit: (values: GroupFormValues) => Promise<void>
  showHallField?: boolean
  showInitialSeriesFields?: boolean
  showScheduleFields?: boolean
  showTrainerField?: boolean
  submitLabel: string
  submitting: boolean
  trainerOptions: TrainerOption[]
}

export function GroupForm({
  form,
  formError,
  branchOptions,
  groupTypeOptions,
  hallOptions,
  cancelAction,
  onSubmit,
  showHallField = true,
  showInitialSeriesFields = false,
  showScheduleFields = true,
  showTrainerField = true,
  submitLabel,
  submitting,
  trainerOptions,
}: GroupFormProps) {
  const selectedBranchId =
    form.values.branchId ||
    branchOptions.find((branch) => !branch.isArchived)?.id ||
    ''
  const filteredHallOptions = selectedBranchId
    ? hallOptions.filter((hall) => hall.branchId === selectedBranchId)
    : []

  function updateBranch(branchId: string | null) {
    const nextBranchId = branchId ?? ''
    const nextAllowedHallIds = new Set(
      hallOptions
        .filter((hall) => hall.branchId === nextBranchId)
        .map((hall) => hall.id),
    )

    form.setFieldValue('branchId', nextBranchId)
    if (!nextAllowedHallIds.has(form.values.hallId)) {
      form.setFieldValue('hallId', '')
    }
  }

  return (
    <form
      onSubmit={form.onSubmit((values) =>
        void onSubmit({
          ...values,
          branchId: values.branchId || selectedBranchId,
        }),
      )}
    >
      <Stack gap="lg">
        {formError ? (
          <Alert
            className="group-edit-form-recovery"
            color="red"
            icon={<IconAlertCircle size={18} />}
            tabIndex={-1}
            title="Сохранение не выполнено"
            variant="light"
          >
            {formError}
          </Alert>
        ) : null}

        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <Select
            allowDeselect={false}
            data={branchOptions.map((branch) => ({
              value: branch.id,
              label: formatBranchOptionLabel(branch),
              disabled: branch.isArchived,
            }))}
            label="Филиал"
            onChange={updateBranch}
            placeholder="Выберите филиал"
            searchable
            value={selectedBranchId || null}
            error={form.errors.branchId}
          />
          {showHallField ? (
            <Select
              allowDeselect={false}
              data={filteredHallOptions.map((hall) => ({
                value: hall.id,
                label: formatHallOptionLabel(hall),
                disabled: hall.isArchived,
              }))}
              disabled={!selectedBranchId}
              label="Зал"
              onChange={(hallId) => form.setFieldValue('hallId', hallId ?? '')}
              placeholder={selectedBranchId ? 'Выберите зал' : 'Сначала выберите филиал'}
              searchable
              value={form.values.hallId || null}
              error={form.errors.hallId}
            />
          ) : null}
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <TextInput
            label="Название группы"
            placeholder="Например, Юниоры 18:00"
            {...form.getInputProps('name')}
          />
          <Select
            allowDeselect={false}
            data={groupTypeOptions.map((groupType) => ({
              value: groupType.id,
              label: groupType.name,
            }))}
            label="Тип группы"
            onChange={(groupTypeId) =>
              form.setFieldValue('groupTypeId', groupTypeId ?? '')
            }
            placeholder="Выберите тип группы"
            searchable
            value={form.values.groupTypeId || null}
            error={form.errors.groupTypeId}
          />
        </SimpleGrid>

        {showScheduleFields ? (
          <>
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <TextInput
                label="Время начала"
                placeholder="18:00"
                type="time"
                {...form.getInputProps('trainingStartTime')}
              />
              <NumberInput
                allowDecimal={false}
                label="Длительность"
                onChange={(value) =>
                  form.setFieldValue(
                    'durationMinutes',
                    typeof value === 'number' ? value : '',
                  )
                }
                placeholder="60"
                suffix=" мин"
                value={form.values.durationMinutes}
                error={form.errors.durationMinutes}
              />
            </SimpleGrid>

            <Checkbox.Group
              label="Дни недели"
              onChange={(weekdays) => form.setFieldValue('weekdays', weekdays)}
              value={form.values.weekdays}
              error={form.errors.weekdays}
            >
              <Group gap="xs" mt="xs">
                {WEEKDAY_OPTIONS.map((option) => (
                  <Checkbox
                    key={option.value}
                    label={option.label}
                    value={option.value}
                  />
                ))}
              </Group>
            </Checkbox.Group>
          </>
        ) : null}

        {showInitialSeriesFields ? (
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <TextInput
              label="Начало расписания"
              max="9999-12-31"
              min="1900-01-01"
              type="date"
              {...form.getInputProps('initialSeriesStartsOn')}
            />
            <TextInput
              label="Окончание расписания"
              max="9999-12-31"
              min="1900-01-01"
              type="date"
              {...form.getInputProps('initialSeriesEndsOn')}
            />
          </SimpleGrid>
        ) : null}

        {showTrainerField ? (
          <MultiSelect
            data={trainerOptions.map((trainer) => ({
              value: trainer.id,
              label: `${trainer.fullName} (${trainer.login})`,
            }))}
            description="Можно выбрать несколько активных тренеров. Временное замещение на период настраивается отдельно и не меняет этот список."
            label="Основные тренеры группы"
            placeholder="Выберите тренеров"
            searchable
            {...form.getInputProps('trainerIds')}
          />
        ) : null}

        <Switch
          checked={form.values.isActive}
          color="teal"
          label="Группа активна"
          onChange={(event) =>
            form.setFieldValue('isActive', event.currentTarget.checked)
          }
        />

        <Paper className="hint-card" radius="24px" withBorder>
          <SimpleGrid cols={GROUPS_GRID_COLUMNS}>
            <HintStat
              icon={<IconUsersGroup size={18} />}
              label="Филиал"
              value={
                branchOptions.find((branch) => branch.id === form.values.branchId)?.name ??
                'Не выбран'
              }
            />
            <HintStat
              icon={<IconUsersGroup size={18} />}
              label="Тип"
              value={
                groupTypeOptions.find(
                  (groupType) => groupType.id === form.values.groupTypeId,
                )?.name ?? 'Не выбран'
              }
            />
            {showHallField ? (
              <HintStat
                icon={<IconUsersGroup size={18} />}
                label="Зал"
                value={
                  hallOptions.find((hall) => hall.id === form.values.hallId)?.name ??
                  'Не выбран'
                }
              />
            ) : null}
            {showScheduleFields ? (
              <>
                <HintStat
                  icon={<IconClockHour4 size={18} />}
                  label="Старт"
                  value={
                    form.values.trainingStartTime ||
                    GROUPS_FORM_FALLBACK_VALUES.trainingStartTime
                  }
                />
                <HintStat
                  icon={<IconCalendarWeek size={18} />}
                  label="Дни"
                  value={
                    form.values.weekdays.length > 0
                      ? formatWeekdays(form.values.weekdays.map(Number))
                      : GROUPS_FORM_FALLBACK_VALUES.weekdays
                  }
                />
                <HintStat
                  icon={<IconClockHour4 size={18} />}
                  label="Длительность"
                  value={
                    typeof form.values.durationMinutes === 'number'
                      ? formatDurationMinutes(form.values.durationMinutes)
                      : GROUPS_FORM_FALLBACK_VALUES.durationMinutes
                  }
                />
              </>
            ) : null}
            {showTrainerField ? (
              <HintStat
                icon={<IconUserStar size={18} />}
                label="Тренеры"
                value={String(form.values.trainerIds.length)}
              />
            ) : null}
          </SimpleGrid>
        </Paper>

        <Group justify="space-between" wrap="wrap">
          <Text c="dimmed" size="sm">
            {showTrainerField
              ? 'После сохранения тренеры увидят назначенную группу в своем рабочем списке.'
              : 'На этом экране сохраняются только название, филиал, тип и активность группы.'}
          </Text>

          <ResponsiveButtonGroup justify="flex-end">
            {cancelAction ? (
              <Button onClick={cancelAction.onClick} type="button" variant="subtle">
                {cancelAction.label}
              </Button>
            ) : null}
            <Button
              leftSection={<IconDeviceFloppy size={18} />}
              loading={submitting}
              type="submit"
            >
              {submitLabel}
            </Button>
          </ResponsiveButtonGroup>
        </Group>
      </Stack>
    </form>
  )
}

type HintStatProps = {
  icon: ReactNode
  label: string
  value: string
}

function HintStat({
  icon,
  label,
  value,
}: HintStatProps) {
  return (
    <Group gap="sm" wrap="nowrap">
      <ThemeIcon color="var(--crm-action-primary)" radius="xl" size={34} variant="light">
        {icon}
      </ThemeIcon>
      <Stack gap={2}>
        <Text c="dimmed" fw={600} size="xs">
          {label}
        </Text>
        <Text fw={700}>{value}</Text>
      </Stack>
    </Group>
  )
}

function formatBranchOptionLabel(branch: Branch) {
  const parts = [branch.name]

  if (branch.address) {
    parts.push(branch.address)
  }

  if (branch.isArchived) {
    parts.push('архивный')
  }

  return parts.join(' · ')
}

function formatHallOptionLabel(hall: Hall) {
  const parts = [hall.name]

  if (hall.isArchived) {
    parts.push('архивный')
  }

  return parts.join(' · ')
}
