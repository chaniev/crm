import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { renderWithProviders } from '../../test/render'
import { GroupClientRow } from './GroupClientRow'

describe('GroupClientRow', () => {
  test('shows read-only client data and exposes one exact profile action', () => {
    const onOpenClient = vi.fn()
    renderWithProviders(
      <GroupClientRow
        client={{
          id: 'client-9',
          fullName: 'Александра Константинопольская-Северная',
          phone: '+7 999 123-45-67',
          status: 'Active',
        }}
        onOpenClient={onOpenClient}
      />,
    )

    expect(screen.getByText('Александра Константинопольская-Северная')).toBeVisible()
    expect(screen.getByText('Телефон: +7 999 123-45-67')).toBeVisible()
    expect(screen.getByText('Active')).toBeVisible()

    const action = screen.getByRole('button', {
      name: 'Открыть карточку клиента Александра Константинопольская-Северная',
    })
    expect(screen.getAllByRole('button', { name: /Открыть карточку клиента/ }))
      .toHaveLength(1)

    fireEvent.click(action)
    expect(onOpenClient).toHaveBeenCalledOnce()
    expect(onOpenClient).toHaveBeenCalledWith('client-9')
    expect(screen.getByTestId('group-client-row-client-9')).not.toHaveAttribute('role', 'button')
  })
})
