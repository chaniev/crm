
import { useEffect, useRef, useState } from 'react'
import { Alert, Button } from '@mantine/core'
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
import { LoadingState, PageLayout, PageSection } from '../shared/ux'
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
import { fe6ClientProfileText } from '../../resources/fe-6-client-profile'


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
            : fe6ClientProfileText.clientEditScreen_string_63fa9b9e,
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
      setFormError(fe6ClientProfileText.clientEditScreen_setFormError_97732402)
      return
    }

    setSubmitting(true)

    try {
      await updateClient(clientId, toUpsertClientPayload(values))

      showAppNotification({
        id: `client-edit-success-${clientId}`,
        title: fe6ClientProfileText.clientEditScreen_title_f436b337,
        message: fe6ClientProfileText.clientEditScreen_message_154f1c05,
        color: 'teal',
      })

      onUpdated(clientId)
    } catch (error) {
      if (error instanceof ApiError) {
        form.setErrors(applyFieldErrors(error.fieldErrors, clientFieldErrorAliases))
        setFormError(error.message)
        return
      }

      setFormError(fe6ClientProfileText.clientEditScreen_setFormError_e238fab9)
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
          {fe6ClientProfileText.clientEditScreen_jsxText_14a4b327}</Button>
      }
      title={client ? client.fullName : fe6ClientProfileText.clientEditScreen_string_a912ec86}
    >

      {loading ? (
        <PageSection>
          <LoadingState
            description={fe6ClientProfileText.clientEditScreen_description_9c63e471}
            label={fe6ClientProfileText.clientEditScreen_label_a2151f05}
          />
        </PageSection>
      ) : null}

      {!loading && loadError ? (
        <PageSection>
          <Alert
            color="red"
            icon={<IconAlertCircle size={18} />}
            title={fe6ClientProfileText.clientEditScreen_title_6c247ce7}
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
              submitLabel={fe6ClientProfileText.clientEditScreen_submitLabel_744cf2b2}
              submitting={submitting}
            />
          </PageSection>
        </>
      ) : null}
    </PageLayout>
  )
}
