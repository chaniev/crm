import { PageLayout, PageSection } from '../../shared/ux'
import { ClientPreviewPanel } from './ClientPreviewPanel'
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
