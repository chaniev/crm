import { afterEach, expect, test, vi } from 'vitest'
import { importClients } from './clientImport'
import { request } from './transport'

const operationId = '20000000-0000-4000-8000-000000000001'
const input = { operationId, branchId: '20000000-0000-4000-8000-000000000002', groupName: 'Group', file: new File(['xlsx'], 'source.xlsx') }
afterEach(() => vi.unstubAllGlobals())

test('multipart uses cookies and CSRF with one request and no JSON content type', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ operationId, createdCount: 48 }), { headers: { 'content-type': 'application/json' } }))
  vi.stubGlobal('fetch', fetch)
  expect(await importClients(input)).toEqual({ operationId, createdCount: 48 })
  expect(fetch).toHaveBeenCalledTimes(1)
  const options = fetch.mock.calls[0][1] as RequestInit
  expect(options.body).toBeInstanceOf(FormData)
  expect((options.body as FormData).get('file')).toBe(input.file)
  expect((options.body as FormData).get('groupName')).toBe('Group')
  expect(options.credentials).toBe('include')
  expect(new Headers(options.headers).has('Content-Type')).toBe(false)
})

test.each([{}, { operationId: 'other', createdCount: 1 }, { operationId, createdCount: 0 }, { operationId, createdCount: 1.5 }, { operationId, createdCount: 1001 }])('malformed success remains unknown: %j', async payload => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json' } })))
  await expect(importClients(input)).rejects.toThrow()
})

test('non JSON success is not confirmed', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('proxy')))
  await expect(importClients(input)).rejects.toThrow()
})

test('error extensions preserve complete issues and operation ID', async () => {
  const issues = [{ row: 7, field: 'phone', code: 'invalid_value', message: 'Correct phone' }]
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ title: 'Invalid file', code: 'file_invalid', operationId, issues }), { status: 400, headers: { 'content-type': 'application/problem+json' } })))
  await expect(request('/clients/import-xlsx')).rejects.toMatchObject({ operationId, issues, status: 400, code: 'file_invalid' })
})
