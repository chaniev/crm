
import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Group, Loader } from '@mantine/core'
import { IconAlertCircle, IconArrowLeft } from '@tabler/icons-react'
import {
  ApiError,
  applyFieldErrors,
  getBranches,
  getClient,
  getGroups,
  uploadClientPhoto,
  updateClient,
  type Branch,
  type ClientDetails,
  type TrainingGroupListItem,
} from '../../lib/api'
import { PageLayout, PageSection } from '../shared/ux'
import { showAppNotification } from '../shared/notifications'
import {
  clientFieldErrorAliases,
  toClientFormValues,
  toUpsertClientPayload,
  type ClientFormValues,
  useClientForm,
  validateClientForm,
} from './ClientManagement.form'
import { ClientForm } from './ClientForm'
import { ClientPhotoSection } from './ClientPhotoSection'

type ClientEditScreenProps = {
  clientId: string
  onBack: () => void
  onUpdated: (clientId: string) => void
}

export function ClientEditScreen({
  clientId,
  onBack,
  onUpdated,
}: ClientEditScreenProps) {
  const [client, setClient] = useState<ClientDetails | null>(null)
  const [groupOptions, setGroupOptions] = useState<TrainingGroupListItem[]>([])
  const [branchOptions, setBranchOptions] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [photoVersion, setPhotoVersion] = useState<number | null>(null)
  const form = useClientForm()
  const formRef = useRef(form)
  formRef.current = form

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setLoadError(null)

      try {
        const [nextClient, branches, groupsResponse] = await Promise.all([
          getClient(clientId, controller.signal),
          getBranches({ includeArchived: true }, controller.signal),
          getGroups({ take: 100 }, controller.signal),
        ])

        if (controller.signal.aborted) {
          return
        }

        setClient(nextClient)
        setBranchOptions(branches)
        setGroupOptions(groupsResponse.items)
        formRef.current.setValues(toClientFormValues(nextClient))
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить карточку клиента.',
        )
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => controller.abort()
  }, [clientId])

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
      await updateClient(clientId, toUpsertClientPayload(values))

      showAppNotification({
        id: `client-edit-success-${clientId}`,
        title: 'Изменения сохранены',
        message: 'Карточка клиента обновлена.',
        color: 'teal',
      })

      onUpdated(clientId)
    } catch (error) {
      if (error instanceof ApiError) {
        form.setErrors(applyFieldErrors(error.fieldErrors, clientFieldErrorAliases))
        setFormError(error.message)
        return
      }

      setFormError('Не удалось сохранить изменения клиента.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePhotoUpload(file: File) {
    const updatedClient = await uploadClientPhoto(clientId, file)
    const nextClient = updatedClient ?? (await getClient(clientId))

    setClient(nextClient)
    setPhotoVersion(Date.now())
  }

  return (
    <PageLayout
      actions={
        <Button
          leftSection={<IconArrowLeft size={18} />}
          onClick={onBack}
          variant="default"
        >
          К карточке клиента
        </Button>
      }
      title={client ? client.fullName : 'Карточка клиента'}
    >

      {loading ? (
        <PageSection>
          <Group justify="center" py="xl">
            <Loader color="var(--crm-action-primary)" />
          </Group>
        </PageSection>
      ) : null}

      {!loading && loadError ? (
        <PageSection>
          <Alert
            color="red"
            icon={<IconAlertCircle size={18} />}
            title="Карточка клиента не загрузилась"
            variant="light"
          >
            {loadError}
          </Alert>
        </PageSection>
      ) : null}

      {!loading && !loadError ? (
        <>
          <PageSection className="client-edit-card">
            <ClientForm
              form={form}
              formError={formError}
              branchOptions={branchOptions}
              groupOptions={groupOptions}
              lockBranch
              cancelAction={null}
              photoSection={
                client ? (
                  <ClientPhotoSection
                    canUpload
                    clientId={client.id}
                    clientName={client.fullName}
                    onUpload={handlePhotoUpload}
                    photo={client.photo}
                    previewVersion={photoVersion ?? client.photo?.uploadedAt ?? client.updatedAt}
                  />
                ) : null
              }
              onSubmit={submit}
              submitLabel="Сохранить изменения"
              submitting={submitting}
            />
          </PageSection>
        </>
      ) : null}
    </PageLayout>
  )
}
