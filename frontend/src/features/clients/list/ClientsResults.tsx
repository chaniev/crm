import { useEffect, useSyncExternalStore } from 'react'
import {
  Avatar,
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
  IconUserHeart,
  IconUsers,
} from '@tabler/icons-react'
import {
  Button,
  EmptyState,
  ErrorState,
  ListRangeStatus,
  Skeleton,
} from '../../shared/ux'
import { clientListPageSizeOptions } from './clientListFilters'
import {
  buildClientRowViewModel,
  type ClientNextActionViewModel,
  type ClientRowViewModel,
} from './clientListViewModel'
import type { ClientsListState } from './useClientsListState'

type ClientsResultsProps = {
  canManage: boolean
  state: ClientsListState
  onCreate: () => void
  onOpen: (clientId: string) => void
  onPreview: (clientId: string) => void
}

export function ClientsResults({
  canManage,
  state,
  onCreate,
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
    if (isCompactLayout) {
      onPreview(clientId)
      return
    }

    state.setSelectedClientId(clientId)
  }

  if (state.loading) {
    return (
      <Stack data-testid="clients-list" gap="xs">
        <Skeleton rows={7} />
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
            Повторить
          </Button>
        )}
        message={state.error}
        title="Не удалось загрузить клиентов"
      />
    )
  }

  if (state.clients.length === 0) {
    return (
      <EmptyState
        action={
          state.isFirstRunEmpty && canManage ? (
            <Button data-client-return-recovery="true" onClick={onCreate}>
              Новый клиент
            </Button>
          ) : (
            <Button
              data-client-return-recovery="true"
              onClick={state.resetFilters}
              variant="light"
            >
              Сбросить фильтры
            </Button>
          )
        }
        description={
          state.isFirstRunEmpty
            ? 'Создайте первую карточку клиента.'
            : 'Попробуйте изменить поиск или сбросить фильтры.'
        }
        icon={<IconUsers size={24} />}
        title={state.isFirstRunEmpty ? 'Клиентов пока нет' : 'Клиенты не найдены'}
      />
    )
  }

  return (
    <Stack data-testid="clients-list" gap="sm">
      <div className="clients-v7-table-header" aria-hidden="true">
        <Text size="xs">Клиент</Text>
        <Text size="xs">Статус и абонемент</Text>
        <Text size="xs">Следующий шаг</Text>
        <Text size="xs">Группа</Text>
        <Text size="xs">Визит</Text>
      </div>

      {state.clients.map((client) => {
        const row = buildClientRowViewModel(client)
        const selected = state.selectedClientId === client.id
        const mobileStatus = resolveMobileStatusBadge(row)
        const mobileAction = resolveMobileAction(row)

        return (
          <Paper
            aria-label={`Выбрать клиента ${client.fullName}`}
            aria-current={selected ? 'true' : undefined}
            className="clients-v7-row"
            data-client-row-id={client.id}
            data-selected={selected || undefined}
            data-testid={`client-card-${client.id}`}
            key={client.id}
            onClick={() => selectClient(client.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
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
                <Avatar
                  className="clients-v7-mobile-card__avatar"
                  name={client.fullName}
                  radius="xl"
                  size="lg"
                  src={row.photoUrl}
                />
                <div className="clients-v7-mobile-card__main">
                  <Text className="clients-v7-row__primary" fw={800}>
                    {client.fullName}
                  </Text>
                  {canManage ? (
                    <Text c="dimmed" className="clients-v7-row__secondary" size="sm">
                      {client.phone || 'Телефон не указан'}
                    </Text>
                  ) : null}
                  <Badge
                    className="clients-v7-mobile-card__status"
                    color={mobileStatus.color}
                    variant="light"
                  >
                    {mobileStatus.label}
                  </Badge>
                </div>
                <div className="clients-v7-mobile-card__action">
                  {mobileAction ? (
                    <>
                      <Text
                        className="clients-v7-mobile-card__action-title"
                        data-tone={mobileAction.tone}
                        size="xs"
                      >
                        {mobileAction.label}
                      </Text>
                      <Text className="clients-v7-mobile-card__action-meta" size="sm">
                        {mobileAction.description}
                      </Text>
                    </>
                  ) : (
                    <Text
                      aria-hidden="true"
                      className="clients-v7-mobile-card__empty-action"
                      size="lg"
                    >
                      -
                    </Text>
                  )}
                </div>
                {mobileAction ? (
                  <IconChevronRight
                    aria-hidden="true"
                    className="clients-v7-mobile-card__chevron"
                    size={18}
                  />
                ) : null}
              </>
            ) : (
              <>
                <Group className="clients-v7-row__client" gap="sm" wrap="nowrap">
                  <Avatar name={client.fullName} radius="xl" src={row.photoUrl} />
                  <div>
                    <Text className="clients-v7-row__primary" fw={700}>
                      {client.fullName}
                    </Text>
                    {canManage ? (
                      <Text c="dimmed" className="clients-v7-row__secondary" size="sm">
                        {client.phone || 'Телефон не указан'}
                      </Text>
                    ) : null}
                  </div>
                </Group>

                <div>
                  <Group gap={6} wrap="nowrap">
                    <Badge
                      color={client.status === 'Active' ? 'teal' : 'gray'}
                      variant="light"
                    >
                      {row.statusLabel}
                    </Badge>
                    {client.isProfessional ? (
                      <Badge color="blue" variant="light">
                        Профессионал
                      </Badge>
                    ) : null}
                    <Text className="clients-v7-row__primary" size="sm">
                      {row.membershipLabel}
                    </Text>
                  </Group>
                  <Text c="dimmed" className="clients-v7-row__secondary" size="sm">
                    {row.membershipMeta}
                  </Text>
                </div>

                <div>
                  <Badge color={row.nextAction.tone} variant="light">
                    {row.nextAction.label}
                  </Badge>
                  {row.nextAction.description ? (
                    <Text c="dimmed" className="clients-v7-row__secondary" size="sm">
                      {row.nextAction.description}
                    </Text>
                  ) : null}
                </div>

                <Text className="clients-v7-row__primary" size="sm">
                  {row.groupLabel}
                </Text>

                <Group justify="space-between" wrap="nowrap">
                  <Text className="clients-v7-row__primary" size="sm">
                    {row.lastVisitLabel}
                  </Text>
                  <Button
                    leftSection={<IconUserHeart size={16} />}
                    onClick={(event) => {
                      event.stopPropagation()
                      onOpen(client.id)
                    }}
                    size="xs"
                    variant="subtle"
                  >
                    Открыть
                  </Button>
                </Group>
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
              Назад
            </Button>
            <Badge color="gray" radius="xl" variant="light">
              Страница {state.page}
            </Badge>
            <Button
              disabled={state.loading || !state.hasNextPage}
              onClick={() => state.setPage((currentPage) => currentPage + 1)}
              rightSection={<IconChevronRight size={16} />}
              variant="default"
            >
              Дальше
            </Button>
            <ClientsPageSizeSelect state={state} />
          </Group>
        </Group>
      )}
    </Stack>
  )
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
      aria-label="Размер страницы"
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
          aria-label="Назад"
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
              ...
            </Text>
          ) : (
            <Button
              aria-current={item === state.page ? 'page' : undefined}
              aria-label={`Страница ${item}`}
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
          aria-label="Дальше"
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

function resolveMobileStatusBadge(row: ClientRowViewModel) {
  if (row.client.status !== 'Active') {
    return { color: 'red', label: row.statusLabel }
  }

  if (row.nextAction.iconKey === 'group') {
    return { color: 'blue', label: 'Без группы' }
  }

  return { color: 'teal', label: row.statusLabel }
}

function resolveMobileAction(row: ClientRowViewModel) {
  if (isPlanAction(row.nextAction)) {
    return null
  }

  if (
    row.nextAction.daysUntilExpiration !== null &&
    row.nextAction.daysUntilExpiration >= 0
  ) {
    const daysLabel = row.nextAction.daysUntilExpiration === 0
      ? 'сегодня'
      : `${row.nextAction.daysUntilExpiration} дн.`

    return {
      label: 'Скоро закончится',
      description: daysLabel,
      tone: 'orange',
    }
  }

  if (
    row.nextAction.iconKey === 'membership' &&
    row.membershipLabel === 'Без абонемента'
  ) {
    return {
      label: 'Нужно сделать',
      description: 'Без абонемента',
      tone: 'red',
    }
  }

  return {
    label: row.nextAction.label,
    description: row.nextAction.description,
    tone: row.nextAction.tone,
  }
}

function isPlanAction(action: ClientNextActionViewModel) {
  return action.tone === 'gray' ||
    action.label === 'Планово' ||
    action.label === 'Плановое сопровождение'
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
