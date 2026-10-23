import { expect, test } from 'vitest'
import { createGroupScheduleReturnContext, mergeGroupScheduleReturnContext, readGroupScheduleReturnContext, resolveSeriesEditorOrigin, stripGroupScheduleReturnContext } from './groupScheduleReturnState'

const route = { kind: 'scheduleSeriesEdit', lessonSeriesId: 'series-A', groupId: 'group-A', scope: 'this-and-future' } as const

test('group origin validates separate series/group identities and history entry role across serialization', () => {
  const origin = createGroupScheduleReturnContext('group-A', 'series-A', 321)
  const state = mergeGroupScheduleReturnContext({ unrelated: 1 }, { ...origin, entry: 'editor' })
  expect(readGroupScheduleReturnContext(JSON.parse(JSON.stringify(state)), route)).toEqual({ ...origin, entry: 'editor' })
  expect(readGroupScheduleReturnContext(state, { ...route, groupId: 'group-B' })).toBeNull()
  expect(readGroupScheduleReturnContext(state, { ...route, lessonSeriesId: 'series-B' })).toBeNull()
  expect(readGroupScheduleReturnContext(state, { kind: 'groupEdit', groupId: 'group-A' })).toBeNull()
  expect(readGroupScheduleReturnContext(mergeGroupScheduleReturnContext({}, origin), { kind: 'groupEdit', groupId: 'group-A' })).toEqual(origin)
  expect(stripGroupScheduleReturnContext(state)).toEqual({ unrelated: 1 })
})

test('malformed origin cannot provide a return URL and existing calendar/lesson fallback is preserved', () => {
  const invalid = { crmGroupScheduleReturn: { version: 1, kind: 'external', path: 'https://example.com', entry: 'editor' } }
  expect(resolveSeriesEditorOrigin(route, invalid)).toEqual({ kind: 'calendar' })
  expect(resolveSeriesEditorOrigin({ ...route, lessonOccurrenceId: 'occ', lessonDate: '2026-10-23' }, {}))
    .toEqual({ kind: 'lesson', lessonOccurrenceId: 'occ', lessonDate: '2026-10-23' })
  expect(readGroupScheduleReturnContext({ crmGroupScheduleReturn: { ...createGroupScheduleReturnContext('group-A', 'series-A', 0), entry: 'editor', scrollY: -1 } }, route)).toBeNull()
})
