import { afterEach, describe, expect, test, vi } from 'vitest'
import { ApiError } from './errors'
import {
  cancelGroupTrainerSubstitution,
  createGroupTrainerSubstitution,
  getGroupTrainerSubstitutions,
  updateGroupTrainerSubstitution,
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

  test('writes exact ISO payloads through shared CSRF transport', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ...substitutionPayload,
        id: 'created-substitution',
      }), { status: 201, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ...substitutionPayload,
        id: 'updated-substitution',
        endsOn: '2026-08-07',
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ...substitutionPayload,
        id: 'cancelled-substitution',
        status: 'Cancelled',
        allowedActions: { canEdit: false, canCancel: false },
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await createGroupTrainerSubstitution('group-1', {
      substituteTrainerId: 'trainer-2',
      startsOn: '2026-08-01',
      endsOn: '2026-08-05',
    })
    await updateGroupTrainerSubstitution('group-1', 'substitution-1', {
      substituteTrainerId: 'trainer-2',
      startsOn: '2026-08-01',
      endsOn: '2026-08-07',
    })
    await cancelGroupTrainerSubstitution('group-1', 'substitution-1')

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/groups/group-1/trainer-substitutions',
      expect.objectContaining({
        body: JSON.stringify({
          substituteTrainerId: 'trainer-2',
          startsOn: '2026-08-01',
          endsOn: '2026-08-05',
        }),
        credentials: 'include',
        method: 'POST',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/groups/group-1/trainer-substitutions/substitution-1',
      expect.objectContaining({
        body: JSON.stringify({
          substituteTrainerId: 'trainer-2',
          startsOn: '2026-08-01',
          endsOn: '2026-08-07',
        }),
        credentials: 'include',
        method: 'PUT',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/groups/group-1/trainer-substitutions/substitution-1/cancel',
      expect.objectContaining({
        credentials: 'include',
        method: 'POST',
      }),
    )
  })

  test('preserves backend ProblemDetails field errors for date conflicts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      type: '/problems/group-trainer-substitution-overlap',
      title: 'Conflict',
      detail: 'Период пересекается с существующим замещением.',
      code: 'group_trainer_substitution_overlap',
      errors: {
        startsOn: ['Период пересекается с существующим замещением.'],
        endsOn: ['Период пересекается с существующим замещением.'],
      },
    }), {
      status: 409,
      headers: { 'content-type': 'application/problem+json; charset=utf-8' },
    })))

    await expect(createGroupTrainerSubstitution('group-1', {
      substituteTrainerId: 'trainer-2',
      startsOn: '2026-08-01',
      endsOn: '2026-08-05',
    })).rejects.toMatchObject<ApiError>({
      status: 409,
      code: 'group_trainer_substitution_overlap',
      fieldErrors: {
        startsOn: ['Период пересекается с существующим замещением.'],
        endsOn: ['Период пересекается с существующим замещением.'],
      },
    })
  })
})
