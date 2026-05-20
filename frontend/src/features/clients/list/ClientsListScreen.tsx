import { Stack } from '@mantine/core'
import { PageLayout, PageSection } from '../../shared/ux'
import { ClientPreviewPanel } from './ClientPreviewPanel'
import { ClientsQuickFilters } from './ClientsQuickFilters'
import { ClientsResults } from './ClientsResults'
import { ClientsToolbar } from './ClientsToolbar'
import { useClientsListState } from './useClientsListState'

type ClientsListScreenProps = {
  canManage: boolean
  onCreate: () => void
  onOpen: (clientId: string) => void
}

export function ClientsListScreen({
  canManage,
  onCreate,
  onOpen,
}: ClientsListScreenProps) {
  const state = useClientsListState()

  return (
    <PageLayout
      className="clients-v7-screen"
      data-testid="clients-screen"
      title="Клиенты"
    >
      <PageSection>
        <Stack gap="md">
          <ClientsToolbar canManage={canManage} onCreate={onCreate} state={state} />
          <ClientsQuickFilters state={state} />
        </Stack>
      </PageSection>

      <PageSection density="compact">
        <div className="clients-v7-layout">
          <ClientsResults
            canManage={canManage}
            onCreate={onCreate}
            onOpen={onOpen}
            state={state}
          />
          <ClientPreviewPanel canManage={canManage} onOpen={onOpen} state={state} />
        </div>
      </PageSection>
    </PageLayout>
  )
}
