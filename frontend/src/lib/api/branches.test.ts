import { afterEach, expect, test, vi } from 'vitest'
import { createBranch, createHall, getBranches, getHalls } from './branches'

afterEach(() => vi.unstubAllGlobals())

test('preserves branch/hall create payloads and successful DTOs', async () => {
  const fetch = vi.fn()
    .mockResolvedValueOnce(response({ id: 'branch', name: 'Центр', isArchived: false, address: 'Адрес', hallCount: 2, groupCount: 3, clientCount: 4 }, 201))
    .mockResolvedValueOnce(response({ id: 'hall', branchId: 'branch', branchName: 'Центр', name: 'Зал', isArchived: false, groupCount: 1 }, 201))
  vi.stubGlobal('fetch', fetch)
  expect(await createBranch({ name: 'Центр', address: 'Адрес', description: null })).toMatchObject({ id: 'branch', hallCount: 2, clientCount: 4 })
  expect(await createHall({ branchId: 'branch', name: 'Зал', description: null })).toMatchObject({ id: 'hall', branchId: 'branch', branchName: 'Центр', groupCount: 1 })
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ branchId: 'branch', name: 'Зал', description: null })
})

test.each([createBranch, createHall])('preserves field errors and scope ProblemDetails for create', async (create) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({ title: 'Проверьте поля', errors: { branchId: ['Филиал архивирован'] } }, 400))
    .mockResolvedValueOnce(response({ title: 'Branch scope is forbidden.', type: '/problems/branch-scope-forbidden', code: 'branch_scope_forbidden' }, 403)))
  const payload = { name: 'Зал', branchId: 'branch', description: null, address: null }
  await expect(create(payload)).rejects.toMatchObject({ status: 400, fieldErrors: { branchId: ['Филиал архивирован'] } })
  await expect(create(payload)).rejects.toMatchObject({ status: 403, code: 'branch_scope_forbidden' })
})

test('keeps shared dictionary filters and counts', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(response([{ id: 'foreign', name: 'Север', isArchived: true, hallCount: 3 }]))
    .mockResolvedValueOnce(response([{ id: 'hall', branchId: 'foreign', branchName: 'Север', name: 'Зал', isArchived: true }]))
  vi.stubGlobal('fetch', fetch)
  expect(await getBranches({ includeArchived: true })).toEqual([expect.objectContaining({ id: 'foreign', isArchived: true, hallCount: 3 })])
  expect(await getHalls({ branchId: 'foreign', includeArchived: true })).toEqual([expect.objectContaining({ id: 'hall', branchId: 'foreign' })])
  expect(fetch.mock.calls[0][0]).toMatch(/branches\?includeArchived=true$/)
  expect(fetch.mock.calls[1][0]).toMatch(/halls\?branchId=foreign&includeArchived=true$/)
})

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' } })
}
