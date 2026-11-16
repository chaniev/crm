import { addIsoDays, isRealIsoDate, startOfIsoWeek, todayIso } from './scheduleDateTime'

export type ScheduleViewMode = 'day' | 'week'

export type ScheduleFilters = {
  branchId: string | null
  hallId: string | null
  trainerId: string | null
  groupId: string | null
  groupTypeId: string | null
}

export type ScheduleUrlState = ScheduleFilters & {
  date: string
  view: ScheduleViewMode
}

export const EMPTY_FILTERS: ScheduleFilters = {
  branchId: null,
  hallId: null,
  trainerId: null,
  groupId: null,
  groupTypeId: null,
}

const FILTER_KEYS = ['branchId', 'hallId', 'trainerId', 'groupId', 'groupTypeId'] as const
export function getScheduleRange(date: string, view: ScheduleViewMode) {
  if (view === 'day') {
    return { from: date, to: date }
  }

  const from = startOfIsoWeek(date)
  return { from, to: addIsoDays(from, 6) }
}

export function readScheduleUrlState(): ScheduleUrlState {
  const params = new URLSearchParams(window.location.search)
  const dateParam = params.get('date')
  const viewParam = params.get('view')

  return {
    date: isRealIsoDate(dateParam) ? dateParam : todayIso(),
    view: viewParam === 'week' ? 'week' : 'day',
    branchId: readNullableParam(params, 'branchId'),
    hallId: readNullableParam(params, 'hallId'),
    trainerId: readNullableParam(params, 'trainerId'),
    groupId: readNullableParam(params, 'groupId'),
    groupTypeId: readNullableParam(params, 'groupTypeId'),
  }
}

export function writeScheduleUrlState(
  state: ScheduleUrlState,
  options: { replace?: boolean } = {},
) {
  const params = new URLSearchParams()
  params.set('date', state.date)
  params.set('view', state.view)
  for (const key of FILTER_KEYS) {
    const value = state[key]
    if (value) {
      params.set(key, value)
    }
  }

  const nextPath = `/schedule?${params.toString()}`
  if (`${window.location.pathname}${window.location.search}` === nextPath) {
    return
  }

  if (options.replace) {
    window.history.replaceState(window.history.state, '', nextPath)
  } else {
    window.history.pushState(window.history.state, '', nextPath)
  }
}

function readNullableParam(params: URLSearchParams, key: string) {
  const value = params.get(key)?.trim()
  return value ? value : null
}

export function pickScheduleFilters(state: ScheduleUrlState): ScheduleFilters {
  return {
    branchId: state.branchId,
    hallId: state.hallId,
    trainerId: state.trainerId,
    groupId: state.groupId,
    groupTypeId: state.groupTypeId,
  }
}

export function countActiveFilters(filters: ScheduleFilters) {
  return FILTER_KEYS.filter((key) => Boolean(filters[key])).length
}

