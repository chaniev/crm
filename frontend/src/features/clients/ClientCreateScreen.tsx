
import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Group, Loader, Stack } from '@mantine/core'
import { IconAlertCircle, IconArrowLeft } from '@tabler/icons-react'
import {
  ApiError,
  applyFieldErrors,
  createClient,
  getBranches,
  getGroups,
  type Branch,
  type TrainingGroupListItem,
} from '../../lib/api'
import { PageLayout, PageSection } from '../shared/ux'
import { showAppNotification } from '../shared/notifications'
import {
  buildDraftClientName,
  clientFieldErrorAliases,
  toUpsertClientPayload,
  type ClientFormValues,
  useClientForm,
  validateClientForm,
} from './ClientManagement.form'
import { ClientForm } from './ClientForm'
import { ClientPhotoSection } from './ClientPhotoSection'

type ClientCreateScreenProps = {
  onCancel: () => void
  onCreated: (clientId?: string) => void
}

export function ClientCreateScreen({
  onCancel,
  onCreated,
}: ClientCreateScreenProps) {
  const [groupOptions, setGroupOptions] = useState<TrainingGroupListItem[]>([])
  const [branchOptions, setBranchOptions] = useState<Branch[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const form = useClientForm()
  const formRef = useRef(form)
  formRef.current = form

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoadingOptions(true)
      setLoadError(null)

      try {
        const [branches, groupsResponse] = await Promise.all([
          getBranches({ includeArchived: true }, controller.signal),
          getGroups({ take: 100 }, controller.signal),
        ])
        setBranchOptions(branches)
        setGroupOptions(groupsResponse.items)
        const firstActiveBranch = branches.find((branch) => !branch.isArchived)
        if (!formRef.current.values.branchId && firstActiveBranch) {
          formRef.current.setFieldValue('branchId', firstActiveBranch.id)
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить список групп.',
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

  async function submit(values: ClientFormValues) {
    setFormError(null)
    form.clearErrors()

    const validationErrors = validateClientForm(values)
    if (Object.keys(validationErrors).length > 0) {
      form.setErrors(validationErrors)
      setFormError('Проверьте обязательные поля клиента и контактов.')
      return
    }

    setSubmitting(true)

    try {
      const createdClient = await createClient(toUpsertClientPayload(values))

      showAppNotification({
        id: 'client-create-success',
        title: 'Клиент создан',
        message: 'Базовая карточка клиента сохранена.',
        color: 'teal',
      })

      onCreated(createdClient?.id)
    } catch (error) {
      if (error instanceof ApiError) {
        form.setErrors(applyFieldErrors(error.fieldErrors, clientFieldErrorAliases))
        setFormError(error.message)
        return
      }

      setFormError('Не удалось создать клиента. Попробуйте еще раз.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageLayout
      actions={
        <Button
          leftSection={<IconArrowLeft size={18} />}
          onClick={onCancel}
          variant="default"
        >
          К списку клиентов
        </Button>
      }
      title="Новый клиент"
    >
      <PageSection>
        <Stack gap="lg">
          {loadingOptions ? (
            <Group justify="center" py="xl">
              <Loader color="var(--crm-action-primary)" />
            </Group>
          ) : null}

          {!loadingOptions && loadError ? (
            <Alert
              color="red"
              icon={<IconAlertCircle size={18} />}
              title="Не удалось подготовить форму"
              variant="light"
            >
              {loadError}
            </Alert>
          ) : null}

          {!loadingOptions && !loadError ? (
            <ClientForm
              form={form}
              formError={formError}
              branchOptions={branchOptions}
              groupOptions={groupOptions}
              lockBranch={false}
              cancelAction={{ label: 'Отменить', onClick: onCancel }}
              photoSection={
                <ClientPhotoSection
                  canUpload={false}
                  clientName={buildDraftClientName(form.values)}
                  photo={null}
                />
              }
              onSubmit={submit}
              submitLabel="Сохранить клиента"
              submitting={submitting}
            />
          ) : null}
        </Stack>
      </PageSection>
    </PageLayout>
  )
}
