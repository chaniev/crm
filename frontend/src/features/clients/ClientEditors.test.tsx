import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { renderWithProviders } from '../../test/render'
import { ClientDetailScreen } from './ClientDetailScreen'

beforeAll(() => {
  Object.defineProperty(document, 'fonts', { configurable: true, value: new EventTarget() })
})

afterEach(() => {
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

test('keeps the profile draft while saving assignments from the next directory page and after a profile error', async () => {
  let client = { id: 'c', groupIds: ['g1'], branchId: 'b', lastName: 'Иванов', phone: '123', telegramContactUsername: '@contact' }
  const profileWrites: unknown[] = []
  const groups = ['Начальная', 'Старшая'].map((name, index) => ({
    id: 'g' + (index + 1), name, branchId: 'b', branchName: 'Клуб', hallName: 'Зал',
    isActive: true, trainingStartTime: '18:00', weekdays: [1], durationMinutes: 60, trainers: [], trainerIds: [],
  }))
  const pages: number[] = []
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    if (url.startsWith('/api/groups?')) {
      const skip = Number(new URL(url, location.origin).searchParams.get('skip'))
      pages.push(skip)
      return Response.json({ items: groups.slice(skip, skip + 1), totalCount: 2, take: 1, skip })
    }
    if (url === '/api/clients/c/groups') {
      const payload = JSON.parse(String(init.body))
      expect(payload).toEqual({ groupIds: ['g1', 'g2'] })
      client = { ...client, ...payload }
    } else if (url === '/api/clients/c/profile') {
      const payload = JSON.parse(String(init.body))
      profileWrites.push(payload)
      if (profileWrites.length === 1) return Response.json({ title: 'Ошибка сохранения' }, { status: 503 })
      client = { ...client, ...payload }
    } else if (url !== '/api/clients/c') {
      throw new Error('Unexpected URL ' + url)
    }
    return Response.json(client)
  })

  renderWithProviders(<ClientDetailScreen clientId="c" canManage onBack={vi.fn()} />)
  fireEvent.change(await screen.findByLabelText('Телефон', { exact: true }), { target: { value: '456' } })
  fireEvent.change(screen.getByLabelText('Telegram'), { target: { value: '' } })
  expect(pages).toEqual([])
  fireEvent.click(screen.getByRole('tab', { name: 'Группы' }))
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Старшая' }))
  expect(pages).toEqual([0, 1])
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить группы' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Сохранить группы' })).toBeDisabled())

  fireEvent.click(screen.getByRole('tab', { name: 'Основная информация' }))
  expect(screen.getByLabelText('Телефон', { exact: true })).toHaveValue('456')
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить изменения' }))
  await screen.findByRole('alert')
  expect(screen.getByLabelText('Телефон', { exact: true })).toHaveValue('456')
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить изменения' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Сохранить изменения' })).toBeDisabled())
  expect(profileWrites).toHaveLength(2)
  expect(profileWrites[1]).toEqual(profileWrites[0])
  expect(profileWrites[1]).toMatchObject({ phone: '456', telegramContactUsername: null })
  expect(profileWrites[1]).not.toHaveProperty('groupIds')
  expect(client.groupIds).toEqual(['g1', 'g2'])
})
