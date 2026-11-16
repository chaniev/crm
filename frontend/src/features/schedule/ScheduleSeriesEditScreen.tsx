import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Group, NumberInput, Paper, SegmentedControl, Select, Stack, Text, TextInput } from '@mantine/core'
import { IconAlertTriangle, IconPlus } from '@tabler/icons-react'
import {
  ApiError,
  applyFieldErrors,
  applyGroupLessonSeries,
  getGroupLessonSeries,
  getScheduleLessons,
  previewGroupLessonSeries,
  type GroupLessonSeriesPreviewResponse,
  type GroupLessonSeriesReadResponse,
  type GroupLessonSeriesRequest,
  type GroupLessonSeriesScope,
} from '../../lib/api'
import { fe13GroupsCoreText } from '../../resources/fe-13-groups-core'
import { fe2ScheduleCoreText } from '../../resources/fe-2-schedule-core'
import { ErrorState, LoadingState, PageLayout, PageSection, StickyFormActions } from '../shared/ux'
import { formatScheduleProblemCode } from './scheduleActionReasons'
import { formatExpiresAt, formatShortDate, isRealIsoDate, trimSeconds } from './scheduleDateTime'
import { mapResponseFilterOptions, type FilterOption } from './scheduleFilterOptions'
import { WarningList } from './ScheduleWarnings'

export function ScheduleSeriesEditScreen({
  backLabel = fe2ScheduleCoreText.groupScheduleScreen_jsxText_9b431254,
  groupId,
  lessonDate,
  lessonSeriesId,
  lessonOccurrenceId,
  onBack,
  onSaved,
  scope,
}: {
  backLabel?: string
  groupId?: string | null
  lessonDate?: string | null
  lessonSeriesId: string
  lessonOccurrenceId?: string | null
  onBack: () => void
  onSaved: () => void
  scope: 'this-and-future' | 'entire'
}) {
  const [series, setSeries] = useState<GroupLessonSeriesReadResponse | null>(null)
  const [draft, setDraft] = useState<SeriesDraft | null>(null)
  const [hallOptions, setHallOptions] = useState<FilterOption[]>([])
  const [fieldErrors, setFieldErrors] = useState<SeriesFieldErrors>({})
  const [preview, setPreview] = useState<GroupLessonSeriesPreviewResponse | null>(null)
  const [submitting, setSubmitting] = useState<'preview' | 'execute' | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const requestScopeRef = useRef(0)
  const effectiveFromRef = useRef<HTMLInputElement | null>(null)
  const endsOnRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    requestScopeRef.current += 1

    async function loadSeries() {
      setLoading(true)
      setSubmitting(null)
      setError(null)

      try {
        const response = await getGroupLessonSeries(lessonSeriesId, controller.signal)
        if (response.seriesId !== lessonSeriesId || (groupId && response.groupId !== groupId)) {
          throw new Error(fe13GroupsCoreText.scheduleIdentityMismatch)
        }
        let scheduleHalls: FilterOption[] = []
        const optionDate = lessonDate && isRealIsoDate(lessonDate)
          ? lessonDate
          : response.businessDate

        try {
          const optionsResponse = await getScheduleLessons({
            from: optionDate,
            to: optionDate,
            groupId: groupId ?? response.groupId,
          }, controller.signal)
          scheduleHalls = mapResponseFilterOptions(optionsResponse.filterOptions).halls
        } catch {
          scheduleHalls = []
        }

        if (controller.signal.aborted) {
          return
        }

        setSeries(response)
        setDraft(buildSeriesDraft(response, scope, lessonDate))
        setHallOptions(mergeSeriesHallOptions(response, scheduleHalls))
        setPreview(null)
        setFieldErrors({})
        setFormError(null)
        setDirty(false)
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : fe2ScheduleCoreText.groupScheduleScreen_string_1b31d0c9)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadSeries()

    return () => {
      requestScopeRef.current += 1
      controller.abort()
    }
  }, [groupId, lessonDate, lessonSeriesId, scope])

  const pending = submitting !== null

  function updateDraft<Field extends keyof SeriesDraft>(
    field: Field,
    value: SeriesDraft[Field],
  ) {
    setDraft((current) => current ? { ...current, [field]: value } : current)
    setDirty(true)
    setPreview(null)
    setFormError(null)
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
  }

  function updateSlot<Field extends keyof SeriesSlotDraft>(
    index: number,
    field: Field,
    value: SeriesSlotDraft[Field],
  ) {
    setDraft((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        slots: current.slots.map((slot, slotIndex) =>
          slotIndex === index ? { ...slot, [field]: value } : slot,
        ),
      }
    })
    setDirty(true)
    setPreview(null)
    setFormError(null)
  }

  function addSlot() {
    setDraft((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        slots: [
          ...current.slots,
          buildNewSeriesSlot(
            current.slots.at(-1),
            hallOptions[0],
            current.slots.length,
          ),
        ],
      }
    })
    setDirty(true)
    setPreview(null)
    setFormError(null)
  }

  function removeSlot(index: number) {
    setDraft((current) => {
      if (!current || current.slots.length <= 1) {
        return current
      }

      return {
        ...current,
        slots: current.slots.filter((_, slotIndex) => slotIndex !== index),
      }
    })
    setDirty(true)
    setPreview(null)
    setFormError(null)
  }

  async function submitPreview() {
    if (!series || !draft) {
      return
    }

    const requestScope = requestScopeRef.current
    setSubmitting('preview')
    setFieldErrors({})
    setFormError(null)

    try {
      const response = await previewGroupLessonSeries(
        lessonSeriesId,
        toSeriesRequest(draft, series),
      )
      if (requestScope !== requestScopeRef.current) return
      setPreview(response)
    } catch (previewError) {
      if (requestScope !== requestScopeRef.current) return
      handleSeriesFormError(previewError)
    } finally {
      if (requestScope === requestScopeRef.current) setSubmitting(null)
    }
  }

  async function confirmSeriesChange() {
    if (!series || !draft || !preview) {
      return
    }

    const requestScope = requestScopeRef.current
    setSubmitting('execute')
    setFieldErrors({})
    setFormError(null)

    try {
      await applyGroupLessonSeries(lessonSeriesId, {
        ...toSeriesRequest(draft, series),
        expectedRevision: preview.revision,
        confirmationToken: preview.confirmationToken,
      })
      if (requestScope !== requestScopeRef.current) return
      setDirty(false)
      setPreview(null)
      onSaved()
    } catch (executeError) {
      if (requestScope !== requestScopeRef.current) return
      if (executeError instanceof ApiError) {
        const recoveryMessage = formatScheduleProblemCode(executeError.code)
        if (recoveryMessage) {
          setPreview(null)
          setFormError(recoveryMessage)
          return
        }
      }

      handleSeriesFormError(executeError)
    } finally {
      if (requestScope === requestScopeRef.current) setSubmitting(null)
    }
  }

  function handleSeriesFormError(formErrorValue: unknown) {
    setPreview(null)

    if (formErrorValue instanceof ApiError) {
      const nextErrors = applyFieldErrors(formErrorValue.fieldErrors, SERIES_FIELD_ALIASES)
      setFieldErrors(nextErrors)
      focusFirstSeriesInvalidField(nextErrors)
      setFormError(
        formatScheduleProblemCode(formErrorValue.code) ??
        fe2ScheduleCoreText.groupScheduleScreen_string_055792ee,
      )
      return
    }

    setFormError(fe2ScheduleCoreText.groupScheduleScreen_string_055792ee)
  }

  function focusFirstSeriesInvalidField(errors: SeriesFieldErrors) {
    const refs = {
      effectiveFrom: effectiveFromRef,
      endsOn: endsOnRef,
    }
    const firstInvalid = (Object.keys(refs) as Array<keyof typeof refs>)
      .find((field) => errors[field])

    if (firstInvalid) {
      window.requestAnimationFrame(() => refs[firstInvalid].current?.focus())
    }
  }

  function cancel() {
    if (dirty && !window.confirm(fe2ScheduleCoreText.groupScheduleScreen_windowConfirm_9ca4aaac)) {
      return
    }

    onBack()
  }

  return (
    <PageLayout
      className="schedule-screen"
      data-testid="schedule-series-edit-screen"
      showHeader
      title={fe2ScheduleCoreText.groupScheduleScreen_title_cd3e4306}
      actions={<Button onClick={cancel} variant="secondary" disabled={pending}>{backLabel}</Button>}
    >
      {loading ? (
        <PageSection>
          <LoadingState label={fe2ScheduleCoreText.groupScheduleScreen_label_82cba72b} />
        </PageSection>
      ) : null}
      {error ? (
        <PageSection>
          <ErrorState
            action={<Button onClick={onBack} variant="light">{backLabel}</Button>}
            message={error}
            title={fe2ScheduleCoreText.groupScheduleScreen_title_f1cab840}
          />
        </PageSection>
      ) : null}
      {!loading && !error && series?.seriesId === lessonSeriesId && (!groupId || series.groupId === groupId) && draft ? (
        <PageSection>
          <form
            data-testid="schedule-series-edit-form"
            onSubmit={(event) => {
              event.preventDefault()
              void submitPreview()
            }}
          >
            <Stack gap="md">
              <Stack gap={4}>
                <Text fw={900}>{series.groupName}</Text>
                <Text c="dimmed" size="sm">
                  {fe2ScheduleCoreText.groupScheduleScreen_jsxText_4b5f3a17}{formatShortDate(series.startsOn)}
                  {series.endsOn ? fe2ScheduleCoreText.groupScheduleScreen_template_aea1f902(formatShortDate(series.endsOn)) : ''}
                  {lessonOccurrenceId ? fe2ScheduleCoreText.groupScheduleScreen_template_705c7b4e(formatShortDate(lessonDate ?? series.businessDate)) : ''}
                </Text>
              </Stack>

              <SegmentedControl
                aria-label={fe2ScheduleCoreText.groupScheduleScreen_ariaLabel_a6a7cac1}
                data={[
                  { value: 'ThisAndFuture', label: fe2ScheduleCoreText.groupScheduleScreen_label_eafa287c },
                  { value: 'EntireSeries', label: fe2ScheduleCoreText.groupScheduleScreen_label_a2706736 },
                ]}
                disabled={pending}
                onChange={(value) => {
                  const nextScope = value as GroupLessonSeriesScope
                  updateDraft('scope', nextScope)
                  updateDraft(
                    'effectiveFrom',
                    nextScope === 'EntireSeries'
                      ? series.currentVersion.entireSeriesEffectiveFrom
                      : (lessonDate && isRealIsoDate(lessonDate)
                        ? lessonDate
                        : series.currentVersion.thisAndFutureMinEffectiveFrom),
                  )
                }}
                value={draft.scope}
              />

              <Group align="flex-start" grow>
                <TextInput
                  disabled={pending || draft.scope === 'EntireSeries'}
                  error={fieldErrors.effectiveFrom}
                  label={fe2ScheduleCoreText.groupScheduleScreen_label_b8a6c0dc}
                  max="9999-12-31"
                  min="1900-01-01"
                  onChange={(event) => updateDraft('effectiveFrom', event.currentTarget.value)}
                  ref={effectiveFromRef}
                  type="date"
                  value={draft.effectiveFrom}
                />
                <TextInput
                  disabled={pending}
                  error={fieldErrors.endsOn}
                  label={fe2ScheduleCoreText.groupScheduleScreen_label_6ac938c0}
                  max="9999-12-31"
                  min="1900-01-01"
                  onChange={(event) => updateDraft('endsOn', event.currentTarget.value)}
                  ref={endsOnRef}
                  type="date"
                  value={draft.endsOn}
                />
              </Group>

              <Stack gap="sm">
                <Group align="center" justify="space-between">
                  <Text fw={900}>{fe2ScheduleCoreText.groupScheduleScreen_jsxText_38aaedce}</Text>
                  <Button
                    className="schedule-series-slot__action"
                    disabled={pending}
                    leftSection={<IconPlus size={18} />}
                    onClick={addSlot}
                    type="button"
                    variant="light"
                  >
                    {fe2ScheduleCoreText.groupScheduleScreen_jsxText_61f9839e}</Button>
                </Group>
                {draft.slots.length === 0 ? (
                  <Alert color="red" icon={<IconAlertTriangle size={18} />}>
                    {fe2ScheduleCoreText.groupScheduleScreen_jsxText_25d150a9}</Alert>
                ) : draft.slots.map((slot, index) => {
                  const removeDisabled = pending || draft.slots.length <= 1

                  return (
                    <Paper
                      className="schedule-series-slot"
                      data-testid={`schedule-series-slot-${index}`}
                      key={slot.key}
                      radius="md"
                      withBorder
                    >
                      <Stack gap="sm">
                        <Select
                          data={WEEKDAY_OPTIONS}
                          disabled={pending}
                          label={fe2ScheduleCoreText.groupScheduleScreen_label_68c27d77}
                          onChange={(value) =>
                            updateSlot(index, 'isoWeekday', value ? Number(value) : slot.isoWeekday)}
                          value={String(slot.isoWeekday)}
                        />
                        <Group align="flex-start" grow>
                          <TextInput
                            disabled={pending}
                            label={fe2ScheduleCoreText.groupScheduleScreen_label_1635ad1f}
                            onChange={(event) => updateSlot(index, 'startTime', event.currentTarget.value)}
                            type="time"
                            value={trimSeconds(slot.startTime)}
                          />
                          <NumberInput
                            disabled={pending}
                            label={fe2ScheduleCoreText.groupScheduleScreen_label_86301601}
                            min={1}
                            onChange={(value) =>
                              updateSlot(index, 'durationMinutes', typeof value === 'number' ? value : '')}
                            value={slot.durationMinutes}
                          />
                        </Group>
                        <Select
                          data={hallOptions}
                          disabled={pending}
                          label={fe2ScheduleCoreText.groupScheduleScreen_label_182f7c57}
                          onChange={(value) => updateSlot(index, 'hallId', value ?? '')}
                          searchable
                          value={slot.hallId || null}
                        />
                        <Button
                          aria-describedby={removeDisabled ? `schedule-series-remove-reason-${index}` : undefined}
                          className="schedule-series-slot__action"
                          color="red"
                          disabled={removeDisabled}
                          onClick={() => removeSlot(index)}
                          type="button"
                          variant="light"
                        >
                          {fe2ScheduleCoreText.groupScheduleScreen_jsxText_333afd46}</Button>
                        {removeDisabled ? (
                          <Text
                            c="dimmed"
                            id={`schedule-series-remove-reason-${index}`}
                            size="sm"
                          >
                            {fe2ScheduleCoreText.groupScheduleScreen_jsxText_3fbb07c9}</Text>
                        ) : null}
                      </Stack>
                    </Paper>
                  )
                })}
              </Stack>

              {formError ? (
                <Alert color="yellow" icon={<IconAlertTriangle size={18} />}>
                  {formError}
                </Alert>
              ) : null}

              {preview ? (
                <SeriesPreviewPanel preview={preview} />
              ) : null}

              <StickyFormActions
                className="schedule-route-form__footer"
                primaryAction={preview ? (
                  <Button
                    loading={submitting === 'execute'}
                    onClick={() => void confirmSeriesChange()}
                    type="button"
                  >
                    {fe2ScheduleCoreText.groupScheduleScreen_jsxText_8e72e5a3}</Button>
                ) : (
                  <Button loading={submitting === 'preview'} type="submit">
                    {formError ? fe2ScheduleCoreText.groupScheduleScreen_string_62b92aa4 : fe2ScheduleCoreText.groupScheduleScreen_string_857a90c1}
                  </Button>
                )}
                secondaryAction={<Button disabled={pending} onClick={cancel} type="button" variant="light">
                  {fe2ScheduleCoreText.groupScheduleScreen_jsxText_8fbe9b75}</Button>}
              />
            </Stack>
          </form>
        </PageSection>
      ) : null}
    </PageLayout>
  )
}

type SeriesSlotDraft = {
  key: string
  isoWeekday: number
  startTime: string
  durationMinutes: number | ''
  hallId: string
}

type SeriesDraft = {
  scope: GroupLessonSeriesScope
  effectiveFrom: string
  endsOn: string
  slots: SeriesSlotDraft[]
}

type SeriesFieldErrors = Partial<Record<'scope' | 'effectiveFrom' | 'endsOn' | 'slots', string>>

const SERIES_FIELD_ALIASES = {
  scope: 'scope',
  effectiveFrom: 'effectiveFrom',
  endsOn: 'endsOn',
  slots: 'slots',
} satisfies Record<string, keyof SeriesFieldErrors>

const WEEKDAY_OPTIONS = [
  { value: '1', label: fe2ScheduleCoreText.groupScheduleScreen_label_a59b45a7 },
  { value: '2', label: fe2ScheduleCoreText.groupScheduleScreen_label_cdfa593d },
  { value: '3', label: fe2ScheduleCoreText.groupScheduleScreen_label_d606a9df },
  { value: '4', label: fe2ScheduleCoreText.groupScheduleScreen_label_12be87c8 },
  { value: '5', label: fe2ScheduleCoreText.groupScheduleScreen_label_abbd2e86 },
  { value: '6', label: fe2ScheduleCoreText.groupScheduleScreen_label_ddb0ee8e },
  { value: '7', label: fe2ScheduleCoreText.groupScheduleScreen_label_f4276ba4 },
]

function buildSeriesDraft(
  series: GroupLessonSeriesReadResponse,
  routeScope: 'this-and-future' | 'entire',
  routeLessonDate?: string | null,
): SeriesDraft {
  const scope: GroupLessonSeriesScope =
    routeScope === 'entire' ? 'EntireSeries' : 'ThisAndFuture'
  const fallbackEffectiveFrom = scope === 'EntireSeries'
    ? series.currentVersion.entireSeriesEffectiveFrom
    : series.currentVersion.thisAndFutureMinEffectiveFrom

  return {
    scope,
    effectiveFrom:
      scope === 'ThisAndFuture' && routeLessonDate && isRealIsoDate(routeLessonDate)
        ? routeLessonDate
        : fallbackEffectiveFrom,
    endsOn: series.endsOn ?? '',
    slots: series.currentVersion.slots.map((slot, index) => ({
      key: `${slot.isoWeekday}:${slot.startTime}:${slot.hallId}:${index}`,
      isoWeekday: slot.isoWeekday,
      startTime: trimSeconds(slot.startTime),
      durationMinutes: slot.durationMinutes,
      hallId: slot.hallId,
    })),
  }
}

function buildNewSeriesSlot(
  previousSlot: SeriesSlotDraft | undefined,
  fallbackHall: FilterOption | undefined,
  index: number,
): SeriesSlotDraft {
  return {
    key: `new:${Date.now()}:${index}`,
    isoWeekday: previousSlot?.isoWeekday ?? 1,
    startTime: previousSlot?.startTime ?? '09:00',
    durationMinutes: previousSlot?.durationMinutes ?? 60,
    hallId: previousSlot?.hallId ?? fallbackHall?.value ?? '',
  }
}

function toSeriesRequest(
  draft: SeriesDraft,
  series: GroupLessonSeriesReadResponse,
): GroupLessonSeriesRequest {
  return {
    scope: draft.scope,
    effectiveFrom: draft.scope === 'EntireSeries'
      ? series.currentVersion.entireSeriesEffectiveFrom
      : draft.effectiveFrom || null,
    endsOn: draft.endsOn || null,
    slots: draft.slots.map((slot) => ({
      isoWeekday: slot.isoWeekday,
      startTime: trimSeconds(slot.startTime),
      durationMinutes: typeof slot.durationMinutes === 'number' ? slot.durationMinutes : null,
      hallId: slot.hallId || null,
    })),
    expectedRevision: series.revision,
  }
}

function mergeSeriesHallOptions(
  series: GroupLessonSeriesReadResponse,
  options: FilterOption[],
) {
  const byId = new Map<string, FilterOption>()
  for (const slot of series.currentVersion.slots) {
    byId.set(slot.hallId, { value: slot.hallId, label: slot.hallName })
  }
  for (const option of options) {
    byId.set(option.value, option)
  }

  return [...byId.values()]
}

function SeriesPreviewPanel({ preview }: { preview: GroupLessonSeriesPreviewResponse }) {
  return (
    <Paper className="schedule-series-preview" data-testid="schedule-series-preview" radius="md" withBorder>
      <Stack gap="sm">
        <Stack gap={2}>
          <Text fw={900}>{fe2ScheduleCoreText.groupScheduleScreen_jsxText_d66006ce}</Text>
          <Text c="dimmed" size="sm">
            {fe2ScheduleCoreText.groupScheduleScreen_jsxText_720752c6}{preview.scope === 'EntireSeries' ? fe2ScheduleCoreText.groupScheduleScreen_string_648188fd : fe2ScheduleCoreText.groupScheduleScreen_string_9d63ad76} {fe2ScheduleCoreText.groupScheduleScreen_jsxText_a137f17a}{' '}{fe2ScheduleCoreText.groupScheduleScreen_jsxText_a1f5d39a}{formatShortDate(preview.effectiveFrom)}
            {preview.endsOn ? fe2ScheduleCoreText.groupScheduleScreen_template_855e5a61(formatShortDate(preview.endsOn)) : ''}
          </Text>
          <Text c="dimmed" size="sm">
            {fe2ScheduleCoreText.groupScheduleScreen_jsxText_672a522d}{preview.impact.totalAffectedOccurrences}{fe2ScheduleCoreText.groupScheduleScreen_jsxText_901e768a}{formatExpiresAt(preview.expiresAt)}{fe2ScheduleCoreText.groupScheduleScreen_jsxText_cdb4ee2a}</Text>
        </Stack>
        {preview.warnings.length > 0 ? <WarningList warnings={preview.warnings} /> : null}
        {preview.impact.examples.length > 0 ? (
          <Stack gap={4}>
            <Text fw={800} size="sm">{fe2ScheduleCoreText.groupScheduleScreen_jsxText_4e848f28}</Text>
            {preview.impact.examples.slice(0, 3).map((occurrence) => (
              <Text c="dimmed" key={`${occurrence.lessonOccurrenceId}:${occurrence.lessonDate}`} size="sm">
                {formatShortDate(occurrence.lessonDate)} {fe2ScheduleCoreText.groupScheduleScreen_jsxText_a137f17a}{trimSeconds(occurrence.startTime)} {fe2ScheduleCoreText.groupScheduleScreen_jsxText_a137f17a}{occurrence.hallName}
              </Text>
            ))}
          </Stack>
        ) : null}
        {preview.impact.skipped.length > 0 ? (
          <Stack gap={4}>
            <Text fw={800} size="sm">{fe2ScheduleCoreText.groupScheduleScreen_jsxText_4c414dbf}</Text>
            {preview.impact.skipped.slice(0, 3).map((occurrence) => (
              <Text c="dimmed" key={`${occurrence.lessonOccurrenceId}:${occurrence.lessonDate}`} size="sm">
                {formatShortDate(occurrence.lessonDate)} {fe2ScheduleCoreText.groupScheduleScreen_jsxText_a137f17a}{formatSkippedReason(occurrence.reason)}
              </Text>
            ))}
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  )
}

function formatSkippedReason(reason: string) {
  return formatScheduleProblemCode(reason) ?? fe2ScheduleCoreText.groupScheduleScreen_string_d2da32db
}

