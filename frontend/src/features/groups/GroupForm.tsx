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
import { Button, StickyFormActions } from '../shared/ux'
import {
  GROUPS_FORM_FALLBACK_VALUES,
  GROUPS_GRID_COLUMNS,
} from './groupManagement.constants'
import type { GroupFormValues } from './groupFormMapping'
import { fe13GroupsCoreText } from '../../resources/fe-13-groups-core'


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
            title={fe13GroupsCoreText.groupForm_title_09e1875e}
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
            label={fe13GroupsCoreText.groupForm_label_2f17c4d2}
            onChange={updateBranch}
            placeholder={fe13GroupsCoreText.groupForm_placeholder_4c5ee5d8}
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
              label={fe13GroupsCoreText.groupForm_label_182f7c57}
              onChange={(hallId) => form.setFieldValue('hallId', hallId ?? '')}
              placeholder={selectedBranchId ? fe13GroupsCoreText.groupForm_string_d52c67f8 : fe13GroupsCoreText.groupForm_string_74f8ad03}
              searchable
              value={form.values.hallId || null}
              error={form.errors.hallId}
            />
          ) : null}
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <TextInput
            label={fe13GroupsCoreText.groupForm_label_d45e66ab}
            placeholder={fe13GroupsCoreText.groupForm_placeholder_d9cf2b88}
            {...form.getInputProps('name')}
          />
          <Select
            allowDeselect={false}
            data={groupTypeOptions.map((groupType) => ({
              value: groupType.id,
              label: groupType.name,
            }))}
            label={fe13GroupsCoreText.groupForm_label_a642a677}
            onChange={(groupTypeId) =>
              form.setFieldValue('groupTypeId', groupTypeId ?? '')
            }
            placeholder={fe13GroupsCoreText.groupForm_placeholder_522e39df}
            searchable
            value={form.values.groupTypeId || null}
            error={form.errors.groupTypeId}
          />
        </SimpleGrid>

        {showScheduleFields ? (
          <>
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <TextInput
                label={fe13GroupsCoreText.groupForm_label_1635ad1f}
                placeholder={fe13GroupsCoreText.groupForm_placeholder_cf5d1124}
                type="time"
                {...form.getInputProps('trainingStartTime')}
              />
              <NumberInput
                allowDecimal={false}
                label={fe13GroupsCoreText.groupForm_label_2a326071}
                onChange={(value) =>
                  form.setFieldValue(
                    'durationMinutes',
                    typeof value === 'number' ? value : '',
                  )
                }
                placeholder={fe13GroupsCoreText.groupForm_placeholder_39fa9ec1}
                suffix={fe13GroupsCoreText.groupForm_suffix_84d5d93d}
                value={form.values.durationMinutes}
                error={form.errors.durationMinutes}
              />
            </SimpleGrid>

            <Checkbox.Group
              label={fe13GroupsCoreText.groupForm_label_86f463be}
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
              label={fe13GroupsCoreText.groupForm_label_3e2bef5c}
              max="9999-12-31"
              min="1900-01-01"
              type="date"
              {...form.getInputProps('initialSeriesStartsOn')}
            />
            <TextInput
              label={fe13GroupsCoreText.groupForm_label_da09e40b}
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
              label: fe13GroupsCoreText.groupForm_label_a0ff92dd(trainer.fullName, trainer.login),
            }))}
            description={fe13GroupsCoreText.groupForm_description_28716432}
            label={fe13GroupsCoreText.groupForm_label_9fb9bbfa}
            placeholder={fe13GroupsCoreText.groupForm_placeholder_06e7e5cc}
            searchable
            {...form.getInputProps('trainerIds')}
          />
        ) : null}

        <Switch
          checked={form.values.isActive}
          color="teal"
          label={fe13GroupsCoreText.groupForm_label_54ca642f}
          onChange={(event) =>
            form.setFieldValue('isActive', event.currentTarget.checked)
          }
        />

        <Paper className="hint-card" radius="24px" withBorder>
          <SimpleGrid cols={GROUPS_GRID_COLUMNS}>
            <HintStat
              icon={<IconUsersGroup size={18} />}
              label={fe13GroupsCoreText.groupForm_label_2f17c4d2}
              value={
                branchOptions.find((branch) => branch.id === form.values.branchId)?.name ??
                fe13GroupsCoreText.groupForm_string_d77dfdcd
              }
            />
            <HintStat
              icon={<IconUsersGroup size={18} />}
              label={fe13GroupsCoreText.groupForm_label_d4a6795c}
              value={
                groupTypeOptions.find(
                  (groupType) => groupType.id === form.values.groupTypeId,
                )?.name ?? fe13GroupsCoreText.groupForm_string_d77dfdcd
              }
            />
            {showHallField ? (
              <HintStat
                icon={<IconUsersGroup size={18} />}
                label={fe13GroupsCoreText.groupForm_label_182f7c57}
                value={
                  hallOptions.find((hall) => hall.id === form.values.hallId)?.name ??
                  fe13GroupsCoreText.groupForm_string_d77dfdcd
                }
              />
            ) : null}
            {showScheduleFields ? (
              <>
                <HintStat
                  icon={<IconClockHour4 size={18} />}
                  label={fe13GroupsCoreText.groupForm_label_d8b0757a}
                  value={
                    form.values.trainingStartTime ||
                    GROUPS_FORM_FALLBACK_VALUES.trainingStartTime
                  }
                />
                <HintStat
                  icon={<IconCalendarWeek size={18} />}
                  label={fe13GroupsCoreText.groupForm_label_480102a9}
                  value={
                    form.values.weekdays.length > 0
                      ? formatWeekdays(form.values.weekdays.map(Number))
                      : GROUPS_FORM_FALLBACK_VALUES.weekdays
                  }
                />
                <HintStat
                  icon={<IconClockHour4 size={18} />}
                  label={fe13GroupsCoreText.groupForm_label_2a326071}
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
                label={fe13GroupsCoreText.groupForm_label_0314946c}
                value={String(form.values.trainerIds.length)}
              />
            ) : null}
          </SimpleGrid>
        </Paper>

        <Group justify="space-between" wrap="wrap">
          <Text c="dimmed" size="sm">
            {showTrainerField
              ? fe13GroupsCoreText.groupForm_string_86ad6462
              : fe13GroupsCoreText.groupForm_string_96ac21d7}
          </Text>

          <StickyFormActions
            secondaryAction={cancelAction ? (
              <Button onClick={cancelAction.onClick} type="button" variant="subtle">
                {cancelAction.label}
              </Button>
            ) : undefined}
            primaryAction={<Button
              leftSection={<IconDeviceFloppy size={18} />}
              loading={submitting}
              type="submit"
            >
              {submitLabel}
            </Button>}
          />
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
    parts.push(fe13GroupsCoreText.groupForm_partsPush_4ebaca56)
  }

  return parts.join(' · ')
}

function formatHallOptionLabel(hall: Hall) {
  const parts = [hall.name]

  if (hall.isArchived) {
    parts.push(fe13GroupsCoreText.groupForm_partsPush_4ebaca56)
  }

  return parts.join(' · ')
}
