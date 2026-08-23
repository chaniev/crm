import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { renderWithProviders } from '../../test/render'
import { AttendanceClientRow } from './AttendanceClientRow'
import type { AttendanceClientRowState } from './types'

function buildRow(saveState: AttendanceClientRowState['saveState']): AttendanceClientRowState {
  return {
    client: {
      id: 'client-1',
      fullName: 'Иван Иванов',
      state: 'Unmarked',
      groups: [],
      photo: null,
      isProfessional: false,
      professionalComment: null,
      hasActiveMembership: true,
      membershipWarning: false,
      currentMemberships: [],
    },
    displayedState: 'Unmarked',
    persistedState: 'Unmarked',
    saveState,
    attemptedState: saveState === 'failed' ? 'Present' : null,
    errorMessage: saveState === 'failed' ? 'Не удалось сохранить' : null,
  }
}

describe('AttendanceClientRow profile action', () => {
  test('keeps attendance controls first and opens the exact client once', () => {
    const onOpenClient = vi.fn()
    renderWithProviders(
      <AttendanceClientRow
        onChange={vi.fn()}
        onOpenClient={onOpenClient}
        onRetry={vi.fn()}
        row={buildRow('idle')}
      />,
    )

    const card = screen.getByTestId('attendance-client-card-client-1')
    const action = within(card).getByRole('button', {
      name: 'Открыть карточку клиента Иван Иванов',
    })
    const interactive = Array.from(
      card.querySelectorAll<HTMLElement>('button, input, [role="button"], [role="radio"]'),
    )

    expect(interactive.indexOf(within(card).getByRole('radio', { name: 'Не отмечено' })))
      .toBeLessThan(interactive.indexOf(action))
    expect(within(card).getAllByRole('button', { name: /Открыть карточку клиента/ }))
      .toHaveLength(1)
    expect(card).not.toHaveAttribute('role', 'button')

    fireEvent.click(action)
    expect(onOpenClient).toHaveBeenCalledOnce()
    expect(onOpenClient).toHaveBeenCalledWith('client-1')
  })

  test('blocks pending navigation with an accessible reason', () => {
    const onOpenClient = vi.fn()
    renderWithProviders(
      <AttendanceClientRow
        onChange={vi.fn()}
        onOpenClient={onOpenClient}
        onRetry={vi.fn()}
        row={buildRow('pending')}
      />,
    )

    const action = screen.getByRole('button', {
      name: 'Открыть карточку клиента Иван Иванов',
    })
    const reasonId = action.getAttribute('aria-describedby')

    expect(reasonId).toBeTruthy()
    expect(document.getElementById(reasonId!)).toHaveTextContent(
      'Сначала дождитесь сохранения посещения',
    )
    fireEvent.click(action)
    expect(onOpenClient).not.toHaveBeenCalled()
  })

  test('allows opening after a failed save and keeps retry after the action', () => {
    const onOpenClient = vi.fn()
    renderWithProviders(
      <AttendanceClientRow
        onChange={vi.fn()}
        onOpenClient={onOpenClient}
        onRetry={vi.fn()}
        row={buildRow('failed')}
      />,
    )

    const action = screen.getByRole('button', {
      name: 'Открыть карточку клиента Иван Иванов',
    })
    const retry = screen.getByRole('button', { name: /Повторить/ })
    const buttons = Array.from(
      document.querySelectorAll<HTMLElement>('button'),
    )

    expect(buttons.indexOf(action)).toBeLessThan(buttons.indexOf(retry))
    fireEvent.click(action)
    expect(onOpenClient).toHaveBeenCalledWith('client-1')
  })
})
