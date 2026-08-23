import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  applyScheduleLessonTrainerSubstitution,
  applyScheduleLessonTrainerSubstitutionCancellation,
  previewScheduleLessonTrainerSubstitution,
  previewScheduleLessonTrainerSubstitutionCancellation,
} from './schedule'

afterEach(() => vi.unstubAllGlobals())

describe('schedule API mutation contracts', () => {
  test('uses exact occurrence trainer substitution preview and execute endpoints', async () => {
    const previewResponse = {
      confirmationToken: 'substitution-token',
      expiresAt: '2026-08-23T10:15:00Z',
      targets: [],
      warnings: [],
    }
    const executeResponse = {
      lessons: [],
      warnings: [],
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(previewResponse), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify(executeResponse), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
    vi.stubGlobal('fetch', fetchMock)

    const payload = {
      replacedTrainerId: 'trainer-1',
      substituteTrainerId: 'trainer-2',
      targets: [{
        lessonOccurrenceId: 'occurrence-1',
        lessonDate: '2026-08-23',
        expectedRevision: 'lesson-revision-1',
      }],
    }

    await expect(previewScheduleLessonTrainerSubstitution(payload)).resolves.toEqual(previewResponse)
    await expect(applyScheduleLessonTrainerSubstitution({
      ...payload,
      confirmationToken: 'substitution-token',
    })).resolves.toEqual(executeResponse)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/schedule/lesson-trainer-substitutions/preview',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/schedule/lesson-trainer-substitutions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          confirmationToken: 'substitution-token',
        }),
      }),
    )
  })

  test('uses exact occurrence trainer substitution cancellation preview and execute endpoints', async () => {
    const previewResponse = {
      confirmationToken: 'substitution-cancel-token',
      expiresAt: '2026-08-23T10:15:00Z',
      targets: [],
      warnings: [],
    }
    const executeResponse = {
      lessons: [],
      warnings: [],
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(previewResponse), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify(executeResponse), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
    vi.stubGlobal('fetch', fetchMock)

    const payload = {
      targets: [{
        lessonOccurrenceId: 'occurrence-1',
        lessonDate: '2026-08-23',
        substitutionId: 'substitution-1',
        expectedRevision: 'lesson-revision-1',
      }],
      reason: null,
    }

    await expect(previewScheduleLessonTrainerSubstitutionCancellation(payload))
      .resolves.toEqual(previewResponse)
    await expect(applyScheduleLessonTrainerSubstitutionCancellation({
      ...payload,
      confirmationToken: 'substitution-cancel-token',
    })).resolves.toEqual(executeResponse)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/schedule/lesson-trainer-substitutions/cancellations/preview',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/schedule/lesson-trainer-substitutions/cancellations',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          confirmationToken: 'substitution-cancel-token',
        }),
      }),
    )
  })
})
