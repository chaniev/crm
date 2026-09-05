
import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Stack } from '@mantine/core'
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
import { LoadingState, PageLayout, PageSection } from '../shared/ux'
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
import { fe6ClientProfileText } from '../../resources/fe-6-client-profile'


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
            : fe6ClientProfileText.clientCreateScreen_string_85b97c29,
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
      setFormError(fe6ClientProfileText.clientCreateScreen_setFormError_97732402)
      return
    }

    setSubmitting(true)

    try {
      const createdClient = await createClient(toUpsertClientPayload(values))

      showAppNotification({
        id: 'client-create-success',
        title: fe6ClientProfileText.clientCreateScreen_title_4f3100e0,
        message: fe6ClientProfileText.clientCreateScreen_message_67cfd459,
        color: 'teal',
      })

      onCreated(createdClient?.id)
    } catch (error) {
      if (error instanceof ApiError) {
        form.setErrors(applyFieldErrors(error.fieldErrors, clientFieldErrorAliases))
        setFormError(error.message)
        return
      }

      setFormError(fe6ClientProfileText.clientCreateScreen_setFormError_bdd79cff)
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
          {fe6ClientProfileText.clientCreateScreen_jsxText_fde25c93}</Button>
      }
      title={fe6ClientProfileText.clientCreateScreen_title_5a2595c2}
    >
      <PageSection>
        <Stack gap="lg">
          {loadingOptions ? (
            <LoadingState
              description={fe6ClientProfileText.clientCreateScreen_description_8c274e30}
              label={fe6ClientProfileText.clientCreateScreen_label_28f0dd24}
            />
          ) : null}

          {!loadingOptions && loadError ? (
            <Alert
              color="red"
              icon={<IconAlertCircle size={18} />}
              title={fe6ClientProfileText.clientCreateScreen_title_bb243bf5}
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
              cancelAction={{ label: fe6ClientProfileText.clientCreateScreen_label_7c47f729, onClick: onCancel }}
              photoSection={
                <ClientPhotoSection
                  canUpload={false}
                  clientName={buildDraftClientName(form.values)}
                  photo={null}
                />
              }
              onSubmit={submit}
              submitLabel={fe6ClientProfileText.clientCreateScreen_submitLabel_40ba6630}
              submitting={submitting}
            />
          ) : null}
        </Stack>
      </PageSection>
    </PageLayout>
  )
}
