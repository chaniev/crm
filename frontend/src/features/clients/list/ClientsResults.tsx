import { useEffect, useSyncExternalStore } from 'react'
import {
  Badge,
  Group,
  Paper,
  Select,
  Stack,
  Text,
} from '@mantine/core'
import {
  IconChevronLeft,
  IconChevronRight,
  IconUsers,
} from '@tabler/icons-react'
import {
  Button,
  ClientAvatar,
  EmptyState,
  ErrorState,
  ListRangeStatus,
  Skeleton,
} from '../../shared/ux'
import { clientListPageSizeOptions } from './clientListFilters'
import {
  buildClientRowViewModel,
  buildClientCompactViewModel,
} from './clientListViewModel'
import type { ClientsListState } from './useClientsListState'
import { fe5ClientListText } from '../../../resources/fe-5-client-list'


type ClientsResultsProps = {
  canManage: boolean
  currentUserBranchId: string | null
  isSplitLayout: boolean
  state: ClientsListState
  onOpen: (clientId: string) => void
  onPreview: (clientId: string) => void
}

export function ClientsResults({
  canManage,
  currentUserBranchId,
  isSplitLayout,
  state,
  onOpen,
  onPreview,
}: ClientsResultsProps) {
  const isCompactLayout = useIsClientsCompactLayout()
  const restoreClients = state.clients
  const completeReturnRestore = state.completeReturnRestore
  const restoreError = state.error
  const restoreLoading = state.loading
  const returnRestoreSnapshot = state.returnRestoreSnapshot
  const restoreSelectedClientId = state.selectedClientId

  useEffect(() => {
    const snapshot = returnRestoreSnapshot

    if (!snapshot || restoreLoading) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      const rowElements = getClientRowElements()
      const selectedRow = snapshot.selectedClientId
        ? findClientRowElement(rowElements, snapshot.selectedClientId)
        : null
      const anchorRow = snapshot.anchorClientId
        ? findClientRowElement(rowElements, snapshot.anchorClientId)
        : null
      const firstRow = rowElements[0] ?? null
      const recoveryAction = document.querySelector<HTMLElement>(
        '[data-client-return-recovery="true"]',
      )
      const resultsRegion = document.getElementById('clients-results')

      if (restoreError || restoreClients.length === 0) {
        focusClientListReturnTarget(recoveryAction ?? resultsRegion)
        completeReturnRestore()
        return
      }

      restoreClientListScroll(snapshot.scrollY, anchorRow ?? selectedRow)
      focusClientListReturnTarget(selectedRow ?? firstRow ?? resultsRegion)
      completeReturnRestore()
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [
    completeReturnRestore,
    restoreClients,
    restoreError,
    restoreLoading,
    restoreSelectedClientId,
    returnRestoreSnapshot,
  ])

  function selectClient(clientId: string) {
    if (isCompactLayout || !isSplitLayout) {
      onPreview(clientId)
      return
    }

    state.setSelectedClientId(clientId)
    state.setPreviewIntent('expanded')
  }

  const showBranchIdentity = currentUserBranchId === null

  if (state.loading) {
    return (
      <Stack data-testid="clients-list" gap={isCompactLayout ? 8 : 'xs'}>
        <Skeleton
          className="clients-v7-row-skeleton"
          gap={isCompactLayout ? 8 : 'sm'}
          rowHeight={isCompactLayout ? 96 : 72}
          rows={7}
        />
      </Stack>
    )
  }

  if (state.error) {
    return (
      <ErrorState
        action={(
          <Button
            data-client-return-recovery="true"
            onClick={state.reload}
            variant="light"
          >
            {fe5ClientListText.clientsResults_jsxText_5189135a}</Button>
        )}
        message={state.error}
        title={fe5ClientListText.clientsResults_title_180fcaa4}
      />
    )
  }

  if (state.clients.length === 0) {
    const hasSearchQuery = Boolean(state.filters.query.trim() || state.searchDraft.trim())
    const hasAdvancedFilters = state.activeAdvancedFiltersCount > 0
    const recoveryActions = buildEmptyRecoveryActions({
      canManage,
      hasAdvancedFilters,
      hasSearchQuery,
      isFirstRunEmpty: state.isFirstRunEmpty,
      onClearSearch: state.clearSearchQuery,
      onResetAdvancedFilters: state.resetAdvancedFilters,
    })

    return (
      <EmptyState
        action={recoveryActions}
        description={
          state.isFirstRunEmpty
            ? canManage
              ? fe5ClientListText.clientsResults_string_c0936f1b
              : fe5ClientListText.clientsResults_string_517609e1
            : resolveEmptyDescription(hasSearchQuery, hasAdvancedFilters)
        }
        icon={<IconUsers size={24} />}
        title={state.isFirstRunEmpty ? fe5ClientListText.clientsResults_string_8d588d9f : fe5ClientListText.clientsResults_string_4c1f7bc0}
      />
    )
  }

  return (
    <Stack data-testid="clients-list" gap={isCompactLayout ? 8 : 'sm'}>
      <div className="clients-v7-table-header" aria-hidden="true">
        <Text size="xs">{fe5ClientListText.clientsResults_jsxText_3e622aec}</Text>
        <Text size="xs">{fe5ClientListText.clientsResults_jsxText_2f17c4d2}</Text>
        <Text size="xs">{fe5ClientListText.clientsResults_jsxText_1139430b}</Text>
        <Text size="xs">{fe5ClientListText.clientsResults_jsxText_5ce0e345}</Text>
      </div>

      {state.clients.map((client) => {
        const row = buildClientRowViewModel(client)
        const groupLabel = getClientRowGroupLabel(client.branchName, row.groupLabel)
        const compactCard = buildClientCompactViewModel(client, {
          canSeePhone: canManage,
          showBranchIdentity,
        })
        const selected = state.selectedClientId === client.id

        return (
          <Paper
            aria-label={isCompactLayout
              ? compactCard.accessibleName
              : fe5ClientListText.clientsResults_template_3a8e2e94(client.fullName)}
            aria-current={selected ? 'true' : undefined}
            className="clients-v7-row"
            data-client-branch-visible={
              isCompactLayout && compactCard.branchLabel ? 'true' : undefined
            }
            data-client-row-id={client.id}
            data-client-search-card={isCompactLayout ? 'true' : undefined}
            data-client-search-mode={state.searchMode}
            data-selected={selected || undefined}
            data-testid={`client-card-${client.id}`}
            key={client.id}
            onClick={() => selectClient(client.id)}
            onDoubleClick={() => {
              if (!isCompactLayout && isSplitLayout) {
                onOpen(client.id)
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                if (!isCompactLayout && isSplitLayout) {
                  onOpen(client.id)
                } else {
                  selectClient(client.id)
                }
                return
              }

              if (event.key === ' ') {
                event.preventDefault()
                selectClient(client.id)
              }
            }}
            role="button"
            tabIndex={0}
            withBorder
          >
            {isCompactLayout ? (
              <>
                <ClientAvatar
                  className="clients-v7-mobile-card__avatar"
                  name={compactCard.fullName}
                  radius="xl"
                  size={36}
                  src={compactCard.photoUrl}
                />
                <div className="clients-v7-mobile-card__main">
                  <Text className="clients-v7-row__primary" fw={800}>
                    {compactCard.fullName}
                  </Text>
                  <div className="clients-v7-mobile-card__meta">
                    {compactCard.phoneLabel ? (
                      <Text
                        c="dimmed"
                        className="clients-v7-row__secondary clients-v7-mobile-card__phone"
                        size="sm"
                      >
                        {compactCard.phoneLabel}
                      </Text>
                    ) : null}
                    {compactCard.branchLabel ? (
                      <Text
                        c="dimmed"
                        className="clients-v7-row__secondary clients-v7-mobile-card__branch"
                        size="sm"
                      >
                        {compactCard.branchLabel}
                      </Text>
                    ) : null}
                  </div>
                  <Badge
                    className="clients-v7-mobile-card__status"
                    color={compactCard.nextAction.tone}
                    variant="light"
                  >
                    {compactCard.nextAction.label}
                  </Badge>
                </div>
                <IconChevronRight
                  aria-hidden="true"
                  className="clients-v7-mobile-card__chevron"
                  size={20}
                />
              </>
            ) : (
              <>
                <Group className="clients-v7-row__client" gap="sm" wrap="nowrap">
                  <ClientAvatar name={client.fullName} radius="xl" src={row.photoUrl} />
                  <div>
                    <Text className="clients-v7-row__primary" fw={700}>
                      {client.fullName}
                    </Text>
                    {canManage ? (
                      <Text c="dimmed" className="clients-v7-row__secondary" size="sm">
                        {client.phone || fe5ClientListText.clientsResults_string_1fc40e1a}
                      </Text>
                    ) : null}
                  </div>
                </Group>

                <div className="clients-v7-row__branch">
                  <Text className="clients-v7-row__primary" size="sm">
                    {client.branchName || fe5ClientListText.clientsResults_string_a560016c}
                  </Text>
                  <Text c="dimmed" className="clients-v7-row__secondary" size="sm">
                    {groupLabel}
                  </Text>
                </div>

                <div className="clients-v7-row__membership">
                  <Group gap={6} wrap="wrap">
                    <Badge
                      color={client.status === 'Active' ? 'teal' : 'gray'}
                      variant="light"
                    >
                      {row.statusLabel}
                    </Badge>
                    <Text className="clients-v7-row__primary" size="sm">
                      {row.membershipLabel}
                    </Text>
                  </Group>
                  <Text c="dimmed" className="clients-v7-row__secondary" size="sm">
                    {row.membershipMeta}
                  </Text>
                </div>

                <div className="clients-v7-row__next-action">
                  <Badge color={row.nextAction.tone} variant="light">
                    {row.nextAction.label}
                  </Badge>
                  {row.nextAction.description ? (
                    <Text c="dimmed" className="clients-v7-row__secondary" size="sm">
                      {row.nextAction.description}
                    </Text>
                  ) : null}
                  <Text c="dimmed" className="clients-v7-row__secondary" size="sm">
                    {row.lastVisitLabel}
                  </Text>
                </div>
              </>
            )}
          </Paper>
        )
      })}

      {isCompactLayout ? (
        <MobileClientsPagination state={state} />
      ) : (
        <Group justify="space-between" pt="xs" wrap="wrap">
          <ClientsPageSummary state={state} />

          <Group className="clients-v7-pagination" gap="xs">
            <Button
              disabled={state.loading || state.page <= 1}
              leftSection={<IconChevronLeft size={16} />}
              onClick={() =>
                state.setPage((currentPage) => Math.max(1, currentPage - 1))
              }
              variant="default"
            >
              {fe5ClientListText.clientsResults_jsxText_1a9fb1f3}</Button>
            <Badge color="gray" radius="xl" variant="light">
              {fe5ClientListText.clientsResults_jsxText_41006963}{state.page}
            </Badge>
            <Button
              disabled={state.loading || !state.hasNextPage}
              onClick={() => state.setPage((currentPage) => currentPage + 1)}
              rightSection={<IconChevronRight size={16} />}
              variant="default"
            >
              {fe5ClientListText.clientsResults_jsxText_ea58bb0b}</Button>
            <ClientsPageSizeSelect state={state} />
          </Group>
        </Group>
      )}
    </Stack>
  )
}

function getClientRowGroupLabel(branchName: string | null, groupLabel: string) {
  if (!branchName) {
    return groupLabel
  }

  const branchPrefix = `${branchName} · `

  return groupLabel.startsWith(branchPrefix)
    ? groupLabel.slice(branchPrefix.length)
    : groupLabel
}

function buildEmptyRecoveryActions({
  canManage,
  hasAdvancedFilters,
  hasSearchQuery,
  isFirstRunEmpty,
  onClearSearch,
  onResetAdvancedFilters,
}: {
  canManage: boolean
  hasAdvancedFilters: boolean
  hasSearchQuery: boolean
  isFirstRunEmpty: boolean
  onClearSearch: () => void
  onResetAdvancedFilters: () => void
}) {
  if (isFirstRunEmpty && canManage) {
    return null
  }

  const actions = []

  if (hasSearchQuery) {
    actions.push(
      <Button
        data-client-return-recovery="true"
        key="clear-search"
        onClick={onClearSearch}
        variant="light"
      >
        {fe5ClientListText.clientsResults_jsxText_6e1f7baa}</Button>,
    )
  }

  if (hasAdvancedFilters) {
    actions.push(
      <Button
        data-client-return-recovery={hasSearchQuery ? undefined : 'true'}
        key="reset-filters"
        onClick={onResetAdvancedFilters}
        variant="light"
      >
        {fe5ClientListText.clientsResults_jsxText_cd45ec78}</Button>,
    )
  }

  if (actions.length === 0) {
    return null
  }

  return (
    <Group gap="xs" wrap="wrap">
      {actions}
    </Group>
  )
}

function resolveEmptyDescription(
  hasSearchQuery: boolean,
  hasAdvancedFilters: boolean,
) {
  if (hasSearchQuery && hasAdvancedFilters) {
    return fe5ClientListText.clientsResults_string_155e2d79
  }

  if (hasSearchQuery) {
    return fe5ClientListText.clientsResults_string_df8d8576
  }

  return fe5ClientListText.clientsResults_string_6694f801
}

function ClientsPageSummary({ state }: { state: ClientsListState }) {
  return (
    <ListRangeStatus
      end={state.pageEnd}
      hasMore={state.hasNextPage}
      loading={state.loading}
      start={state.pageStart}
      total={state.totalCount}
    />
  )
}

function ClientsPageSizeSelect({ state }: { state: ClientsListState }) {
  return (
    <Select
      aria-label={fe5ClientListText.clientsResults_ariaLabel_3ff6b7f9}
      className="clients-v7-page-size"
      data={clientListPageSizeOptions}
      onChange={(value) => {
        if (value) {
          state.updateFilters({ pageSize: value })
        }
      }}
      value={state.filters.pageSize}
    />
  )
}

function MobileClientsPagination({ state }: { state: ClientsListState }) {
  const pageSize = Number(state.filters.pageSize)
  const totalPages = state.totalCount === null || !Number.isFinite(pageSize)
    ? null
    : Math.max(1, Math.ceil(state.totalCount / pageSize))
  const pageItems = getMobilePaginationItems(state.page, totalPages)

  return (
    <div className="clients-v7-mobile-pagination">
      <ClientsPageSummary state={state} />
      <Group className="clients-v7-mobile-pagination__pages" gap="xs" justify="center">
        <Button
          aria-label={fe5ClientListText.clientsResults_jsxText_1a9fb1f3}
          disabled={state.loading || state.page <= 1}
          onClick={() =>
            state.setPage((currentPage) => Math.max(1, currentPage - 1))
          }
          variant="default"
        >
          <IconChevronLeft size={18} />
        </Button>
        {pageItems.map((item) => (
          item === 'ellipsis' ? (
            <Text
              aria-hidden="true"
              className="clients-v7-mobile-pagination__ellipsis"
              key={item}
            >
              {fe5ClientListText.clientsResults_jsxText_ab5df625}</Text>
          ) : (
            <Button
              aria-current={item === state.page ? 'page' : undefined}
              aria-label={fe5ClientListText.clientsResults_template_feafe754(item)}
              className="clients-v7-mobile-pagination__page"
              data-active={item === state.page || undefined}
              key={item}
              onClick={() => state.setPage(item)}
              variant={item === state.page ? 'filled' : 'default'}
            >
              {item}
            </Button>
          )
        ))}
        <Button
          aria-label={fe5ClientListText.clientsResults_jsxText_ea58bb0b}
          disabled={state.loading || !state.hasNextPage}
          onClick={() => state.setPage((currentPage) => currentPage + 1)}
          variant="default"
        >
          <IconChevronRight size={18} />
        </Button>
      </Group>
      <ClientsPageSizeSelect state={state} />
    </div>
  )
}

function getMobilePaginationItems(currentPage: number, totalPages: number | null) {
  if (totalPages === null) {
    return [currentPage] as Array<number | 'ellipsis'>
  }

  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 'ellipsis', totalPages] as Array<number | 'ellipsis'>
  }

  if (currentPage >= totalPages - 2) {
    return [1, 'ellipsis', totalPages - 2, totalPages - 1, totalPages] as Array<
      number | 'ellipsis'
    >
  }

  return [
    1,
    'ellipsis',
    currentPage - 1,
    currentPage,
    currentPage + 1,
    'ellipsis',
    totalPages,
  ] as Array<number | 'ellipsis'>
}

function getClientRowElements() {
  return Array.from(
    document.querySelectorAll<HTMLElement>('[data-client-row-id]'),
  )
}

function findClientRowElement(
  rowElements: HTMLElement[],
  clientId: string,
) {
  return rowElements.find((element) => element.dataset.clientRowId === clientId) ?? null
}

function focusClientListReturnTarget(element: HTMLElement | null) {
  if (!element) {
    return
  }

  if (!element.hasAttribute('tabindex') && !isNaturallyFocusable(element)) {
    element.setAttribute('tabindex', '-1')
  }

  element.focus({ preventScroll: true })
}

function restoreClientListScroll(scrollY: number, anchorElement: HTMLElement | null) {
  const maxScrollY = Math.max(
    0,
    document.documentElement.scrollHeight - window.innerHeight,
  )
  const targetScrollY = Math.min(Math.max(scrollY, 0), maxScrollY)

  window.scrollTo({ top: targetScrollY })

  if (anchorElement && !isElementInUsableViewport(anchorElement)) {
    anchorElement.scrollIntoView({ block: 'nearest' })
  }
}

function isElementInUsableViewport(element: HTMLElement) {
  const rect = element.getBoundingClientRect()
  const bottomNavigation = document.querySelector<HTMLElement>(
    '[data-testid="mobile-bottom-navigation"]',
  )
  const usableBottom = bottomNavigation
    ? bottomNavigation.getBoundingClientRect().top
    : window.innerHeight

  return rect.top >= 0 && rect.bottom <= usableBottom - 8
}

function isNaturallyFocusable(element: HTMLElement) {
  return (
    element instanceof HTMLButtonElement ||
    element instanceof HTMLAnchorElement ||
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement
  )
}

const clientsCompactLayoutQuery = '(max-width: 62rem)'

function useIsClientsCompactLayout() {
  return useSyncExternalStore(
    subscribeClientsCompactLayout,
    getClientsCompactLayoutSnapshot,
    getClientsCompactLayoutServerSnapshot,
  )
}

function subscribeClientsCompactLayout(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  const mediaQuery = window.matchMedia(clientsCompactLayoutQuery)

  mediaQuery.addEventListener('change', onStoreChange)

  return () => mediaQuery.removeEventListener('change', onStoreChange)
}

function getClientsCompactLayoutSnapshot() {
  return typeof window === 'undefined'
    ? false
    : window.matchMedia(clientsCompactLayoutQuery).matches
}

function getClientsCompactLayoutServerSnapshot() {
  return false
}
