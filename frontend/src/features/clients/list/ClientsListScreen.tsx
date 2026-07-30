import { useEffect } from 'react'
import { PageLayout, PageSection } from '../../shared/ux'
import { ClientPreviewPanel } from './ClientPreviewPanel'
import { ClientsResults } from './ClientsResults'
import { ClientsToolbar } from './ClientsToolbar'
import type { ClientListReturnSnapshot } from './clientListReturnState'
import { useClientsListState } from './useClientsListState'

type ClientsListScreenProps = {
  canManage: boolean
  canSeeWithoutGroupQuickFilter: boolean
  initialReturnSnapshot?: ClientListReturnSnapshot | null
  previewClientId?: string | null
  onCreate: () => void
  onOpen: (clientId: string, returnSnapshot?: ClientListReturnSnapshot) => void
  onPreview: (clientId: string, returnSnapshot?: ClientListReturnSnapshot) => void
  onSaveReturnState?: (snapshot: ClientListReturnSnapshot) => void
}

export function ClientsListScreen({
  canManage,
  canSeeWithoutGroupQuickFilter,
  initialReturnSnapshot = null,
  previewClientId = null,
  onCreate,
  onOpen,
  onPreview,
  onSaveReturnState,
}: ClientsListScreenProps) {
  const state = useClientsListState({
    canSeeWithoutGroupQuickFilter,
    initialReturnSnapshot,
    previewClientId,
  })
  const previewMode = Boolean(previewClientId)

  useEffect(() => {
    onSaveReturnState?.(state.returnSnapshot)
  }, [onSaveReturnState, state.returnSnapshot])

  function openClient(clientId: string) {
    const snapshot = state.captureReturnSnapshot(clientId)
    onSaveReturnState?.(snapshot)
    onOpen(clientId, snapshot)
  }

  function previewClient(clientId: string) {
    const snapshot = state.captureReturnSnapshot(clientId)
    onSaveReturnState?.(snapshot)
    onPreview(clientId, snapshot)
  }

  return (
    <PageLayout
      className={previewMode
        ? 'clients-v7-screen clients-v7-screen--preview'
        : 'clients-v7-screen'}
      data-testid="clients-screen"
      showHeader={previewMode ? true : false}
      title={previewMode ? 'Краткая карточка' : 'Клиенты'}
    >
      <PageSection className="clients-v7-controls-section" variant="plain">
        <ClientsToolbar
          canManage={canManage}
          canSeeWithoutGroup={canSeeWithoutGroupQuickFilter}
          onCreate={onCreate}
          state={state}
        />
      </PageSection>

      <PageSection density="compact">
        <div className="clients-v7-layout" id="clients-results">
          <ClientsResults
            canManage={canManage}
            onCreate={onCreate}
            onOpen={openClient}
            onPreview={previewClient}
            state={state}
          />
          <ClientPreviewPanel canManage={canManage} onOpen={openClient} state={state} />
        </div>
      </PageSection>
    </PageLayout>
  )
}
