import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Modal, Stack, Text } from '@mantine/core'
import { IconArrowLeft } from '@tabler/icons-react'
import {
  ApiError, applyFieldErrors, createGroup, getGroupCreateOptions, getGroupTypes,
  getTrainerOptions, previewGroupCreate, type GroupCreateOptions, type GroupType,
  type TrainerOption,
} from '../../lib/api'
import { Button, ResponsiveButtonGroup, ErrorState, LoadingState, PageLayout, PageSection } from '../shared/ux'
import { showAppNotification } from '../shared/notifications'
import { GroupForm } from './GroupForm'
import { toCreateGroupWithInitialSeriesPayload, useGroupForm, type GroupFormValues } from './groupFormMapping'
import { formatScheduleProblemCode } from '../schedule/scheduleActionReasons'
import { fe13GroupsCoreText as text } from '../../resources/fe-13-groups-core'
import type { NavigationGuardRegistration } from '../settings/useClientImport'

export type GroupCreateScreenProps = {
  onCancel: () => void
  onCreated: () => void
  onNavigationGuardChange?: NavigationGuardRegistration
}

export function GroupCreateScreen({ onCancel, onCreated, onNavigationGuardChange }: GroupCreateScreenProps) {
  const [options, setOptions] = useState<GroupCreateOptions>({ branches: [], halls: [] })
  const [trainerOptions, setTrainerOptions] = useState<TrainerOption[]>([])
  const [groupTypeOptions, setGroupTypeOptions] = useState<GroupType[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [unknown, setUnknown] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const submittingRef = useRef(false)
  const active = useRef(true)
  const recoveryRequested = useRef(false)
  const leaveAction = useRef<(() => void) | null>(null)
  const form = useGroupForm({ mode: 'create' })
  const formRef = useRef(form)
  formRef.current = form
  const guardState = useRef({ dirty: false, uncertain: false })
  guardState.current = { dirty: form.isDirty(), uncertain: submitting || unknown }

  const requestLeave = useCallback((action: () => void) => {
    if (guardState.current.dirty || guardState.current.uncertain) {
      leaveAction.current = action
      setLeaveOpen(true)
    } else action()
  }, [])

  useEffect(() => {
    active.current = true
    onNavigationGuardChange?.(requestLeave)
    return () => { active.current = false; onNavigationGuardChange?.(null) }
  }, [onNavigationGuardChange, requestLeave])

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setLoadingOptions(true)
      setLoadError(null)
      try {
        const [available, types, trainers] = await Promise.all([
          getGroupCreateOptions(controller.signal), getGroupTypes(controller.signal), getTrainerOptions(controller.signal),
        ])
        if (controller.signal.aborted) return
        setOptions(available)
        setGroupTypeOptions(types)
        setTrainerOptions(trainers)
        const current = formRef.current
        // Only the untouched initial form receives defaults; responses never replace a draft.
        if (!current.isDirty()) {
          const branchId = available.branches[0]?.id ?? ''
          const initial = { ...current.values, branchId,
            hallId: available.halls.find(hall => hall.branchId === branchId)?.id ?? '',
            groupTypeId: types[0]?.id ?? '' }
          current.setValues(initial)
          current.resetDirty(initial)
        }
      } catch (error) {
        if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : text.groupCreateScreen_string_c9bed940)
      } finally {
        if (!controller.signal.aborted) setLoadingOptions(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [loadAttempt])

  useEffect(() => {
    if (submitting || !recoveryRequested.current) return
    recoveryRequested.current = false
    const invalid = document.querySelector<HTMLElement>('form [aria-invalid="true"]')
    const target = invalid?.matches('input,select,textarea,button') ? invalid
      : invalid?.querySelector<HTMLElement>('input,select,textarea,button')
        ?? document.querySelector<HTMLElement>('.group-edit-form-recovery, .group-create-unknown')
    target?.focus()
    target?.scrollIntoView?.({ block: 'center' })
  }, [submitting, formError, form.errors, unknown])

  const hasOptions = options.branches.length > 0 && options.halls.some(hall => hall.branchId === form.values.branchId) && groupTypeOptions.length > 0

  async function submit(values: GroupFormValues) {
    if (submittingRef.current || unknown || !hasOptions || loadingOptions || loadError) return
    submittingRef.current = true
    setSubmitting(true)
    setFormError(null)
    form.clearErrors()
    const payload = toCreateGroupWithInitialSeriesPayload(values)
    let createSent = false
    try {
      const preview = await previewGroupCreate(payload)
      if (!active.current) return
      createSent = true
      const created = await createGroup({ ...payload, confirmationToken: preview.confirmationToken })
      if (!active.current) return
      form.resetDirty()
      guardState.current = { dirty: false, uncertain: false }
      leaveAction.current = null
      setLeaveOpen(false)
      showAppNotification({ id: 'group-create-success', title: text.groupCreateScreen_title_1f78cfd7,
        message: text.groupCreateScreen_message_613f7cb9(created.name), color: 'teal' })
      onCreated()
    } catch (error) {
      if (!active.current) return
      const knownRejection = error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 408
      if (createSent && !knownRejection) {
        setUnknown(true)
      } else if (error instanceof ApiError) {
        const errors = applyFieldErrors(error.fieldErrors, createFieldAliases(values))
        const visibleFields = new Set(['name', 'branchId', 'hallId', 'groupTypeId', 'durationMinutes', 'weekdays',
          'initialSeriesStartsOn', 'initialSeriesEndsOn', 'trainerIds', 'isActive', ...values.weekdays.map(day => `weekdayStartTimes.${day}`)])
        form.setErrors(Object.fromEntries(Object.entries(errors).filter(([field]) => visibleFields.has(field))))
        const unbound = Object.entries(errors).filter(([field]) => !visibleFields.has(field)).map(([, message]) => message)
        setFormError([formatScheduleProblemCode(error.code) ?? error.message, ...unbound].join(' '))
      } else setFormError(text.groupCreateScreen_setFormError_ee875cc4)
      recoveryRequested.current = true
    } finally {
      submittingRef.current = false
      if (active.current) setSubmitting(false)
    }
  }

  return (
    <PageLayout title={text.groupCreateScreen_title_c9fd9fc0} actions={
      <Button leftSection={<IconArrowLeft size={18} />} onClick={(event) => { event.currentTarget.focus(); requestLeave(onCancel) }} variant="default">
        {text.groupCreateScreen_jsxText_322693c9}
      </Button>
    }>
      <PageSection><Stack gap="lg">
        {loadingOptions ? <LoadingState label={text.groupCreateScreen_label_d8c36ed2} /> : null}
        {!loadingOptions && loadError ? <ErrorState title={text.groupCreateScreen_title_bb243bf5} message={loadError}
          action={<Button onClick={() => setLoadAttempt(value => value + 1)}>{text.createRetry}</Button>} /> : null}
        {!loadingOptions && !loadError ? <>
          {!hasOptions ? <Alert>{text.createEmpty}</Alert> : null}
          {unknown ? <Alert className="group-create-unknown" tabIndex={-1} color="yellow" title={text.createUnknown}>
            <Stack gap="sm">{text.createUnknownDescription}
              <Button onClick={() => requestLeave(onCancel)}>{text.createCheckList}</Button>
            </Stack>
          </Alert> : null}
          <GroupForm form={form} formError={formError} branchOptions={options.branches} hallOptions={options.halls}
            groupTypeOptions={groupTypeOptions} trainerOptions={trainerOptions} showInitialSeriesFields
            cancelAction={{ label: text.groupCreateScreen_label_7c47f729, onClick: () => requestLeave(onCancel) }}
            onSubmit={submit} submitting={submitting} disabled={!hasOptions || unknown}
            submitLabel={submitting ? text.createPending : text.groupCreateScreen_string_663c5248} />
        </> : null}
      </Stack></PageSection>
      <Modal opened={leaveOpen} title={submitting ? text.createLeavePendingTitle : text.createLeaveTitle}
        zIndex={300} centered returnFocus closeOnClickOutside={false}
        onClose={() => { leaveAction.current = null; setLeaveOpen(false) }}>
        <Stack gap="lg">
          <Text>{submitting ? text.createLeavePending : unknown ? text.createLeaveUnknown : text.createLeaveDescription}</Text>
          <ResponsiveButtonGroup justify="flex-end">
            <Button data-autofocus variant="secondary" onClick={() => { leaveAction.current = null; setLeaveOpen(false) }}>
              {text.createStay}
            </Button>
            <Button variant="destructive" onClick={() => {
              const action = leaveAction.current
              leaveAction.current = null
              setLeaveOpen(false)
              if (action) { active.current = false; action() }
            }}>{text.createLeave}</Button>
          </ResponsiveButtonGroup>
        </Stack>
      </Modal>
    </PageLayout>
  )
}

function createFieldAliases(values: GroupFormValues): Record<string, string> {
  const days = [...values.weekdays].sort((a, b) => Number(a) - Number(b))
  return {
    'initialLessonSeries.startsOn': 'initialSeriesStartsOn',
    'initialLessonSeries.endsOn': 'initialSeriesEndsOn',
    'initialLessonSeries.slots': 'weekdays',
    ...(days[0] ? { trainingStartTime: `weekdayStartTimes.${days[0]}` } : {}),
    ...Object.fromEntries(days.flatMap((day, index) => [
      [`initialLessonSeries.slots.${index}.isoWeekday`, 'weekdays'],
      [`initialLessonSeries.slots.${index}.startTime`, `weekdayStartTimes.${day}`],
      [`initialLessonSeries.slots.${index}.durationMinutes`, 'durationMinutes'],
      [`initialLessonSeries.slots.${index}.hallId`, 'hallId'],
    ])),
  }
}
