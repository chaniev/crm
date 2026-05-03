import { Button, Group } from '@mantine/core'
import {
  IconClockHour4,
  IconTicket,
  IconUserMinus,
  IconUsersMinus,
} from '@tabler/icons-react'
import { resources } from '../../../lib/resources'
import type { ClientsListState } from './useClientsListState'

type ClientsQuickFiltersProps = {
  state: ClientsListState
}

const quickFilters = [
  {
    key: 'withoutMembership',
    label: resources.clients.list.quickFilters.withoutMembership,
    icon: IconUserMinus,
  },
  {
    key: 'expiringSoon',
    label: resources.clients.list.quickFilters.expiringSoon,
    icon: IconClockHour4,
  },
  {
    key: 'withoutGroup',
    label: resources.clients.list.quickFilters.withoutGroup,
    icon: IconUsersMinus,
  },
  {
    key: 'trial',
    label: resources.clients.list.quickFilters.trial,
    icon: IconTicket,
  },
] as const

export function ClientsQuickFilters({ state }: ClientsQuickFiltersProps) {
  return (
    <Group className="clients-v7-quick-filters" gap="xs" wrap="nowrap">
      {quickFilters.map((filter) => {
        const Icon = filter.icon
        const pressed = state.filters[filter.key]

        return (
          <Button
            aria-pressed={pressed}
            key={filter.key}
            leftSection={<Icon size={16} />}
            onClick={() => {
              state.updateFilters({
                [filter.key]: !pressed,
                ...(filter.key === 'expiringSoon' && !pressed
                  ? { status: 'Active' }
                  : {}),
              })
            }}
            size="sm"
            variant={pressed ? 'filled' : 'light'}
          >
            {filter.label}
          </Button>
        )
      })}
    </Group>
  )
}
