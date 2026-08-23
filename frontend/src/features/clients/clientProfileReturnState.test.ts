import { describe, expect, test } from 'vitest'
import type { AppRoute } from '../../lib/appRoutes'
import {
  createClientProfileReturnContext,
  getClientProfileOriginRoute,
  getClientProfileReturnHistoryStateForRoute,
  getNextClientProfileReturnDepth,
  mergeClientProfileReturnContextIntoHistoryState,
  readClientProfileReturnContext,
  stripClientProfileReturnContextFromHistoryState,
  withClientProfileReturnDepth,
} from './clientProfileReturnState'

describe('clientProfileReturnState', () => {
  test('round-trips attendance origin and preserves unrelated history state', () => {
    const context = createClientProfileReturnContext({
      origin: {
        kind: 'attendance',
        route: { kind: 'section', section: 'Attendance' },
        groupId: 'group-2',
        trainingDate: '2026-08-15',
        rosterView: 'all',
        anchorClientId: 'client-7',
      },
      originEntryKey: 'client-profile:attendance-entry',
      returnDepth: 1,
    })

    const state = mergeClientProfileReturnContextIntoHistoryState(
      {
        unrelated: { retained: true },
        crmClientListReturnState: { version: 1 },
        crmGroupListReturnState: { version: 1 },
      },
      context,
    )

    expect(readClientProfileReturnContext(state)).toEqual(context)
    expect(state).toMatchObject({
      unrelated: { retained: true },
      crmClientListReturnState: { version: 1 },
      crmGroupListReturnState: { version: 1 },
    })
    expect(getClientProfileOriginRoute(context)).toEqual({
      kind: 'section',
      section: 'Attendance',
    })
  })

  test('round-trips a typed group edit origin', () => {
    const context = createClientProfileReturnContext({
      origin: {
        kind: 'groupEdit',
        route: { kind: 'groupEdit', groupId: 'group-11' },
        anchorClientId: 'client-4',
      },
      originEntryKey: 'client-profile:group-entry',
      returnDepth: 0,
    })

    expect(
      readClientProfileReturnContext(
        mergeClientProfileReturnContextIntoHistoryState({}, context),
      ),
    ).toEqual(context)
    expect(getClientProfileOriginRoute(context)).toEqual({
      kind: 'groupEdit',
      groupId: 'group-11',
    })
  })

  test('strips only the TASK-116 key', () => {
    const state = stripClientProfileReturnContextFromHistoryState({
      crmClientProfileReturnContext: { version: 1 },
      crmClientListReturnState: { version: 1 },
      unrelated: 42,
    })

    expect(state).toEqual({
      crmClientListReturnState: { version: 1 },
      unrelated: 42,
    })
  })

  test('retains context only across origin and scoped client routes', () => {
    const context = createClientProfileReturnContext({
      origin: {
        kind: 'groupEdit',
        route: { kind: 'groupEdit', groupId: 'group-11' },
        anchorClientId: 'client-4',
      },
      originEntryKey: 'client-profile:group-entry',
      returnDepth: 1,
    })
    const details: AppRoute = { kind: 'clientDetails', clientId: 'client-4' }
    const edit: AppRoute = { kind: 'clientEdit', clientId: 'client-4' }

    expect(
      readClientProfileReturnContext(
        getClientProfileReturnHistoryStateForRoute({}, details, context),
      ),
    ).toEqual(context)
    expect(
      readClientProfileReturnContext(
        getClientProfileReturnHistoryStateForRoute({}, edit, context),
      ),
    ).toEqual(context)
    expect(
      readClientProfileReturnContext(
        getClientProfileReturnHistoryStateForRoute(
          mergeClientProfileReturnContextIntoHistoryState({}, context),
          { kind: 'section', section: 'Clients' },
          context,
        ),
      ),
    ).toBeNull()
  })

  test('increments and bounds depth across details-edit-details', () => {
    const context = createClientProfileReturnContext({
      origin: {
        kind: 'attendance',
        route: { kind: 'section', section: 'Attendance' },
        groupId: 'group-2',
        trainingDate: '2026-08-15',
        rosterView: 'unmarked',
        anchorClientId: 'client-7',
      },
      originEntryKey: 'client-profile:attendance-entry',
      returnDepth: 1,
    })

    expect(
      getNextClientProfileReturnDepth(
        { kind: 'clientDetails', clientId: 'client-7' },
        context,
      ),
    ).toBe(2)
    expect(
      getNextClientProfileReturnDepth(
        { kind: 'clientEdit', clientId: 'client-7' },
        withClientProfileReturnDepth(context, 8),
      ),
    ).toBe(8)
  })

  test('normalizes safe version-1 group edit history while rejecting legacy attendance history', () => {
    expect(
      readClientProfileReturnContext({
        crmClientProfileReturnContext: {
          version: 1,
          origin: {
            kind: 'groupEdit',
            route: { kind: 'groupEdit', groupId: 'group-11' },
            anchorClientId: 'client-4',
          },
          originEntryKey: 'client-profile:group-entry',
          returnDepth: 1,
        },
      }),
    ).toEqual({
      version: 2,
      origin: {
        kind: 'groupEdit',
        route: { kind: 'groupEdit', groupId: 'group-11' },
        anchorClientId: 'client-4',
      },
      originEntryKey: 'client-profile:group-entry',
      returnDepth: 1,
    })

    expect(
      readClientProfileReturnContext({
        crmClientProfileReturnContext: {
          version: 1,
          origin: {
            kind: 'attendance',
            route: { kind: 'section', section: 'Home' },
            groupId: 'group-2',
            trainingDate: '2026-08-15',
            rosterView: 'all',
            anchorClientId: 'client-7',
          },
          originEntryKey: 'client-profile:attendance-entry',
          returnDepth: 1,
        },
      }),
    ).toBeNull()
  })

  test.each([
    { version: 99 },
    {
      version: 1,
      origin: { kind: 'external', path: 'https://example.com' },
      originEntryKey: 'client-profile:x',
      returnDepth: 1,
    },
    {
      version: 1,
      origin: {
        kind: 'attendance',
        route: { kind: 'section', section: 'Home' },
        groupId: '',
        trainingDate: '2026-08-15',
        rosterView: 'all',
        anchorClientId: 'client-1',
      },
      originEntryKey: 'client-profile:x',
      returnDepth: 1,
    },
    {
      version: 1,
      origin: {
        kind: 'attendance',
        route: { kind: 'section', section: 'Home' },
        groupId: 'group-1',
        trainingDate: '15.08.2026',
        rosterView: 'all',
        anchorClientId: 'client-1',
      },
      originEntryKey: 'client-profile:x',
      returnDepth: 1,
    },
    {
      version: 1,
      origin: {
        kind: 'attendance',
        route: { kind: 'section', section: 'Home' },
        groupId: 'group-1',
        trainingDate: '2026-02-30',
        rosterView: 'all',
        anchorClientId: 'client-1',
      },
      originEntryKey: 'client-profile:x',
      returnDepth: 1,
    },
    {
      version: 1,
      origin: {
        kind: 'attendance',
        route: { kind: 'section', section: 'Home' },
        groupId: 'group-1',
        trainingDate: '2026-08-15',
        rosterView: 'unknown',
        anchorClientId: 'client-1',
      },
      originEntryKey: 'client-profile:x',
      returnDepth: 1,
    },
    {
      version: 1,
      origin: {
        kind: 'groupEdit',
        route: { kind: 'groupEdit', groupId: 'group-1' },
        anchorClientId: 'client-1',
      },
      originEntryKey: 'client-profile:x',
      returnDepth: 999,
    },
  ])('fails closed for malformed context %#', (payload) => {
    expect(
      readClientProfileReturnContext({
        crmClientProfileReturnContext: payload,
      }),
    ).toBeNull()
  })
})
