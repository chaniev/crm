import { IconPlus, IconRefresh } from '@tabler/icons-react'
import { Button, IconButton, PageLayout, PageSection } from '../../shared/ux'
import { ClientPreviewPanel } from './ClientPreviewPanel'
import { ClientsQuickFilters } from './ClientsQuickFilters'
import { ClientsResults } from './ClientsResults'
import { ClientsToolbar } from './ClientsToolbar'
import { useClientsListState } from './useClientsListState'

type ClientsListScreenProps = {
  canManage: boolean
  canSeeWithoutGroupQuickFilter: boolean
  previewClientId?: string | null
  onCreate: () => void
  onOpen: (clientId: string) => void
  onPreview: (clientId: string) => void
}

export function ClientsListScreen({
  canManage,
  canSeeWithoutGroupQuickFilter,
  previewClientId = null,
  onCreate,
  onOpen,
  onPreview,
}: ClientsListScreenProps) {
  const state = useClientsListState({ previewClientId })
  const previewMode = Boolean(previewClientId)
  const activeClientsCount = state.activeCount ?? state.totalCount ?? 0
  const countLabel = `${activeClientsCount} ${resolveClientCountWord(activeClientsCount)}`

  return (
    <PageLayout
      actions={!previewMode ? (
        <>
          <IconButton
            className="clients-v7-refresh-button"
            icon={<IconRefresh size={18} />}
            label="Обновить список"
            onClick={state.reload}
            size="lg"
            variant="ghost"
          />
          {canManage ? (
            <Button
              aria-label="Новый клиент"
              className="clients-v7-create-button"
              color="accent.5"
              leftSection={<IconPlus size={20} />}
              onClick={onCreate}
            >
              Новый клиент
            </Button>
          ) : null}
        </>
      ) : undefined}
      className={previewMode
        ? 'clients-v7-screen clients-v7-screen--preview'
        : 'clients-v7-screen'}
      data-testid="clients-screen"
      description={previewMode ? undefined : countLabel}
      title={previewMode ? 'Краткая карточка' : 'Клиенты'}
    >
      <PageSection className="clients-v7-controls-section" variant="plain">
        <ClientsToolbar
          canManage={canManage}
          canSeeWithoutGroup={canSeeWithoutGroupQuickFilter}
          state={state}
        />
        <ClientsQuickFilters
          canSeeWithoutGroup={canSeeWithoutGroupQuickFilter}
          state={state}
        />
      </PageSection>

      <PageSection density="compact">
        <div className="clients-v7-layout">
          <ClientsResults
            canManage={canManage}
            onCreate={onCreate}
            onOpen={onOpen}
            onPreview={onPreview}
            state={state}
          />
          <ClientPreviewPanel canManage={canManage} onOpen={onOpen} state={state} />
        </div>
      </PageSection>
    </PageLayout>
  )
}

function resolveClientCountWord(count: number) {
  const absolute = Math.abs(count)
  const mod100 = absolute % 100
  const mod10 = absolute % 10

  if (mod100 >= 11 && mod100 <= 14) {
    return 'клиентов'
  }

  if (mod10 === 1) {
    return 'клиент'
  }

  if (mod10 >= 2 && mod10 <= 4) {
    return 'клиента'
  }

  return 'клиентов'
}
