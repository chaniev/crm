import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  getGroupTrainerSubstitutions,
} from './groupTrainerSubstitutions'

afterEach(() => vi.unstubAllGlobals())

const substitutionPayload = {
  id: 'substitution-1',
  groupId: 'group-1',
  substituteTrainer: {
    id: 'trainer-2',
    fullName: 'Ирина Замена',
    login: 'irina',
    isActive: true,
  },
  startsOn: '2026-08-01',
  endsOn: '2026-08-05',
  status: 'Upcoming',
  cancelledAt: null,
  createdAt: '2026-07-25T08:00:00Z',
  updatedAt: '2026-07-25T08:00:00Z',
  allowedActions: {
    canEdit: true,
    canCancel: true,
  },
} as const

describe('group trainer substitutions API', () => {
  test('loads backend ordered current and paginated history without remapping statuses or actions', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      current: [substitutionPayload],
      history: {
        items: [{ ...substitutionPayload, id: 'substitution-old', status: 'Cancelled' }],
        totalCount: 12,
        skip: 5,
        take: 10,
      },
      canCreate: false,
      createUnavailableReason: {
        code: 'group_inactive',
        message: 'Группа неактивна.',
      },
      csrfToken: 'csrf-from-bootstrap',
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getGroupTrainerSubstitutions('group-1', {
      historySkip: 5,
      historyTake: 10,
    })).resolves.toEqual({
      current: [substitutionPayload],
      history: {
        items: [{ ...substitutionPayload, id: 'substitution-old', status: 'Cancelled' }],
        totalCount: 12,
        skip: 5,
        take: 10,
      },
      canCreate: false,
      createUnavailableReason: {
        code: 'group_inactive',
        message: 'Группа неактивна.',
      },
    })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/groups/group-1/trainer-substitutions?historySkip=5&historyTake=10',
      expect.objectContaining({
        credentials: 'include',
        method: 'GET',
      }),
    )
  })

  test('keeps the legacy trainer substitution client read-only', async () => {
    const apiModule = await import('./groupTrainerSubstitutions')

    expect(apiModule).not.toHaveProperty('createGroupTrainerSubstitution')
    expect(apiModule).not.toHaveProperty('updateGroupTrainerSubstitution')
    expect(apiModule).not.toHaveProperty('cancelGroupTrainerSubstitution')
  })
})
