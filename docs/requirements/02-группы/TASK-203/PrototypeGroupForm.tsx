// Design-only variant of the existing GroupForm; all shared primitives are imported from CRM.
import { getSemanticToneComponentProps } from '../../../../frontend/src/theme'
import { useRef } from 'react'
import {
  Alert,
  Checkbox,
  Group,
  MultiSelect,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core'
import type { UseFormReturnType } from '@mantine/form'
import {
  IconAlertCircle,
  IconDeviceFloppy,
} from '@tabler/icons-react'
import type { Branch, GroupType, Hall, TrainerOption } from '../../../../frontend/src/lib/api'
import {
  WEEKDAY_OPTIONS,
} from '../../../../frontend/src/lib/groupSchedule'
import { Button, StickyFormActions } from '../../../../frontend/src/features/shared/ux'
import type { GroupFormValues } from '../../../../frontend/src/features/groups/groupFormMapping'
import { fe13GroupsCoreText } from '../../../../frontend/src/resources/fe-13-groups-core'


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
  resultUnknown?: boolean
  onCheckList?: () => void
  trainerOptions: TrainerOption[]
}

export function PrototypeGroupForm({
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
  resultUnknown,
  onCheckList,
}: GroupFormProps) {
  const formElementRef = useRef<HTMLFormElement>(null)

  function focusFirstError() {
    window.requestAnimationFrame(() => {
      formElementRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    })
  }

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
      ref={formElementRef}
      onSubmit={(event) => form.onSubmit((values) =>
        void onSubmit({
          ...values,
          branchId: values.branchId || selectedBranchId,
        }),
        focusFirstError,
      )(event)}
    >
      <Stack gap="lg">
        {formError ? (
          <Alert
            className="group-edit-form-recovery"
            {...getSemanticToneComponentProps("danger")}
            icon={<IconAlertCircle size={18} />}
            tabIndex={-1}
            title="Не удалось создать группу"
            variant="light"
          >
            {formError}
          </Alert>
        ) : null}

        <fieldset className="prototype-fields" disabled={submitting || resultUnknown}>
        <Stack gap="lg">
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
          <Stack gap="md" className="group-weekday-schedule">
            <Text fw={700}>{fe13GroupsCoreText.scheduleTitle}</Text>
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
              <Stack gap="md">
                <Checkbox.Group
                  id="prototype-weekdays"
                  label={fe13GroupsCoreText.groupForm_label_86f463be}
                  onChange={(weekdays) => form.setFieldValue('weekdays', weekdays)}
                  value={form.values.weekdays}
                  error={form.errors.weekdays}
                >
                  <Group gap="xs" mt="xs" className="group-weekday-choices">
                    {WEEKDAY_OPTIONS.map((option) => (
                      <Checkbox
                        className="group-weekday-choice"
                        aria-invalid={form.errors.weekdays ? true : undefined}
                        aria-describedby={form.errors.weekdays ? "prototype-weekdays-error" : undefined}
                        key={option.value}
                        label={option.label}
                        value={option.value}
                      />
                    ))}
                  </Group>
                </Checkbox.Group>
                {WEEKDAY_OPTIONS.filter(option => form.values.weekdays.includes(option.value)).map(option => (
                  <TextInput
                    classNames={{ root: 'group-weekday-time', wrapper: 'group-weekday-time__input' }}
                    key={option.value}
                    label={fe13GroupsCoreText.weekdayNames[option.value]}
                    aria-label={fe13GroupsCoreText.weekdayTimeLabel(fe13GroupsCoreText.weekdayNames[option.value])}
                    type="time"
                    value={form.values.weekdayStartTimes[option.value] ?? ''}
                    onChange={event => form.setFieldValue(`weekdayStartTimes.${option.value}`, event.currentTarget.value)}
                    error={form.errors[`weekdayStartTimes.${option.value}`]}
                  />
                ))}
              </Stack>
              <Stack gap="md">
                <NumberInput
                  allowDecimal={false}
                  label={fe13GroupsCoreText.groupForm_label_2a326071}
                  description="От 1 до 180 минут, одинаковая для всех дней."
                  onChange={(value) => form.setFieldValue('durationMinutes', typeof value === 'number' ? value : '')}
                  placeholder={fe13GroupsCoreText.groupForm_placeholder_39fa9ec1}
                  suffix={fe13GroupsCoreText.groupForm_suffix_84d5d93d}
                  value={form.values.durationMinutes}
                  error={form.errors.durationMinutes}
                />
                {showInitialSeriesFields ? (
                  <>
                    <TextInput
                      label={fe13GroupsCoreText.groupForm_label_3e2bef5c}
                      max="9999-12-31"
                      min="1900-01-01"
                      type="date"
                      {...form.getInputProps('initialSeriesStartsOn')}
                    />
                    <TextInput
                      label="Окончание расписания (необязательно)"
                      description="Оставьте пустым, если дата окончания неизвестна."
                      max="9999-12-31"
                      min="1900-01-01"
                      type="date"
                      {...form.getInputProps('initialSeriesEndsOn')}
                    />
                  </>
                ) : null}
              </Stack>
            </SimpleGrid>
          </Stack>
        ) : null}

        {showTrainerField ? (
          <MultiSelect
            data={trainerOptions.map((trainer) => ({
              value: trainer.id,
              label: fe13GroupsCoreText.groupForm_label_a0ff92dd(trainer.fullName, trainer.login),
            }))}
            description={fe13GroupsCoreText.groupForm_description_28716432}
            label="Основные тренеры группы (необязательно)"
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


        </Stack>
        </fieldset>
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
            primaryAction={resultUnknown ? <Button onClick={onCheckList} type="button">Проверить список групп</Button> : <Button
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
