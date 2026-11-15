import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '../../test/render'
import { getBranches, importClients, type AuthenticatedUser } from '../../lib/api'
import { SettingsScreen } from './SettingsScreen'
import type { NavigationGuard } from './useClientImport'

vi.mock('../../lib/api', async original => ({ ...(await original<typeof import('../../lib/api')>()), getBranches: vi.fn(), importClients: vi.fn() }))
vi.mock('./MembershipCatalogSettings', () => ({ MembershipCatalogSettings: () => <div>Catalog</div> }))
const branchId = '20000000-0000-4000-8000-000000000002'
const user: AuthenticatedUser = {
  id: 'user', fullName: 'User', login: 'user', role: 'HeadCoach', isActive: true, mustChangePassword: false,
  landingScreen: 'Settings', allowedSections: ['Settings'], branchId: null, assignedGroupIds: [], attendanceScope: { kind: 'Global', groupIds: [] },
  permissions: { canManageUsers: false, canManageClients: true, canManageGroups: false, canManageSettings: true, canMarkAttendance: false, canViewAuditLog: true, canViewFinancialReports: false },
  clientImportScope: { kind: 'OwnBranch', branchId },
}
beforeEach(() => {
  vi.mocked(importClients).mockReset()
  vi.mocked(getBranches).mockResolvedValue([{ id: branchId, name: 'Own branch', isArchived: false } as Awaited<ReturnType<typeof getBranches>>[number]])
})

async function prepare() {
  fireEvent.click(screen.getByRole('tab', { name: 'Импорт' }))
  await screen.findByText('Own branch')
  fireEvent.change(screen.getByLabelText('Название группы'), { target: { value: 'Group' } })
  const file = document.querySelector('input[type=file]')!
  fireEvent.change(file, { target: { files: [new File(['xlsx'], 'test.xlsx')] } })
}

test('tab follows backend scope, not canManageClients or role name', () => {
  const view = renderWithProviders(<SettingsScreen user={{ ...user, clientImportScope: { kind: 'None', branchId: null } }} />)
  expect(screen.queryByRole('tab', { name: 'Импорт' })).not.toBeInTheDocument()
  view.rerender(<SettingsScreen user={user} />)
  expect(screen.getByRole('tab', { name: 'Импорт' })).toBeInTheDocument()
})

test('double submit and tab remount send once and preserve late success', async () => {
  let resolve!: (value: Awaited<ReturnType<typeof importClients>>) => void
  vi.mocked(importClients).mockImplementation(() => new Promise(done => { resolve = done }))
  renderWithProviders(<SettingsScreen user={user} />)
  await prepare()
  fireEvent.click(screen.getByRole('button', { name: 'Импортировать' }))
  fireEvent.click(screen.getByRole('button', { name: 'Импортировать' }))
  expect(importClients).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('tab', { name: /Абонементы/ }))
  await act(async () => resolve({ operationId: vi.mocked(importClients).mock.calls[0][0].operationId, createdCount: 48 }))
  fireEvent.click(screen.getByRole('tab', { name: 'Импорт' }))
  expect(await screen.findByText('Создано 48 клиентов')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Новый импорт' }))
  expect(screen.getByRole('button', { name: 'Импортировать' })).toBeDisabled()
  expect(importClients).toHaveBeenCalledTimes(1)
})

test('network failure has unknown outcome and no replay control', async () => {
  vi.mocked(importClients).mockRejectedValue(new TypeError('network'))
  renderWithProviders(<SettingsScreen user={user} />)
  await prepare()
  fireEvent.click(screen.getByRole('button', { name: 'Импортировать' }))
  expect(await screen.findByText('Результат импорта не подтверждён')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Новый импорт' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Импортировать' })).toBeDisabled()
  await waitFor(() => expect(importClients).toHaveBeenCalledTimes(1))
})

test('pending guard waits for explicit leave and revoked scope keeps recovery number', async () => {
  vi.mocked(importClients).mockImplementation(() => new Promise(() => {}))
  let guard: NavigationGuard | null = null
  const register = (value: NavigationGuard | null) => { guard = value }
  const view = renderWithProviders(<SettingsScreen user={user} onNavigationGuardChange={register} />)
  await prepare()
  fireEvent.click(screen.getByRole('button', { name: 'Импортировать' }))
  const operation = vi.mocked(importClients).mock.calls[0][0].operationId
  const leave = vi.fn()
  act(() => guard?.(leave))
  expect(leave).not.toHaveBeenCalled()
  fireEvent.click(await screen.findByRole('button', { name: 'Остаться' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(leave).not.toHaveBeenCalled()
  view.rerender(<SettingsScreen user={{ ...user, clientImportScope: { kind: 'None', branchId: null } }} onNavigationGuardChange={register} />)
  expect(screen.queryByRole('tab', { name: 'Импорт' })).not.toBeInTheDocument()
  expect(screen.getByText(operation)).toBeInTheDocument()
  act(() => guard?.(leave))
  fireEvent.click(await screen.findByRole('button', { name: 'Уйти со страницы' }))
  expect(leave).toHaveBeenCalledOnce()
  expect(importClients).toHaveBeenCalledOnce()
})
