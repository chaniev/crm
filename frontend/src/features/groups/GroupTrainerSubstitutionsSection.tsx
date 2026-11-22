import { useEffect, useRef, useState } from 'react'
import { Alert, Badge, Group, Stack, Text, Title } from '@mantine/core'
import {
  getGroupTrainerSubstitutionPeriods, getGroupTrainerSubstitutions,
  type GroupTrainerSubstitution, type GroupTrainerSubstitutionsResponse, type TrainerOption,
} from '../../lib/api'
import { fe14GroupStaffingText as copy } from '../../resources/fe-14-group-staffing'
import { Button, LoadingState } from '../shared/ux'
import { formatPeriod } from './formatSubstitutionPeriod'
import { SubstitutionPeriodDialog } from './SubstitutionPeriodDialog'

type Props = { groupId: string; groupName: string; trainerOptions: TrainerOption[] }
type Lists = { periods: GroupTrainerSubstitutionsResponse; legacy: GroupTrainerSubstitutionsResponse }

const historyTake = 20

function hasMore(list: GroupTrainerSubstitutionsResponse) {
  return list.history.items.length < list.history.totalCount
}

export function GroupTrainerSubstitutionsSection({ groupId, groupName, trainerOptions }: Props) {
  const [data, setData] = useState<Lists | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [paging, setPaging] = useState(false)
  const [pageError, setPageError] = useState('')
  const [dialog, setDialog] = useState<'create' | GroupTrainerSubstitution | null>(null)
  const [notice, setNotice] = useState('')
  const returnTarget = useRef<HTMLElement | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const focusAfterCreate = useRef(false)

  useEffect(() => {
    if (!focusAfterCreate.current || (!data && !error)) return
    focusAfterCreate.current = false
    const target = document.getElementById('group-substitution-create') ?? heading.current
    target?.focus()
  }, [data, error])

  useEffect(() => {
    const controller = new AbortController()
    const params = { historySkip: 0, historyTake }
    Promise.all([
      getGroupTrainerSubstitutionPeriods(groupId, params, controller.signal),
      getGroupTrainerSubstitutions(groupId, params, controller.signal),
    ]).then(([periods, legacy]) => {
      if (!controller.signal.aborted) setData({ periods, legacy })
    }).catch((cause) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : copy.loadFailure)
    })
    return () => controller.abort()
  }, [groupId, revision])

  function reload() {
    setError('')
    setPageError('')
    setData(null)
    setRevision((current) => current + 1)
  }

  async function loadMore() {
    if (!data || paging) return
    setPaging(true)
    setPageError('')
    async function nextPage(list: GroupTrainerSubstitutionsResponse, get: typeof getGroupTrainerSubstitutions) {
      if (!hasMore(list)) return list
      const next = await get(groupId, { historySkip: list.history.items.length, historyTake })
      return { ...next, history: { ...next.history, items: [...list.history.items, ...next.history.items] } }
    }
    try {
      const [periods, legacy] = await Promise.all([
        nextPage(data.periods, getGroupTrainerSubstitutionPeriods), nextPage(data.legacy, getGroupTrainerSubstitutions),
      ])
      setData((current) => current === data ? { periods, legacy } : current)
    } catch (cause) {
      setPageError(cause instanceof Error ? cause.message : copy.loadFailure)
    } finally {
      setPaging(false)
    }
  }

  function open(next: NonNullable<typeof dialog>, trigger: HTMLElement) {
    setNotice('')
    returnTarget.current = trigger
    setDialog(next)
  }

  function close() {
    setDialog(null)
    requestAnimationFrame(() => {
      const target = returnTarget.current?.isConnected ? returnTarget.current : heading.current
      target?.focus()
    })
  }

  const archived = data ? [...data.legacy.current, ...data.legacy.history.items] : []

  return (
    <section aria-labelledby="group-substitutions-title" className="group-substitutions">
      <Stack gap="lg">
        <div className="group-substitutions__heading">
          <Title id="group-substitutions-title" order={2} ref={heading} tabIndex={-1}>{copy.periodSection}</Title>
          {data?.periods.canCreate && (
            <Button id="group-substitution-create" onClick={(event) => open('create', event.currentTarget)}>{copy.assignPeriod}</Button>
          )}
        </div>
        {notice && <Alert role="status" color="teal">{notice}</Alert>}
        {error ? (
          <Alert role="alert" color="red"><Stack align="start">
            <Text>{error}</Text><Button variant="secondary" onClick={reload}>{copy.retry}</Button>
          </Stack></Alert>
        ) : !data ? (
          <LoadingState label={copy.loadingPeriods} />
        ) : (
          <>
            {!data.periods.canCreate && data.periods.createUnavailableReason && <Text>{data.periods.createUnavailableReason.message}</Text>}
            <div>
              <Title order={3} size="md">{copy.periodCurrent}</Title>
              {data.periods.current.length ? (
                <div aria-label={copy.periodCurrent} role="list">
                  {data.periods.current.map((row) => (
                    <PeriodRow key={row.id} row={row} onCancel={(trigger) => open(row, trigger)} />
                  ))}
                </div>
              ) : <Text c="dimmed">{copy.periodEmpty}</Text>}
            </div>
            <div>
              <Button variant="secondary" aria-expanded={expanded} aria-controls="group-period-history"
                onClick={() => setExpanded(!expanded)}>{expanded ? copy.hideHistory : copy.showHistory}</Button>
              {expanded && <Stack gap="sm" id="group-period-history" mt="md">
                <Title order={3} size="md">{copy.periodHistory}</Title>
                {!data.periods.history.totalCount && !archived.length && <Text c="dimmed">{copy.emptyHistory}</Text>}
                <div aria-label={copy.periodHistory} role="list">
                  {data.periods.history.items.map((row) => <PeriodRow key={row.id} row={row} />)}
                  {archived.map((row) => <PeriodRow key={`legacy-${row.id}`} row={row} legacy />)}
                </div>
                {pageError && <Alert color="red" role="alert">{pageError}</Alert>}
                {(hasMore(data.periods) || hasMore(data.legacy)) && (
                  <Group><Button loading={paging} variant="secondary" onClick={() => void loadMore()}>{copy.showMore}</Button></Group>
                )}
              </Stack>}
            </div>
          </>
        )}
      </Stack>
      {dialog && <SubstitutionPeriodDialog groupId={groupId} groupName={groupName} trainerOptions={trainerOptions}
        period={dialog === 'create' ? null : dialog} onClose={close} onSaved={(message) => {
          setNotice(message)
          if (dialog === 'create') {
            focusAfterCreate.current = true
            setDialog(null)
          } else {
            returnTarget.current = heading.current
            close()
          }
          reload()
        }} />}
    </section>
  )
}

function PeriodRow({ row, legacy = false, onCancel }: {
  row: GroupTrainerSubstitution
  legacy?: boolean
  onCancel?: (trigger: HTMLElement) => void
}) {
  return (
    <div className="group-substitutions__row" role="listitem">
      <div>
        <Text fw={700}>{row.substituteTrainer.fullName}</Text>
        <Text size="sm">{formatPeriod(row)}</Text>
      </div>
      {legacy ? <Text className="group-substitutions__archive" size="sm" c="dimmed">{copy.archiveExplanation}</Text> : (
        <Badge variant="light" color={{ Active: 'teal', Upcoming: 'blue', Expired: 'gray', Cancelled: 'gray' }[row.status]}>
          {copy.periodStatuses[row.status]}
        </Badge>
      )}
      {onCancel && row.allowedActions.canCancel && (
        <Button variant="secondary" aria-label={`${copy.cancelPeriod} ${row.substituteTrainer.fullName}`}
          onClick={(event) => onCancel(event.currentTarget)}>{copy.cancel}</Button>
      )}
    </div>
  )
}
