import { useState, type FormEvent } from 'react'
import {
  Badge,
  Drawer,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  TextInput,
} from '@mantine/core'
import {
  IconAdjustmentsHorizontal,
  IconSearch,
} from '@tabler/icons-react'
import { useMediaQuery } from '@mantine/hooks'
import { resources } from '../../../lib/resources'
import { Button, IconButton } from '../../shared/ux'
import {
  clientListPageSizeOptions,
  clientPaymentStatusFilterOptions,
  type ClientPaymentStatusFilter,
  type ClientStatusFilter,
} from './clientListFilters'
import type { ClientsListState } from './useClientsListState'

type ClientsToolbarProps = {
  canManage: boolean
  canSeeWithoutGroup: boolean
  state: ClientsListState
}

const statusOptions = [
  { value: 'Active', label: resources.clients.list.statusFilters.Active },
  { value: 'Archived', label: resources.clients.list.statusFilters.Archived },
] satisfies Array<{ value: ClientStatusFilter; label: string }>

type QuickFilterKey =
  | 'withoutMembership'
  | 'expiringSoon'
  | 'withoutGroup'
  | 'trial'

type InlineQuickFilter = {
  key: QuickFilterKey
  label: string
  tone: 'red' | 'orange' | 'blue'
}

const desktopQuickFilters = [
  {
    key: 'withoutMembership',
    label: resources.clients.list.quickFilters.withoutMembership,
    tone: 'red',
  },
  {
    key: 'expiringSoon',
    label: resources.clients.list.quickFilters.expiringSoon,
    tone: 'orange',
  },
  {
    key: 'withoutGroup',
    label: resources.clients.list.quickFilters.withoutGroup,
    tone: 'blue',
  },
] satisfies InlineQuickFilter[]

export function ClientsToolbar({
  canManage,
  canSeeWithoutGroup,
  state,
}: ClientsToolbarProps) {
  const [moreFiltersOpened, setMoreFiltersOpened] = useState(false)
  const isCompactFilters = useMediaQuery('(max-width: 62rem)')

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    state.applySearchNow()
  }

  function updateStatus(status: ClientStatusFilter) {
    state.setStatus(status)
  }

  function toggleQuickFilter(key: QuickFilterKey) {
    state.updateFilters({
      [key]: !state.filters[key],
    })
  }

  function getQuickFilterCount(key: QuickFilterKey) {
    return state.quickFilterCounts?.[key] ?? null
  }

  function renderStatusButtons(className: string) {
    return (
      <Group className={className} gap="xs" wrap="nowrap">
        {statusOptions.map((option) => {
          const active = state.filters.status === option.value

          return (
            <Button
              aria-pressed={active}
              className="clients-v7-filter-chip clients-v7-status-chip"
              data-active={active || undefined}
              key={option.value}
              onClick={() => updateStatus(option.value)}
              type="button"
              variant={active ? 'filled' : 'secondary'}
            >
              {option.label}
            </Button>
          )
        })}
      </Group>
    )
  }

  function renderQuickCount(key: QuickFilterKey, tone: InlineQuickFilter['tone']) {
    const count = getQuickFilterCount(key)

    if (typeof count !== 'number') {
      return null
    }

    return (
      <Badge
        className={`clients-v7-filter-count clients-v7-filter-count--${tone}`}
        size="sm"
        variant="filled"
      >
        {count}
      </Badge>
    )
  }

  function renderQuickFilterChip(filter: InlineQuickFilter) {
    const pressed = state.filters[filter.key]

    return (
      <Button
        aria-pressed={pressed}
        className="clients-v7-filter-chip clients-v7-quick-chip"
        data-active={pressed || undefined}
        key={filter.key}
        onClick={() => toggleQuickFilter(filter.key)}
        rightSection={renderQuickCount(filter.key, filter.tone)}
        type="button"
        variant={pressed ? 'filled' : 'secondary'}
      >
        {filter.label}
      </Button>
    )
  }

  const visibleDesktopQuickFilters = desktopQuickFilters.filter(
    (filter) => filter.key !== 'withoutGroup' || canSeeWithoutGroup,
  )
  const mobileMembershipPressed = state.filters.withoutMembership

  return (
    <>
      <form onSubmit={submitSearch}>
        <div className="filter-toolbar clients-v7-filter-panel">
          <TextInput
            aria-label={canManage ? 'Поиск по имени или телефону' : 'Поиск по имени'}
            className="clients-v7-filter-search"
            leftSection={<IconSearch size={18} />}
            onChange={(event) => state.setSearchDraft(event.currentTarget.value)}
            placeholder={canManage ? 'Поиск по имени или телефону' : 'Поиск по имени'}
            value={state.searchDraft}
          />

          {isCompactFilters ? (
            <div className="clients-v7-filter-mobile-row">
              {renderStatusButtons('clients-v7-filter-status')}
              <Button
                aria-pressed={mobileMembershipPressed}
                className="clients-v7-filter-chip clients-v7-mobile-membership-chip"
                data-active={mobileMembershipPressed || undefined}
                onClick={() => toggleQuickFilter('withoutMembership')}
                rightSection={renderQuickCount('withoutMembership', 'red')}
                type="button"
                variant={mobileMembershipPressed ? 'filled' : 'secondary'}
              >
                {resources.clients.list.quickFilters.withoutMembership}
              </Button>
              <IconButton
                className="clients-v7-mobile-filter-button"
                icon={<IconAdjustmentsHorizontal size={20} />}
                label="Фильтры"
                onClick={() => setMoreFiltersOpened(true)}
                size="xl"
                type="button"
                variant={state.activeFiltersCount > 0 ? 'pill' : 'secondary'}
              />
            </div>
          ) : (
            <div className="clients-v7-filter-desktop-row">
              {renderStatusButtons('clients-v7-filter-status')}
              <Group className="clients-v7-filter-inline-quick" gap="xs" wrap="nowrap">
                {visibleDesktopQuickFilters.map(renderQuickFilterChip)}
              </Group>
              <Button
                className="clients-v7-more-filters"
                leftSection={<IconAdjustmentsHorizontal size={18} />}
                onClick={() => setMoreFiltersOpened(true)}
                type="button"
                variant={state.activeFiltersCount > 0 ? 'pill' : 'secondary'}
              >
                Фильтры
                {state.activeFiltersCount > 0 ? (
                  <Badge color="accent.5" ml={8} size="sm" variant="filled">
                    {state.activeFiltersCount}
                  </Badge>
                ) : null}
              </Button>
            </div>
          )}
        </div>
      </form>

      <Drawer
        onClose={() => setMoreFiltersOpened(false)}
        opened={moreFiltersOpened}
        position="right"
        title="Еще фильтры"
      >
        <Stack gap="md">
          <Select
            clearable
            data={state.availableGroupOptions}
            label="Группа"
            onChange={(value) => state.updateFilters({ groupId: value })}
            placeholder="Все группы"
            searchable
            value={state.filters.groupId}
          />
          <Select
            clearable
            data={clientPaymentStatusFilterOptions}
            label="Оплата"
            onChange={(value) =>
              state.updateFilters({
                paymentStatus: (value as ClientPaymentStatusFilter | null) ?? 'all',
              })
            }
            placeholder="Любая оплата"
            value={
              state.filters.paymentStatus === 'all'
                ? null
                : state.filters.paymentStatus
            }
          />
          <SimpleGrid cols={2}>
            <TextInput
              label="Истекает с"
              onChange={(event) =>
                state.updateFilters({
                  membershipExpiresFrom: event.currentTarget.value,
                })
              }
              type="date"
              value={state.filters.membershipExpiresFrom}
            />
            <TextInput
              label="Истекает по"
              onChange={(event) =>
                state.updateFilters({
                  membershipExpiresTo: event.currentTarget.value,
                })
              }
              type="date"
              value={state.filters.membershipExpiresTo}
            />
          </SimpleGrid>
          <Switch
            checked={state.filters.withoutPhoto}
            label="Без фото"
            onChange={(event) =>
              state.updateFilters({ withoutPhoto: event.currentTarget.checked })
            }
          />
          <Select
            data={clientListPageSizeOptions}
            label="Размер страницы"
            onChange={(value) => {
              if (value) {
                state.updateFilters({ pageSize: value })
              }
            }}
            value={state.filters.pageSize}
          />
          <Button onClick={state.resetFilters} variant="light">
            Сбросить фильтры
          </Button>
        </Stack>
      </Drawer>
    </>
  )
}
