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
  type TrainingGroupDetails,
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
import { GroupScheduleEntry } from './GroupScheduleEntry'
import { useGroupScheduleEntry } from './useGroupScheduleEntry'
import type { GroupScheduleReturnContext } from './groupScheduleReturnState'
import { GroupTrainerAssignmentsSection } from './GroupTrainerAssignmentsSection'
import { GroupTrainerSubstitutionsSection } from './GroupTrainerSubstitutionsSection'
import { GROUPS_DEFAULT_NAME } from './groupManagement.constants'
import { escapeCssIdentifier } from './groupDom'
import {
  toFormValues,
  toUpdateGroupIdentityPayload,
  useGroupForm,
  type GroupFormValues,
} from './groupFormMapping'
import { fe13GroupsCoreText } from '../../resources/fe-13-groups-core'


export type GroupEditScreenProps = {
  groupId: string
  canManageGroups?: boolean
  scheduleReturnContext?: GroupScheduleReturnContext | null
  onOpenSchedule?: (groupId: string, seriesId: string) => void
  initialReturnContext?: ClientProfileReturnContext | null
  onBack: () => void
  onOpenClient?: (clientId: string, origin: ClientProfileOriginInput) => void
  onUpdated: () => void
}

export function GroupEditScreen({
  groupId,
  canManageGroups = false,
  scheduleReturnContext = null,
  onOpenSchedule,
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
  const [groupDetails, setGroupDetails] = useState<TrainingGroupDetails | null>(null)
  const [groupName, setGroupName] = useState<string>(GROUPS_DEFAULT_NAME)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [pendingDestination, setPendingDestination] = useState<{ kind: 'client'; clientId: string } | { kind: 'schedule' } | null>(null)
  const schedule = useGroupScheduleEntry(groupId, canManageGroups && Boolean(onOpenSchedule))
  const savingRef = useRef(false)
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

        if (controller.signal.aborted) return
        setBranchOptions(branches)
        setHallOptions(halls)
        setGroupTypeOptions(groupTypes)
        setTrainerOptions(options)
        setGroupClients(clientsResponse.clients)
        setGroupDetails(group)
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
            : fe13GroupsCoreText.groupEditScreen_string_6685ec5f,
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
    if (savingRef.current) return false
    savingRef.current = true
    setSubmitting(true)
    setFormError(null)
    form.clearErrors()

    try {
      const updatedGroup = await updateGroup(
        groupId,
        toUpdateGroupIdentityPayload(values),
      )

      showAppNotification({
        id: `group-edit-success-${groupId}`,
        title: fe13GroupsCoreText.groupEditScreen_title_3440e0c0,
        message: fe13GroupsCoreText.groupEditScreen_message_cd1b9038(updatedGroup.name),
        color: 'teal',
      })

      const nextValues = toFormValues(updatedGroup)
      setGroupDetails(updatedGroup)
      setGroupName(updatedGroup.name)
      loadedFormValuesRef.current = nextValues
      form.setValues(nextValues)
      form.resetDirty(nextValues)
      return true
    } catch (error) {
      if (error instanceof ApiError) {
        form.setErrors(applyFieldErrors(error.fieldErrors))
        setFormError(error.message)
        focusGroupFormRecovery()
        return false
      }

      setFormError(fe13GroupsCoreText.groupEditScreen_setFormError_4200416e)
      focusGroupFormRecovery()
      return false
    } finally {
      savingRef.current = false
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

    setPendingDestination({ kind: 'client', clientId })
  }

  function handleOpenSchedule() {
    if (!canManageGroups || !onOpenSchedule || schedule.state.kind !== 'ready') return
    if (form.isDirty()) setPendingDestination({ kind: 'schedule' })
    else onOpenSchedule(groupId, schedule.state.series.seriesId)
  }

  function cancelPendingNavigation() {
    const destination = pendingDestination
    setPendingDestination(null)
    if (!destination) return
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(destination.kind === 'schedule'
        ? '[data-group-schedule-action]'
        : `[data-group-client-profile-action-id="${escapeCssIdentifier(destination.clientId)}"]`)
        ?.focus({ preventScroll: true })
    })
  }

  async function openPendingDestination(destination: NonNullable<typeof pendingDestination>, refreshSchedule: boolean) {
    if (destination.kind === 'client') {
      openClientFromGroup(destination.clientId)
    } else if (canManageGroups && onOpenSchedule) {
      const series = refreshSchedule ? await schedule.refresh()
        : schedule.state.kind === 'ready' ? schedule.state.series : null
      if (series?.groupId === groupId) onOpenSchedule(groupId, series.seriesId)
    }
  }

  async function saveAndOpenPendingDestination() {
    const destination = pendingDestination
    if (!destination || submitting || savingRef.current) return
    const validation = form.validate()
    if (validation.hasErrors) {
      setPendingDestination(null)
      setFormError(fe13GroupsCoreText.groupEditScreen_setFormError_e9c0fdee)
      focusGroupFormRecovery()
      return
    }
    const saved = await persistGroup(form.values)
    setPendingDestination(null)
    if (saved) await openPendingDestination(destination, true)
  }

  function discardAndOpenPendingDestination() {
    const destination = pendingDestination
    if (!destination || submitting || savingRef.current) return
    const loadedValues = loadedFormValuesRef.current
    if (loadedValues) {
      form.setValues(loadedValues)
      form.resetDirty(loadedValues)
      form.clearErrors()
      setFormError(null)
    }
    setPendingDestination(null)
    void openPendingDestination(destination, false)
  }

  useEffect(() => {
    if (loading || loadError || schedule.state.kind !== 'ready' ||
      scheduleReturnContext?.entry !== 'group' || scheduleReturnContext.groupId !== groupId) return
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: scheduleReturnContext.scrollY })
      document.querySelector<HTMLElement>('[data-group-schedule-action]')?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [groupId, loading, loadError, schedule.state.kind, scheduleReturnContext])

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
          {fe13GroupsCoreText.groupEditScreen_jsxText_322693c9}</Button>
      )}
      title={fe13GroupsCoreText.groupEditScreen_template_3afee36c(groupName)}
    >

      {loading ? (
        <PageSection>
          <LoadingState label={fe13GroupsCoreText.groupEditScreen_label_03b534a0} />
        </PageSection>
      ) : null}

      {!loading && loadError ? (
        <PageSection>
          <ErrorState
            message={loadError}
            title={fe13GroupsCoreText.groupEditScreen_title_9728304a}
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
              'aria-label': pendingDestination?.kind === 'schedule' ? fe13GroupsCoreText.scheduleCancelNavigation : fe13GroupsCoreText.groupEditScreen_ariaLabel_08e8f4e9,
              disabled: submitting,
            }}
            closeOnClickOutside={!submitting}
            closeOnEscape={!submitting}
            onClose={cancelPendingNavigation}
            opened={Boolean(pendingDestination)}
            overlayProps={{ backgroundOpacity: 0.18, blur: 2 }}
            returnFocus={false}
            size="min(34rem, calc(100vw - 32px))"
            title={fe13GroupsCoreText.groupEditScreen_title_2122d00c}
            trapFocus
            transitionProps={{ duration: 0 }}
            withCloseButton
          >
            <Stack gap="lg">
              <Text size="sm">
                {pendingDestination?.kind === 'schedule' ? fe13GroupsCoreText.scheduleDirtyDescription : fe13GroupsCoreText.groupEditScreen_jsxText_e4748b11}</Text>
              <div className="group-client-navigation-modal__actions">
                <ResponsiveButtonGroup>
                  <Button
                    loading={submitting}
                    onClick={() => void saveAndOpenPendingDestination()}
                    type="button"
                  >
                    {pendingDestination?.kind === 'schedule' ? fe13GroupsCoreText.scheduleSaveAndOpen : fe13GroupsCoreText.groupEditScreen_jsxText_b4d30cae}</Button>
                  <Button
                    disabled={submitting}
                    onClick={discardAndOpenPendingDestination}
                    type="button"
                    variant="secondary"
                  >
                    {pendingDestination?.kind === 'schedule' ? fe13GroupsCoreText.scheduleDiscardAndOpen : fe13GroupsCoreText.groupEditScreen_jsxText_735b1ef6}</Button>
                  <Button
                    disabled={submitting}
                    onClick={cancelPendingNavigation}
                    type="button"
                    variant="subtle"
                  >
                    {pendingDestination?.kind === 'schedule' ? fe13GroupsCoreText.scheduleStay : fe13GroupsCoreText.groupEditScreen_jsxText_8fbe9b75}</Button>
                </ResponsiveButtonGroup>
              </div>
            </Stack>
          </Modal>

          <PageSection>
            <Stack gap="lg">
              {canManageGroups && onOpenSchedule ? (
                <GroupScheduleEntry state={schedule.state} pending={submitting}
                  onOpen={handleOpenSchedule} onRetry={() => void schedule.refresh()} />
              ) : null}
            <GroupForm
              form={form}
              formError={formError}
              branchOptions={branchOptions}
              groupTypeOptions={groupTypeOptions}
              hallOptions={hallOptions}
              cancelAction={null}
              onSubmit={submit}
              showHallField={false}
              showScheduleFields={false}
              showTrainerField={false}
              submitLabel={fe13GroupsCoreText.groupEditScreen_submitLabel_744cf2b2}
              submitting={submitting}
              trainerOptions={trainerOptions}
            />
            </Stack>
          </PageSection>

          {groupDetails ? (
            <PageSection>
              <GroupTrainerAssignmentsSection
                groupId={groupId}
                initialPeriods={groupDetails.trainerAssignmentPeriods}
                initialRevision={groupDetails.trainerAssignmentRevision}
                trainerOptions={trainerOptions}
              />
            </PageSection>
          ) : null}

          <PageSection>
            <GroupTrainerSubstitutionsSection
              groupId={groupId}
            />
          </PageSection>

          <PageSection className="group-clients-card">
            <Stack gap="lg">
              <SectionHeader
                actions={(
                  <Badge color="var(--crm-brand-primary-soft)" radius="xl" variant="light">
                    {fe13GroupsCoreText.groupEditScreen_jsxText_f8ba76ae}{groupClients.length}
                  </Badge>
                )}
                title={fe13GroupsCoreText.groupEditScreen_title_c9c7719c}
              />

              {groupClients.length === 0 ? (
                <EmptyState
                  description={fe13GroupsCoreText.groupEditScreen_description_a64fe90a}
                  icon={<IconUsers size={24} />}
                  title={fe13GroupsCoreText.groupEditScreen_title_48aff34a}
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
