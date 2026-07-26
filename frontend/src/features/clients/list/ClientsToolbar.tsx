import {
  Drawer,
  Select,
  Switch,
  TextInput,
} from '@mantine/core'
import {
  IconFilterOff,
  IconPlus,
  IconRefresh,
} from '@tabler/icons-react'
import { useState } from 'react'
import { resources } from '../../../lib/resources'
import {
  ActiveFiltersBar,
  Button,
  EntityLocatorBar,
  IconButton,
  TemporarySurfaceFooter,
  type CompactFilterItem,
  type ActiveFilter,
} from '../../shared/ux'
import {
  clientListPageSizeOptions,
  createDefaultClientListFilters,
  type ClientStatusFilter,
} from './clientListFilters'
import type { ClientsListState } from './useClientsListState'

type ClientsToolbarProps = {
  canManage: boolean
  canSeeWithoutGroup: boolean
  onCreate: () => void
  state: ClientsListState
}

const statusOptions = [
  { value: 'all', label: resources.clients.list.statusFilters.all },
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
}

const quickFilters = [
  {
    key: 'withoutMembership',
    label: resources.clients.list.quickFilters.withoutMembership,
  },
  {
    key: 'expiringSoon',
    label: resources.clients.list.quickFilters.expiringSoon,
  },
  {
    key: 'withoutGroup',
    label: resources.clients.list.quickFilters.withoutGroup,
  },
  {
    key: 'trial',
    label: resources.clients.list.quickFilters.trial,
  },
] satisfies InlineQuickFilter[]

export function ClientsToolbar({
  canManage,
  canSeeWithoutGroup,
  onCreate,
  state,
}: ClientsToolbarProps) {
  const [filtersOpened, setFiltersOpened] = useState(false)

  function updateStatus(status: ClientStatusFilter) {
    state.setStatus(status)
  }

  function toggleQuickFilter(key: QuickFilterKey) {
    state.updateFilters({
      [key]: !state.filters[key],
    })
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
        type="button"
        variant={pressed ? 'filled' : 'secondary'}
      >
        {filter.label}
      </Button>
    )
  }

  const visibleQuickFilters = quickFilters.filter(
    (filter) => filter.key !== 'withoutGroup' || canSeeWithoutGroup,
  )
  const advancedFilterCount = countAdvancedClientFilters(state)
  const activeAdvancedFilters = buildActiveAdvancedFilters(
    state,
    visibleQuickFilters,
  )
  const filterItems: CompactFilterItem[] = [
    {
      key: 'groupId',
      label: 'Группа',
      render: () => (
        <Select
          clearable
          data={state.availableGroupOptions}
          label="Группа"
          onChange={(value) => state.updateFilters({ groupId: value })}
          placeholder="Все группы"
          searchable
          value={state.filters.groupId}
        />
      ),
    },
    {
      key: 'membershipExpiresFrom',
      label: 'Истекает с',
      render: () => (
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
      ),
    },
    ...visibleQuickFilters.map((filter) => ({
      key: filter.key,
      label: filter.label,
      render: () => renderQuickFilterChip(filter),
    })),
    {
      key: 'status',
      label: 'Статус',
      render: () => (
        <Select
          data={statusOptions}
          label="Статус"
          onChange={(value) => updateStatus((value as ClientStatusFilter | null) ?? 'all')}
          placeholder="Все статусы"
          value={state.filters.status}
        />
      ),
    },
    {
      key: 'membershipExpiresTo',
      label: 'Истекает по',
      render: () => (
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
      ),
    },
    {
      key: 'withoutPhoto',
      label: 'Без фото',
      render: () => (
        <Switch
          checked={state.filters.withoutPhoto}
          label="Без фото"
          onChange={(event) =>
            state.updateFilters({ withoutPhoto: event.currentTarget.checked })
          }
        />
      ),
    },
    {
      key: 'pageSize',
      label: 'Размер страницы',
      render: () => (
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
      ),
    },
  ] satisfies CompactFilterItem[]

  function clearSearchQuery() {
    state.setSearchDraft('')
    state.updateFilters({ query: '' })
  }

  function resetAdvancedFilters() {
    const defaults = createDefaultClientListFilters()

    state.updateFilters({
      groupId: defaults.groupId,
      status: defaults.status,
      membershipExpiresFrom: defaults.membershipExpiresFrom,
      membershipExpiresTo: defaults.membershipExpiresTo,
      withoutPhoto: defaults.withoutPhoto,
      withoutMembership: defaults.withoutMembership,
      expiringSoon: defaults.expiringSoon,
      withoutGroup: defaults.withoutGroup,
      trial: defaults.trial,
      pageSize: defaults.pageSize,
    })
  }

  return (
    <div
      className="clients-v7-filter-panel"
      data-testid="clients-filter-panel"
    >
      <EntityLocatorBar
        accessibleLabel={canManage ? 'Поиск по имени или телефону' : 'Поиск по имени'}
        activeFilterCount={advancedFilterCount}
        className="clients-v7-locator"
        disabled={state.loading}
        frequentActions={(
          <IconButton
            className="clients-v7-refresh-button"
            icon={<IconRefresh size={18} />}
            label="Обновить список"
            onClick={state.reload}
            size={44}
            variant="ghost"
          />
        )}
        onChange={state.setSearchDraft}
        onClear={clearSearchQuery}
        onOpenFilters={() => setFiltersOpened(true)}
        placeholder={canManage ? 'Имя или телефон' : 'Имя клиента'}
        primaryAction={canManage ? (
          <Button
            aria-label="Новый клиент"
            className="clients-v7-create-button"
            color="var(--crm-brand-secondary)"
            leftSection={<IconPlus size={20} />}
            onClick={onCreate}
          >
            Новый клиент
          </Button>
        ) : null}
        resultsId="clients-results"
        value={state.searchDraft}
      />

      <ActiveFiltersBar
        filters={activeAdvancedFilters}
        onReset={resetAdvancedFilters}
        resetLabel="Сбросить фильтры"
      />

      <Drawer
        classNames={{
          body: 'clients-v7-filters-drawer__body',
          content: 'clients-v7-filters-drawer__content',
          header: 'clients-v7-filters-drawer__header',
        }}
        closeButtonProps={{ 'aria-label': 'Закрыть фильтры клиентов' }}
        closeOnClickOutside
        closeOnEscape
        onClose={() => setFiltersOpened(false)}
        opened={filtersOpened}
        overlayProps={{ backgroundOpacity: 0.18, blur: 2 }}
        position="bottom"
        returnFocus
        size="min(34rem, 100dvh)"
        title="Фильтры клиентов"
        trapFocus
        withCloseButton
        zIndex={300}
      >
        <div className="clients-v7-filters-drawer__fields">
          {filterItems.map((item) => (
            <div className="compact-filter-panel__item compact-filter-panel__item--sheet" key={item.key}>
              {item.render('sheet')}
            </div>
          ))}
        </div>
        <TemporarySurfaceFooter
          primaryAction={(
            <Button onClick={() => setFiltersOpened(false)} type="button">
              Готово
            </Button>
          )}
          secondaryAction={(
            <Button
              leftSection={<IconFilterOff size={16} />}
              onClick={resetAdvancedFilters}
              type="button"
              variant="secondary"
            >
              Сбросить
            </Button>
          )}
        />
      </Drawer>
    </div>
  )
}

function countAdvancedClientFilters(state: ClientsListState) {
  const filters = state.filters

  return [
    Boolean(filters.groupId),
    filters.status !== 'Active',
    Boolean(filters.membershipExpiresFrom),
    Boolean(filters.membershipExpiresTo),
    filters.withoutPhoto,
    filters.withoutMembership,
    filters.expiringSoon,
    filters.withoutGroup,
    filters.trial,
  ].filter(Boolean).length
}

function buildActiveAdvancedFilters(
  state: ClientsListState,
  visibleQuickFilters: readonly InlineQuickFilter[],
) {
  const filters = state.filters
  const activeFilters: ActiveFilter[] = []
  const groupLabel = state.availableGroupOptions.find(
    (option) => option.value === filters.groupId,
  )?.label

  if (filters.groupId) {
    activeFilters.push({
      id: 'groupId',
      label: `Группа: ${groupLabel ?? 'выбрана'}`,
      onRemove: () => state.updateFilters({ groupId: null }),
    })
  }

  if (filters.membershipExpiresFrom) {
    activeFilters.push({
      id: 'membershipExpiresFrom',
      label: `Истекает с ${filters.membershipExpiresFrom}`,
      onRemove: () => state.updateFilters({ membershipExpiresFrom: '' }),
    })
  }

  if (filters.membershipExpiresTo) {
    activeFilters.push({
      id: 'membershipExpiresTo',
      label: `Истекает по ${filters.membershipExpiresTo}`,
      onRemove: () => state.updateFilters({ membershipExpiresTo: '' }),
    })
  }

  for (const quickFilter of visibleQuickFilters) {
    if (!filters[quickFilter.key]) {
      continue
    }

    activeFilters.push({
      id: quickFilter.key,
      label: quickFilter.label,
      onRemove: () => state.updateFilters({ [quickFilter.key]: false }),
    })
  }

  if (filters.status !== 'Active') {
    activeFilters.push({
      id: 'status',
      label: `Статус: ${statusOptions.find((option) => option.value === filters.status)?.label ?? filters.status}`,
      onRemove: () => state.setStatus('Active'),
    })
  }

  if (filters.withoutPhoto) {
    activeFilters.push({
      id: 'withoutPhoto',
      label: 'Без фото',
      onRemove: () => state.updateFilters({ withoutPhoto: false }),
    })
  }

  return activeFilters
}
