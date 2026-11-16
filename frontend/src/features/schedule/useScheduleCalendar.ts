import { useEffect, useMemo, useRef, useState } from 'react'
import { getScheduleLessons, type ScheduleAction, type ScheduleLesson } from '../../lib/api'
import { fe2ScheduleCoreText } from '../../resources/fe-2-schedule-core'
import { emptyFilterOptions, mapResponseFilterOptions } from './scheduleFilterOptions'
import { getScheduleRange, pickScheduleFilters, type ScheduleUrlState } from './scheduleUrlState'

export function useScheduleCalendar(urlState: ScheduleUrlState) {
  const [lessons, setLessons] = useState<ScheduleLesson[]>([])
  const [capabilities, setCapabilities] = useState<{ createOneOff: ScheduleAction } | null>(null)
  const [filterOptions, setFilterOptions] = useState(() => emptyFilterOptions())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const isFirstLoadRef = useRef(true)

  const range = useMemo(
    () => getScheduleRange(urlState.date, urlState.view),
    [urlState.date, urlState.view],
  )

  useEffect(() => {
    const controller = new AbortController()
    const isInitial = isFirstLoadRef.current

    async function loadLessons() {
      if (isInitial) {
        setLoading(true)
      } else {
        setRefreshing(true)
      }
      setError(null)

      try {
        const response = await getScheduleLessons({
          from: range.from,
          to: range.to,
          ...pickScheduleFilters(urlState),
        }, controller.signal)

        if (controller.signal.aborted) {
          return
        }

        setLessons(sortLessons(response.items))
        setCapabilities(response.capabilities)
        setFilterOptions(mapResponseFilterOptions(response.filterOptions))
      } catch (loadError) {
        if (controller.signal.aborted) {
          return
        }

        setError(loadError instanceof Error ? loadError.message : fe2ScheduleCoreText.groupScheduleScreen_string_c8822d97)
      } finally {
        if (!controller.signal.aborted) {
          isFirstLoadRef.current = false
          setLoading(false)
          setRefreshing(false)
        }
      }
    }

    void loadLessons()

    return () => controller.abort()
  }, [range.from, range.to, reloadKey, urlState])

  function refresh() {
    setReloadKey((key) => key + 1)
  }

  return { lessons, capabilities, filterOptions, loading, refreshing, error, range, refresh }
}

function sortLessons(items: readonly ScheduleLesson[]) {
  return [...items].sort((first, second) =>
    first.lessonDate.localeCompare(second.lessonDate) ||
    first.startTime.localeCompare(second.startTime) ||
    first.groupName.localeCompare(second.groupName, 'ru') ||
    first.lessonOccurrenceId.localeCompare(second.lessonOccurrenceId),
  )
}

