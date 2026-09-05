import {
  Drawer,
  Select,
  Switch,
  TextInput,
} from '@mantine/core'
import {
  IconFilterOff,
  IconPlus,
} from '@tabler/icons-react'
import { useState } from 'react'
import { resources } from '../../../lib/resources'
import {
  ActiveFiltersBar,
  Button,
  EntityLocatorBar,
  TaskToolbarAction,
  TaskToolbarRefreshAction,
  TemporarySurfaceFooter,
  type CompactFilterItem,
  type ActiveFilter,
} from '../../shared/ux'
import {
  clientListPageSizeOptions,
  type ClientStatusFilter,
} from './clientListFilters'
import type { ClientsListState } from './useClientsListState'
import { fe5ClientListText } from '../../../resources/fe-5-client-list'


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
  const advancedFilterCount = state.activeAdvancedFiltersCount
  const activeAdvancedFilters = buildActiveAdvancedFilters(
    state,
    visibleQuickFilters,
  )
  const filterItems: CompactFilterItem[] = [
    {
      key: 'groupId',
      label: fe5ClientListText.clientsToolbar_label_907efbd4,
      render: () => (
        <Select
          clearable
          data={state.availableGroupOptions}
          label={fe5ClientListText.clientsToolbar_label_907efbd4}
          onChange={(value) => state.updateFilters({ groupId: value })}
          placeholder={fe5ClientListText.clientsToolbar_placeholder_d71b0c68}
          searchable
          value={state.filters.groupId}
        />
      ),
    },
    {
      key: 'membershipExpiresFrom',
      label: fe5ClientListText.clientsToolbar_label_9c924cdc,
      render: () => (
        <TextInput
          label={fe5ClientListText.clientsToolbar_label_9c924cdc}
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
      label: fe5ClientListText.clientsToolbar_label_225077c6,
      render: () => (
        <Select
          data={statusOptions}
          label={fe5ClientListText.clientsToolbar_label_225077c6}
          onChange={(value) => updateStatus((value as ClientStatusFilter | null) ?? 'all')}
          placeholder={fe5ClientListText.clientsToolbar_placeholder_2a013601}
          value={state.filters.status}
        />
      ),
    },
    {
      key: 'membershipExpiresTo',
      label: fe5ClientListText.clientsToolbar_label_5c7aab91,
      render: () => (
        <TextInput
          label={fe5ClientListText.clientsToolbar_label_5c7aab91}
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
      label: fe5ClientListText.clientsToolbar_label_f2549c72,
      render: () => (
        <Switch
          checked={state.filters.withoutPhoto}
          label={fe5ClientListText.clientsToolbar_label_f2549c72}
          onChange={(event) =>
            state.updateFilters({ withoutPhoto: event.currentTarget.checked })
          }
        />
      ),
    },
    {
      key: 'pageSize',
      label: fe5ClientListText.clientsToolbar_label_3ff6b7f9,
      render: () => (
        <Select
          data={clientListPageSizeOptions}
          label={fe5ClientListText.clientsToolbar_label_3ff6b7f9}
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

  function handleSearchBlur() {
    state.setSearchFocused(false)
    state.applySearchNow()
  }

  return (
    <div
      className="clients-v7-filter-panel"
      data-testid="clients-filter-panel"
    >
      <EntityLocatorBar
        accessibleLabel={canManage ? fe5ClientListText.clientsToolbar_string_6890f945 : fe5ClientListText.clientsToolbar_string_ae8e30fb}
        activeFilterCount={advancedFilterCount}
        className="clients-v7-locator"
        data-client-search-mode={state.searchMode}
        data-loading={state.loading || undefined}
        frequentActions={(
          <TaskToolbarRefreshAction
            label={fe5ClientListText.clientsToolbar_label_163a016f}
            loading={state.loading}
            onClick={state.reload}
          />
        )}
        onChange={state.setSearchDraft}
        onClear={state.clearSearchQuery}
        onInputBlur={handleSearchBlur}
        onInputFocus={() => state.setSearchFocused(true)}
        onOpenFilters={() => setFiltersOpened(true)}
        placeholder={canManage ? fe5ClientListText.clientsToolbar_string_4d848c10 : fe5ClientListText.clientsToolbar_string_0e1206b8}
        primaryAction={canManage ? (
          <TaskToolbarAction
            icon={<IconPlus size={18} />}
            label={fe5ClientListText.clientsToolbar_label_5a2595c2}
            onClick={onCreate}
            priority="primary"
          />
        ) : null}
        resultsId="clients-results"
        value={state.searchDraft}
      />

      <ActiveFiltersBar
        filters={activeAdvancedFilters}
        onReset={state.resetAdvancedFilters}
        resetLabel={fe5ClientListText.clientsToolbar_resetLabel_cd45ec78}
      />

      <Drawer
        classNames={{
          body: 'clients-v7-filters-drawer__body',
          content: 'clients-v7-filters-drawer__content',
          header: 'clients-v7-filters-drawer__header',
        }}
        closeButtonProps={{
          'aria-label': fe5ClientListText.clientsToolbar_ariaLabel_fcf4cc1c,
          className: 'temporary-surface-close clients-v7-filters-drawer__close',
        }}
        closeOnClickOutside
        closeOnEscape
        onClose={() => setFiltersOpened(false)}
        opened={filtersOpened}
        overlayProps={{ backgroundOpacity: 0.18, blur: 2 }}
        position="bottom"
        returnFocus
        size="min(34rem, 100dvh)"
        title={fe5ClientListText.clientsToolbar_title_ef76d1e3}
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
              {fe5ClientListText.clientsToolbar_jsxText_ef05d579}</Button>
          )}
          secondaryAction={(
            <Button
              leftSection={<IconFilterOff size={16} />}
              onClick={state.resetAdvancedFilters}
              type="button"
              variant="secondary"
            >
              {fe5ClientListText.clientsToolbar_jsxText_407f8717}</Button>
          )}
        />
      </Drawer>
    </div>
  )
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
      label: fe5ClientListText.clientsToolbar_label_ddeb6381(groupLabel ?? fe5ClientListText.clientsToolbar_string_ce01acee),
      onRemove: () => state.updateFilters({ groupId: null }),
    })
  }

  if (filters.membershipExpiresFrom) {
    activeFilters.push({
      id: 'membershipExpiresFrom',
      label: fe5ClientListText.clientsToolbar_label_01440154(filters.membershipExpiresFrom),
      onRemove: () => state.updateFilters({ membershipExpiresFrom: '' }),
    })
  }

  if (filters.membershipExpiresTo) {
    activeFilters.push({
      id: 'membershipExpiresTo',
      label: fe5ClientListText.clientsToolbar_label_692fdce0(filters.membershipExpiresTo),
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
      label: fe5ClientListText.clientsToolbar_label_20f55670(statusOptions.find((option) => option.value === filters.status)?.label ?? filters.status),
      onRemove: () => state.setStatus('Active'),
    })
  }

  if (filters.withoutPhoto) {
    activeFilters.push({
      id: 'withoutPhoto',
      label: fe5ClientListText.clientsToolbar_label_f2549c72,
      onRemove: () => state.updateFilters({ withoutPhoto: false }),
    })
  }

  return activeFilters
}
