import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import type { ClientDetails } from '../../../lib/api'
import { renderWithProviders } from '../../../test/render'
import { ClientPreviewPanel } from './ClientPreviewPanel'
import type { ClientsListState } from './useClientsListState'

describe('ClientPreviewPanel', () => {
  test('renders retry and full-card recovery in the preview error state', () => {
    const onOpen = vi.fn()
    const reloadPreview = vi.fn()

    renderWithProviders(
      <ClientPreviewPanel
        canManage
        onCollapse={vi.fn()}
        onOpen={onOpen}
        state={createState({
          previewError: 'Сеть недоступна',
          reloadPreview,
          selectedClientId: 'client-1',
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    fireEvent.click(screen.getByRole('button', { name: 'Открыть карточку' }))

    expect(reloadPreview).toHaveBeenCalledTimes(1)
    expect(onOpen).toHaveBeenCalledWith('client-1')
  })

  test('keeps collapse and full-card actions keyboard reachable for loaded preview', () => {
    const onCollapse = vi.fn()
    const onOpen = vi.fn()

    renderWithProviders(
      <ClientPreviewPanel
        canManage
        onCollapse={onCollapse}
        onOpen={onOpen}
        state={createState({
          selectedClientId: 'client-1',
          selectedPreview: buildClientDetails(),
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Свернуть preview' }))
    fireEvent.click(screen.getByRole('button', { name: 'Открыть карточку' }))

    expect(onCollapse).toHaveBeenCalledTimes(1)
    expect(onOpen).toHaveBeenCalledWith('client-1')
  })
})

function createState({
  previewError = null,
  reloadPreview = vi.fn(),
  selectedClientId = null,
  selectedPreview = null,
}: {
  previewError?: string | null
  reloadPreview?: () => void
  selectedClientId?: string | null
  selectedPreview?: ClientDetails | null
}) {
  return {
    selectedClientId,
    selectedPreview,
    previewLoading: false,
    previewError,
    reloadPreview,
  } as unknown as ClientsListState
}

function buildClientDetails(): ClientDetails {
  return {
    id: 'client-1',
    fullName: 'Александра Константинопольская-Северная',
    lastName: 'Константинопольская-Северная',
    firstName: 'Александра',
    middleName: '',
    phone: '+7 999 111-22-33',
    branchId: 'branch-1',
    branchName: 'Центральный',
    status: 'Active',
    contactCount: 0,
    groupCount: 0,
    groups: [],
    photo: null,
    professionalComment: null,
    isProfessional: false,
    hasActiveMembership: false,
    hasCurrentMembership: false,
    membershipWarning: false,
    lastVisitDate: null,
    membershipState: 'None',
    currentMemberships: [],    birthDate: null,
    businessDate: '2026-01-01',
    contacts: [],
    groupIds: [],
    notes: '',
    notesLastChangedByName: null,
    notesLastChangedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    membershipHistory: [],
    attendanceHistory: [],
    attendanceHistoryLoaded: true,
    attendanceHistoryTotalCount: 0,
    actionHints: [],
  }
}
