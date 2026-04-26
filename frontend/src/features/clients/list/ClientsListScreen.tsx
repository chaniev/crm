import { Stack } from '@mantine/core'
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
    <Stack className="dashboard-stack clients-v7-screen" data-testid="clients-screen" gap="md">
      <ClientsToolbar canManage={canManage} onCreate={onCreate} state={state} />
      <ClientsQuickFilters state={state} />

      <div className="clients-v7-layout">
        <ClientsResults
          canManage={canManage}
          onCreate={onCreate}
          onOpen={onOpen}
          state={state}
        />
        <ClientPreviewPanel canManage={canManage} onOpen={onOpen} state={state} />
      </div>
    </Stack>
  )
}
