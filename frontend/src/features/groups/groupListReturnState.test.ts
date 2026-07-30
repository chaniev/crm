import { describe, expect, test } from 'vitest'
import type { AppRoute } from '../../lib/appRoutes'
import {
  createGroupListReturnSnapshot,
  getGroupListReturnHistoryStateForRoute,
  readGroupListReturnSnapshot,
  stripGroupListReturnSnapshotFromHistoryState,
} from './groupListReturnState'

const groupsRoute: AppRoute = { kind: 'section', section: 'Groups' }
const editRoute: AppRoute = { kind: 'groupEdit', groupId: 'group-1' }
const unrelatedRoute: AppRoute = { kind: 'section', section: 'Clients' }

describe('group list return-state helpers', () => {
  test('applies pending draft before edit navigation and resets page when query changes', () => {
    const snapshot = createGroupListReturnSnapshot({
      filters: {
        appliedQuery: 'old',
        isActive: null,
        withoutTrainer: false,
      },
      searchDraft: '  new  ',
      page: 4,
      selectedGroupId: 'group-1',
      scrollY: 120,
      originEntryKey: 'groups:seed',
    })

    expect(snapshot.filters.appliedQuery).toBe('new')
    expect(snapshot.searchDraft).toBe('new')
    expect(snapshot.page).toBe(1)
    expect(snapshot.anchorGroupId).toBe('group-1')
  })

  test('preserves unrelated history keys while storing primitive group snapshot', () => {
    const snapshot = createGroupListReturnSnapshot({
      filters: {
        appliedQuery: '',
        isActive: true,
        withoutTrainer: true,
      },
      searchDraft: '',
      page: 2,
      selectedGroupId: 'group-1',
      scrollY: 42,
      originEntryKey: 'groups:seed',
      returnDepth: 12,
    })
    const state = getGroupListReturnHistoryStateForRoute(
      { unrelated: 'keep' },
      editRoute,
      snapshot,
    )

    expect(state).toMatchObject({ unrelated: 'keep' })
    expect(readGroupListReturnSnapshot(state)).toMatchObject({
      filters: {
        appliedQuery: '',
        isActive: true,
        withoutTrainer: true,
      },
      page: 2,
      selectedGroupId: 'group-1',
      scrollY: 42,
      originEntryKey: 'groups:seed',
      returnDepth: 8,
    })
  })

  test('allowlist keeps groups list and edit only, and strip preserves unrelated keys', () => {
    const snapshot = createGroupListReturnSnapshot({
      filters: {
        appliedQuery: '',
        isActive: null,
        withoutTrainer: false,
      },
      searchDraft: '',
      page: 1,
      selectedGroupId: null,
      scrollY: 0,
      originEntryKey: 'groups:seed',
    })
    const listState = getGroupListReturnHistoryStateForRoute({}, groupsRoute, snapshot)
    const droppedState = getGroupListReturnHistoryStateForRoute(
      listState,
      unrelatedRoute,
      snapshot,
    )

    expect(readGroupListReturnSnapshot(listState)).not.toBeNull()
    expect(readGroupListReturnSnapshot(droppedState)).toBeNull()
    expect(
      stripGroupListReturnSnapshotFromHistoryState({
        ...listState,
        unrelated: 'keep',
      }),
    ).toEqual({ unrelated: 'keep' })
  })
})
