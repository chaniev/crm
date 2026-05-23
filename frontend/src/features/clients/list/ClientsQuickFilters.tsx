import { Badge, Button } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import {
  IconClockHour4,
  IconTicket,
  IconUserMinus,
  IconUsersMinus,
} from '@tabler/icons-react'
import { resources } from '../../../lib/resources'
import type { ClientsListState } from './useClientsListState'

type ClientsQuickFiltersProps = {
  canSeeWithoutGroup: boolean
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

export function ClientsQuickFilters({
  canSeeWithoutGroup,
  state,
}: ClientsQuickFiltersProps) {
  const isCompactFilters = useMediaQuery('(max-width: 62rem)')

  if (!isCompactFilters) {
    return null
  }

  return (
    <div className="clients-v7-quick-filters">
      {quickFilters.filter((filter) => (
        filter.key !== 'withoutGroup' || canSeeWithoutGroup
      )).map((filter) => {
        const Icon = filter.icon
        const pressed = state.filters[filter.key]
        const count = state.quickFilterCounts?.[filter.key] ?? null

        return (
          <Button
            aria-pressed={pressed}
            className="clients-v7-quick-filter-card"
            data-active={pressed || undefined}
            key={filter.key}
            onClick={() => {
              state.updateFilters({
                [filter.key]: !pressed,
              })
            }}
            type="button"
            variant="default"
          >
            <Icon size={22} />
            <span>{filter.label}</span>
            {
              typeof count === 'number' ? (
                <Badge
                  className="clients-v7-quick-filter-card__count"
                  color="gray"
                  size="sm"
                  variant="light"
                >
                  {count}
                </Badge>
              ) : null
            }
          </Button>
        )
      })}
    </div>
  )
}
