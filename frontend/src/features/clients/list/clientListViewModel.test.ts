import { describe, expect, test } from 'vitest'
import type { ClientListItem } from '../../../lib/api'
import { buildClientCompactViewModel } from './clientListViewModel'

function buildClientItem(overrides: Partial<ClientListItem> = {}): ClientListItem {
  return {
    id: 'client-1',
    fullName: 'Александр Петров',
    lastName: 'Александр',
    firstName: 'Петров',
    middleName: '',
    phone: '+7 999 111-22-33',
    branchId: 'branch-1',
    branchName: 'Центральный',
    status: 'Active',
    contactCount: 0,
    groupCount: 1,
    groups: [
      {
        id: 'group-1',
        name: 'Старт',
        branchId: 'branch-1',
        branchName: 'Центральный',
        isActive: true,
      },
    ],
    photo: null,
    professionalComment: null,
    isProfessional: false,
    hasActiveMembership: false,
    hasCurrentMembership: false,
    membershipWarning: false,
    lastVisitDate: null,
    membershipState: 'None',
    currentMembership: null,
    currentMembershipSummary: null,
    actionHints: [],
    ...overrides,
  }
}

describe('buildClientCompactViewModel', () => {
  test('prefers archive pill for archived clients', () => {
    const viewModel = buildClientCompactViewModel(
      buildClientItem({ status: 'Archived' }),
      { showBranchIdentity: false, canSeePhone: true },
    ) as { nextAction: { label: string } }

    expect(viewModel.nextAction.label).toBe('В архиве')
  })

  test('uses first backend action hint for non-archived client', () => {
    const viewModel = buildClientCompactViewModel(
      buildClientItem({
        actionHints: [
          {
            title: 'Без абонемента',
            tone: 'yellow',
            description: 'Ожидает закупки',
            iconKey: 'membership',
            daysUntilExpiration: null,
          },
          {
            title: 'Без группы',
            tone: 'red',
            description: 'Нужна группа',
            iconKey: 'group',
            daysUntilExpiration: null,
          },
        ],
      }),
      { showBranchIdentity: false, canSeePhone: true },
    ) as { nextAction: { label: string } }

    expect(viewModel.nextAction.label).toBe('Без абонемента')
  })

  test('falls back to Active pill when no backend hints exist', () => {
    const viewModel = buildClientCompactViewModel(
      buildClientItem({ status: 'Active' }),
      { showBranchIdentity: false, canSeePhone: true },
    ) as { nextAction: { label: string } }

    expect(viewModel.nextAction.label).toBe('Активен')
  })

  test('does not map an expired membership hint to Без абонемента', () => {
    const viewModel = buildClientCompactViewModel(
      buildClientItem({
        actionHints: [
          {
            title: 'Продлить абонемент',
            tone: 'orange',
            description: 'Абонемент просрочен',
            iconKey: 'membership',
            daysUntilExpiration: -2,
          },
        ],
      }),
      { showBranchIdentity: false, canSeePhone: true },
    )

    expect(viewModel.nextAction.label).toBe('Продлить абонемент')
  })

  test('adds branch identity to accessible name only for global branch visibility', () => {
    const withBranch = buildClientCompactViewModel(
      buildClientItem({ branchId: 'branch-1', branchName: 'Центральный' }),
      { showBranchIdentity: true, canSeePhone: true },
    ) as { accessibleName: string }
    const withoutBranch = buildClientCompactViewModel(
      buildClientItem({ branchId: 'branch-1', branchName: 'Центральный' }),
      { showBranchIdentity: false, canSeePhone: true },
    ) as { accessibleName: string }

    expect(withBranch.accessibleName).toContain('Центральный')
    expect(withoutBranch.accessibleName).not.toContain('Центральный')
  })
})
