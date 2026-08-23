import { useEffect, useRef, useState } from 'react'
import { Stack } from '@mantine/core'
import { IconArrowLeft } from '@tabler/icons-react'
import {
  ApiError,
  applyFieldErrors,
  createGroup,
  getBranches,
  getGroupTypes,
  getHalls,
  getTrainerOptions,
  type Branch,
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
  toUpsertGroupPayload,
  useGroupForm,
  type GroupFormValues,
} from './groupFormMapping'

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
      const createdGroup = await createGroup(toUpsertGroupPayload(values))

      showAppNotification({
        id: 'group-create-success',
        title: 'Группа создана',
        message: `Группа «${createdGroup.name}» уже доступна в списке.`,
        color: 'teal',
      })

      onCreated()
    } catch (error) {
      if (error instanceof ApiError) {
        form.setErrors(applyFieldErrors(error.fieldErrors))
        setFormError(error.message)
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
          <GroupForm
            form={form}
            formError={formError}
            branchOptions={branchOptions}
            groupTypeOptions={groupTypeOptions}
            hallOptions={hallOptions}
              cancelAction={{ label: 'Отменить', onClick: onCancel }}
              onSubmit={submit}
              submitLabel="Создать группу"
              submitting={submitting}
              trainerOptions={trainerOptions}
            />
          ) : null}
        </Stack>
      </PageSection>
    </PageLayout>
  )
}
