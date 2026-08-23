import { useEffect, useRef, useState } from 'react'
import { Alert, Paper, Stack, Text } from '@mantine/core'
import { IconAlertTriangle, IconArrowLeft } from '@tabler/icons-react'
import {
  ApiError,
  applyFieldErrors,
  createGroup,
  getBranches,
  getGroupTypes,
  getHalls,
  getTrainerOptions,
  previewGroupCreate,
  type Branch,
  type GroupPreviewResponse,
  type GroupType,
  type Hall,
  type TrainerOption,
} from '../../lib/api'
import {
  Button,
  ErrorState,
  LoadingState,
  PageLayout,
  PageSection,
} from '../shared/ux'
import { showAppNotification } from '../shared/notifications'
import { GroupForm } from './GroupForm'
import {
  toCreateGroupWithInitialSeriesPayload,
  useGroupForm,
  type GroupFormValues,
} from './groupFormMapping'
import { formatScheduleProblemCode } from '../schedule/scheduleActionReasons'

export type GroupCreateScreenProps = {
  onCancel: () => void
  onCreated: () => void
}

export function GroupCreateScreen({
  onCancel,
  onCreated,
}: GroupCreateScreenProps) {
  const [trainerOptions, setTrainerOptions] = useState<TrainerOption[]>([])
  const [branchOptions, setBranchOptions] = useState<Branch[]>([])
  const [hallOptions, setHallOptions] = useState<Hall[]>([])
  const [groupTypeOptions, setGroupTypeOptions] = useState<GroupType[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [preview, setPreview] = useState<GroupPreviewResponse | null>(null)
  const previewPayloadKeyRef = useRef<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const form = useGroupForm()
  const formRef = useRef(form)
  formRef.current = form

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoadingOptions(true)
      setLoadError(null)

      try {
        const [branches, halls, groupTypes, options] = await Promise.all([
          getBranches({ includeArchived: true }, controller.signal),
          getHalls({ includeArchived: true }, controller.signal),
          getGroupTypes(controller.signal),
          getTrainerOptions(controller.signal),
        ])
        setBranchOptions(branches)
        setHallOptions(halls)
        setGroupTypeOptions(groupTypes)
        setTrainerOptions(options)
        const firstActiveBranch = branches.find((branch) => !branch.isArchived)
        if (firstActiveBranch && !formRef.current.values.branchId) {
          formRef.current.setFieldValue('branchId', firstActiveBranch.id)
          const firstActiveHall = halls.find(
            (hall) => !hall.isArchived && hall.branchId === firstActiveBranch.id,
          )
          if (firstActiveHall && !formRef.current.values.hallId) {
            formRef.current.setFieldValue('hallId', firstActiveHall.id)
          }
        }
        if (groupTypes[0] && !formRef.current.values.groupTypeId) {
          formRef.current.setFieldValue('groupTypeId', groupTypes[0].id)
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить список тренеров.',
        )
      } finally {
        if (!controller.signal.aborted) {
          setLoadingOptions(false)
        }
      }
    }

    void load()

    return () => controller.abort()
  }, [])

  async function submit(values: GroupFormValues) {
    setSubmitting(true)
    setFormError(null)
    form.clearErrors()

    try {
      const previewPayload = toCreateGroupWithInitialSeriesPayload(values)
      const previewPayloadKey = JSON.stringify(previewPayload)

      if (!preview || previewPayloadKeyRef.current !== previewPayloadKey) {
        const response = await previewGroupCreate(previewPayload)
        previewPayloadKeyRef.current = previewPayloadKey
        setPreview(response)
        return
      }

      const createdGroup = await createGroup(
        toCreateGroupWithInitialSeriesPayload(values, preview.confirmationToken),
      )

      showAppNotification({
        id: 'group-create-success',
        title: 'Группа создана',
        message: `Группа «${createdGroup.name}» уже доступна в списке.`,
        color: 'teal',
      })

      onCreated()
    } catch (error) {
      if (error instanceof ApiError) {
        form.setErrors(applyFieldErrors(error.fieldErrors, GROUP_CREATE_FIELD_ALIASES))
        const message = formatScheduleProblemCode(error.code) ??
          'Не удалось проверить создание группы. Проверьте поля и попробуйте снова.'
        setPreview(null)
        previewPayloadKeyRef.current = null
        setFormError(message)
        return
      }

      setFormError('Не удалось создать группу. Попробуйте еще раз.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageLayout
        actions={(
          <Button
            leftSection={<IconArrowLeft size={18} />}
            onClick={onCancel}
            variant="default"
          >
            К списку групп
          </Button>
        )}
      title="Новая группа"
    >

      <PageSection>
        <Stack gap="lg">
          {loadingOptions ? (
            <LoadingState label="Подготавливаем форму группы..." />
          ) : null}

          {!loadingOptions && loadError ? (
            <ErrorState
              message={loadError}
              title="Не удалось подготовить форму"
            />
          ) : null}

          {!loadingOptions && !loadError ? (
            <>
              <GroupForm
                form={form}
                formError={formError}
                branchOptions={branchOptions}
                groupTypeOptions={groupTypeOptions}
                hallOptions={hallOptions}
              cancelAction={{ label: 'Отменить', onClick: onCancel }}
              onSubmit={submit}
              showInitialSeriesFields
              submitLabel={preview ? 'Создать группу' : 'Получить предпросмотр'}
              submitting={submitting}
              trainerOptions={trainerOptions}
            />
              {preview ? (
                <Paper className="group-create-preview" radius="24px" withBorder>
                  <Stack gap="sm">
                    <Text fw={900}>Проверьте расписание перед созданием</Text>
                    <Text c="dimmed" size="sm">
                      Группа будет создана вместе с начальной серией занятий. Подтвердить можно до {formatExpiresAt(preview.expiresAt)}.
                    </Text>
                    {preview.warnings.length > 0 ? (
                      <Stack gap="xs">
                        {preview.warnings.map((warning, index) => (
                          <Alert
                            color="yellow"
                            icon={<IconAlertTriangle size={18} />}
                            key={`${warning.code}:${index}`}
                          >
                            {warning.message || 'Проверьте предупреждение перед подтверждением.'}
                          </Alert>
                        ))}
                      </Stack>
                    ) : null}
                    <Text c="dimmed" size="sm">
                      Нажмите «Создать группу», чтобы выполнить атомарное создание группы и расписания.
                    </Text>
                  </Stack>
                </Paper>
              ) : null}
            </>
          ) : null}
        </Stack>
      </PageSection>
    </PageLayout>
  )
}

const GROUP_CREATE_FIELD_ALIASES = {
  'initialLessonSeries.startsOn': 'initialSeriesStartsOn',
  'initialLessonSeries.endsOn': 'initialSeriesEndsOn',
  'initialLessonSeries.slots': 'weekdays',
  'initialLessonSeries.slots.0.isoWeekday': 'weekdays',
  'initialLessonSeries.slots.0.startTime': 'trainingStartTime',
  'initialLessonSeries.slots.0.durationMinutes': 'durationMinutes',
  'initialLessonSeries.slots.0.hallId': 'hallId',
} as const

function formatExpiresAt(value: string) {
  const expiresAt = new Date(value)
  if (Number.isNaN(expiresAt.getTime())) {
    return 'окончания срока предпросмотра'
  }

  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(expiresAt)
}
