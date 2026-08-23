import { useEffect, useRef, useState } from 'react'
import { Badge, Modal, Stack, Text } from '@mantine/core'
import { IconArrowLeft, IconUsers } from '@tabler/icons-react'
import {
  ApiError,
  applyFieldErrors,
  getBranches,
  getGroup,
  getGroupClients,
  getGroupTypes,
  getHalls,
  getTrainerOptions,
  updateGroup,
  type Branch,
  type GroupClient,
  type GroupType,
  type Hall,
  type TrainerOption,
} from '../../lib/api'
import type {
  ClientProfileOriginInput,
  ClientProfileReturnContext,
} from '../clients/clientProfileReturnState'
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  PageLayout,
  PageSection,
  ResponsiveButtonGroup,
  SectionHeader,
} from '../shared/ux'
import { showAppNotification } from '../shared/notifications'
import { GroupClientRow } from './GroupClientRow'
import { GroupForm } from './GroupForm'
import { GroupTrainerSubstitutionsSection } from './GroupTrainerSubstitutionsSection'
import { GROUPS_DEFAULT_NAME } from './groupManagement.constants'
import { escapeCssIdentifier } from './groupDom'
import {
  toFormValues,
  toUpsertGroupPayload,
  useGroupForm,
  type GroupFormValues,
} from './groupFormMapping'

export type GroupEditScreenProps = {
  groupId: string
  initialReturnContext?: ClientProfileReturnContext | null
  onBack: () => void
  onOpenClient?: (clientId: string, origin: ClientProfileOriginInput) => void
  onUpdated: () => void
}

export function GroupEditScreen({
  groupId,
  initialReturnContext = null,
  onBack,
  onOpenClient,
  onUpdated,
}: GroupEditScreenProps) {
  const [trainerOptions, setTrainerOptions] = useState<TrainerOption[]>([])
  const [branchOptions, setBranchOptions] = useState<Branch[]>([])
  const [hallOptions, setHallOptions] = useState<Hall[]>([])
  const [groupTypeOptions, setGroupTypeOptions] = useState<GroupType[]>([])
  const [groupClients, setGroupClients] = useState<GroupClient[]>([])
  const [groupName, setGroupName] = useState(GROUPS_DEFAULT_NAME)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [pendingClientId, setPendingClientId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const form = useGroupForm()
  const formRef = useRef(form)
  const loadedFormValuesRef = useRef<GroupFormValues | null>(null)
  const returnFocusAppliedRef = useRef(false)

  useEffect(() => {
    formRef.current = form
  }, [form])

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setLoadError(null)

      try {
        const [
          group,
          branches,
          halls,
          groupTypes,
          options,
          clientsResponse,
        ] = await Promise.all([
          getGroup(groupId, controller.signal),
          getBranches({ includeArchived: true }, controller.signal),
          getHalls({ includeArchived: true }, controller.signal),
          getGroupTypes(controller.signal),
          getTrainerOptions(controller.signal),
          getGroupClients(groupId, controller.signal),
        ])

        setBranchOptions(branches)
        setHallOptions(halls)
        setGroupTypeOptions(groupTypes)
        setTrainerOptions(options)
        setGroupClients(clientsResponse.clients)
        setGroupName(group.name)
        const nextValues = toFormValues(group)
        loadedFormValuesRef.current = nextValues
        formRef.current.setValues(nextValues)
        formRef.current.resetDirty(nextValues)
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить данные группы.',
        )
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => controller.abort()
  }, [groupId])

  useEffect(() => {
    const origin = initialReturnContext?.origin
    if (
      returnFocusAppliedRef.current ||
      loading ||
      loadError ||
      origin?.kind !== 'groupEdit' ||
      origin.route.groupId !== groupId
    ) {
      return
    }

    returnFocusAppliedRef.current = true
    const animationFrameId = window.requestAnimationFrame(() => {
      const exactAction = document.querySelector<HTMLElement>(
        `[data-group-client-profile-action-id="${escapeCssIdentifier(origin.anchorClientId)}"]`,
      )
      const fallbackAction = document.querySelector<HTMLElement>(
        '.group-client-profile-action, .group-clients-card [role="heading"], .page-layout__header button',
      )
      const focusTarget = exactAction ?? fallbackAction

      if (focusTarget && !focusTarget.matches('button, a, input, select, textarea, [tabindex]')) {
        focusTarget.tabIndex = -1
      }
      exactAction?.scrollIntoView({ block: 'center' })
      focusTarget?.focus({ preventScroll: true })
    })

    return () => window.cancelAnimationFrame(animationFrameId)
  }, [groupClients, groupId, initialReturnContext, loadError, loading])

  async function persistGroup(values: GroupFormValues) {
    setSubmitting(true)
    setFormError(null)
    form.clearErrors()

    try {
      const updatedGroup = await updateGroup(groupId, toUpsertGroupPayload(values))

      showAppNotification({
        id: `group-edit-success-${groupId}`,
        title: 'Группа обновлена',
        message: `Изменения группы «${updatedGroup.name}» сохранены.`,
        color: 'teal',
      })

      loadedFormValuesRef.current = values
      form.resetDirty(values)
      return true
    } catch (error) {
      if (error instanceof ApiError) {
        form.setErrors(applyFieldErrors(error.fieldErrors))
        setFormError(error.message)
        focusGroupFormRecovery()
        return false
      }

      setFormError('Не удалось сохранить изменения группы.')
      focusGroupFormRecovery()
      return false
    } finally {
      setSubmitting(false)
    }
  }

  async function submit(values: GroupFormValues) {
    const saved = await persistGroup(values)
    if (saved) {
      onUpdated()
    }
  }

  function openClientFromGroup(clientId: string) {
    if (!onOpenClient) {
      return
    }

    const origin: ClientProfileOriginInput = {
      kind: 'groupEdit',
      route: { kind: 'groupEdit', groupId },
      anchorClientId: clientId,
    }

    onOpenClient(clientId, origin)
  }

  function handleOpenClient(clientId: string) {
    if (!onOpenClient) {
      return
    }

    if (!form.isDirty()) {
      openClientFromGroup(clientId)
      return
    }

    setPendingClientId(clientId)
  }

  function cancelPendingClientNavigation() {
    const clientId = pendingClientId
    setPendingClientId(null)
    if (!clientId) return

    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(
          `[data-group-client-profile-action-id="${escapeCssIdentifier(clientId)}"]`,
        )
        ?.focus({ preventScroll: true })
    })
  }

  async function saveAndOpenPendingClient() {
    const clientId = pendingClientId
    if (!clientId || submitting) return

    const validation = form.validate()
    if (validation.hasErrors) {
      setPendingClientId(null)
      setFormError('Проверьте обязательные поля группы.')
      focusGroupFormRecovery()
      return
    }

    const saved = await persistGroup(form.values)
    if (saved) {
      setPendingClientId(null)
      openClientFromGroup(clientId)
    } else {
      setPendingClientId(null)
    }
  }

  function discardAndOpenPendingClient() {
    const clientId = pendingClientId
    if (!clientId || submitting) return

    const loadedValues = loadedFormValuesRef.current
    if (loadedValues) {
      form.setValues(loadedValues)
      form.resetDirty(loadedValues)
      form.clearErrors()
      setFormError(null)
    }

    setPendingClientId(null)
    openClientFromGroup(clientId)
  }

  function focusGroupFormRecovery() {
    window.requestAnimationFrame(() => {
      const invalidField = document.querySelector<HTMLElement>('[aria-invalid="true"]')
      const formAlert = document.querySelector<HTMLElement>('.group-edit-form-recovery')
      ;(invalidField ?? formAlert)?.focus({ preventScroll: false })
    })
  }

  return (
    <PageLayout
      actions={(
        <Button
          leftSection={<IconArrowLeft size={18} />}
          onClick={onBack}
          variant="default"
        >
          К списку групп
        </Button>
      )}
      title={`Настройка группы «${groupName}»`}
    >

      {loading ? (
        <PageSection>
          <LoadingState label="Загружаем группу..." />
        </PageSection>
      ) : null}

      {!loading && loadError ? (
        <PageSection>
          <ErrorState
            message={loadError}
            title="Экран редактирования не загрузился"
          />
        </PageSection>
      ) : null}

      {!loading && !loadError ? (
        <>
          <Modal
            centered
            classNames={{
              body: 'group-client-navigation-modal__body',
              content: 'group-client-navigation-modal__content',
              header: 'group-client-navigation-modal__header',
            }}
            closeButtonProps={{
              'aria-label': 'Отменить переход к карточке клиента',
              disabled: submitting,
            }}
            closeOnClickOutside={!submitting}
            closeOnEscape={!submitting}
            onClose={cancelPendingClientNavigation}
            opened={Boolean(pendingClientId)}
            overlayProps={{ backgroundOpacity: 0.18, blur: 2 }}
            returnFocus={false}
            size="min(34rem, calc(100vw - 32px))"
            title="Сохранить изменения в группе?"
            trapFocus
            transitionProps={{ duration: 0 }}
            withCloseButton
          >
            <Stack gap="lg">
              <Text size="sm">
                Перед открытием карточки выберите, что сделать с текущими изменениями группы.
              </Text>
              <div className="group-client-navigation-modal__actions">
                <ResponsiveButtonGroup>
                  <Button
                    loading={submitting}
                    onClick={() => void saveAndOpenPendingClient()}
                    type="button"
                  >
                    Сохранить
                  </Button>
                  <Button
                    disabled={submitting}
                    onClick={discardAndOpenPendingClient}
                    type="button"
                    variant="secondary"
                  >
                    Не сохранять
                  </Button>
                  <Button
                    disabled={submitting}
                    onClick={cancelPendingClientNavigation}
                    type="button"
                    variant="subtle"
                  >
                    Отмена
                  </Button>
                </ResponsiveButtonGroup>
              </div>
            </Stack>
          </Modal>

          <PageSection>
            <GroupForm
              form={form}
              formError={formError}
              branchOptions={branchOptions}
              groupTypeOptions={groupTypeOptions}
              hallOptions={hallOptions}
              cancelAction={null}
              onSubmit={submit}
              submitLabel="Сохранить изменения"
              submitting={submitting}
              trainerOptions={trainerOptions}
            />
          </PageSection>

          <PageSection>
            <GroupTrainerSubstitutionsSection
              groupId={groupId}
              trainerOptions={trainerOptions}
            />
          </PageSection>

          <PageSection className="group-clients-card">
            <Stack gap="lg">
              <SectionHeader
                actions={(
                  <Badge color="var(--crm-brand-primary-soft)" radius="xl" variant="light">
                    Всего: {groupClients.length}
                  </Badge>
                )}
                title="Клиенты группы"
              />

              {groupClients.length === 0 ? (
                <EmptyState
                  description="После этапов клиентской базы здесь будет виден фактический состав группы."
                  icon={<IconUsers size={24} />}
                  title="В группе пока нет клиентов"
                />
              ) : (
                <Stack gap="sm">
                  {groupClients.map((client) => (
                    <GroupClientRow
                      client={client}
                      key={client.id}
                      onOpenClient={handleOpenClient}
                    />
                  ))}
                </Stack>
              )}
            </Stack>
          </PageSection>
        </>
      ) : null}
    </PageLayout>
  )
}
