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
import { fe13GroupsCoreText } from '../../resources/fe-13-groups-core'


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
            : fe13GroupsCoreText.groupCreateScreen_string_c9bed940,
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
        title: fe13GroupsCoreText.groupCreateScreen_title_1f78cfd7,
        message: fe13GroupsCoreText.groupCreateScreen_message_613f7cb9(createdGroup.name),
        color: 'teal',
      })

      onCreated()
    } catch (error) {
      if (error instanceof ApiError) {
        form.setErrors(applyFieldErrors(error.fieldErrors, GROUP_CREATE_FIELD_ALIASES))
        const message = formatScheduleProblemCode(error.code) ??
          fe13GroupsCoreText.groupCreateScreen_string_c6241417
        setPreview(null)
        previewPayloadKeyRef.current = null
        setFormError(message)
        return
      }

      setFormError(fe13GroupsCoreText.groupCreateScreen_setFormError_ee875cc4)
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
            {fe13GroupsCoreText.groupCreateScreen_jsxText_322693c9}</Button>
        )}
      title={fe13GroupsCoreText.groupCreateScreen_title_c9fd9fc0}
    >

      <PageSection>
        <Stack gap="lg">
          {loadingOptions ? (
            <LoadingState label={fe13GroupsCoreText.groupCreateScreen_label_d8c36ed2} />
          ) : null}

          {!loadingOptions && loadError ? (
            <ErrorState
              message={loadError}
              title={fe13GroupsCoreText.groupCreateScreen_title_bb243bf5}
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
              cancelAction={{ label: fe13GroupsCoreText.groupCreateScreen_label_7c47f729, onClick: onCancel }}
              onSubmit={submit}
              showInitialSeriesFields
              submitLabel={preview ? fe13GroupsCoreText.groupCreateScreen_string_663c5248 : fe13GroupsCoreText.groupCreateScreen_string_857a90c1}
              submitting={submitting}
              trainerOptions={trainerOptions}
            />
              {preview ? (
                <Paper className="group-create-preview" radius="24px" withBorder>
                  <Stack gap="sm">
                    <Text fw={900}>{fe13GroupsCoreText.groupCreateScreen_jsxText_23985cf1}</Text>
                    <Text c="dimmed" size="sm">
                      {fe13GroupsCoreText.groupCreateScreen_jsxText_d5ff0d22}{formatExpiresAt(preview.expiresAt)}{fe13GroupsCoreText.groupCreateScreen_jsxText_cdb4ee2a}</Text>
                    {preview.warnings.length > 0 ? (
                      <Stack gap="xs">
                        {preview.warnings.map((warning, index) => (
                          <Alert
                            color="yellow"
                            icon={<IconAlertTriangle size={18} />}
                            key={`${warning.code}:${index}`}
                          >
                            {warning.message || fe13GroupsCoreText.groupCreateScreen_string_52af7b72}
                          </Alert>
                        ))}
                      </Stack>
                    ) : null}
                    <Text c="dimmed" size="sm">
                      {fe13GroupsCoreText.groupCreateScreen_jsxText_1faaa276}</Text>
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
    return fe13GroupsCoreText.groupCreateScreen_string_4371fe93
  }

  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(expiresAt)
}
