import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, getGroupLessonSeries, type GroupLessonSeriesReadResponse } from '../../lib/api'
import { fe13GroupsCoreText as text } from '../../resources/fe-13-groups-core'

export type ScheduleEntryState =
  | { kind: 'loading'; groupId: string }
  | { kind: 'ready'; groupId: string; series: GroupLessonSeriesReadResponse }
  | { kind: 'error'; groupId: string; message: string; retry: boolean }

export function useGroupScheduleEntry(groupId: string, enabled: boolean) {
  const [state, setState] = useState<ScheduleEntryState>({ kind: 'loading', groupId })
  const requestId = useRef(0)
  const activeGroup = useRef<string | null>(null)

  const load = useCallback((signal?: AbortSignal) => {
    if (!enabled || activeGroup.current !== groupId) return Promise.resolve(null)
    const id = ++requestId.current
    return getGroupLessonSeries(groupId, signal).then(series => {
      if (signal?.aborted || requestId.current !== id || activeGroup.current !== groupId) return null
      if (series.groupId !== groupId || !series.seriesId) {
        setState({ kind: 'error', groupId, message: text.scheduleIdentityMismatch, retry: false })
        return null
      }
      setState({ kind: 'ready', groupId, series })
      return series
    }).catch((error: unknown) => {
      if (signal?.aborted || requestId.current !== id || activeGroup.current !== groupId) return null
      const forbidden = error instanceof ApiError && error.status === 403
      const missing = error instanceof ApiError && error.status === 404 && error.code === 'lesson-series-not-found'
      setState({ kind: 'error', groupId,
        message: forbidden ? text.scheduleForbidden : missing ? text.scheduleMissing
          : error instanceof Error ? error.message : text.scheduleLoadFailed,
        retry: !forbidden && !missing,
      })
      return null
    })
  }, [enabled, groupId])

  useEffect(() => {
    activeGroup.current = enabled ? groupId : null
    const controller = new AbortController()
    void load(controller.signal)
    return () => {
      controller.abort()
      activeGroup.current = null
      requestId.current += 1
    }
  }, [enabled, groupId, load])

  return {
    state: state.groupId === groupId ? state : { kind: 'loading', groupId } as ScheduleEntryState,
    refresh: () => {
      setState({ kind: 'loading', groupId })
      return load()
    },
  }
}

