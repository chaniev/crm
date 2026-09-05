import { useCallback, useEffect, useRef, useState } from 'react'
import { PageLayout, PageSection } from '../../shared/ux'
import { ClientPreviewPanel } from './ClientPreviewPanel'
import { ClientsResults } from './ClientsResults'
import { ClientsToolbar } from './ClientsToolbar'
import { canUseClientsPreviewSplit } from './clientListPreviewLayout'
import type { ClientListReturnSnapshot } from './clientListReturnState'
import { useClientsListState } from './useClientsListState'
import { fe5ClientListText } from '../../../resources/fe-5-client-list'


type ClientsListScreenProps = {
  canManage: boolean
  canSeeWithoutGroupQuickFilter: boolean
  currentUserBranchId: string | null
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
  currentUserBranchId,
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
  const layoutRef = useRef<HTMLDivElement | null>(null)
  const [isPreviewSplitCapable, setIsPreviewSplitCapable] = useState(false)
  const showPreviewPanel =
    previewMode || (isPreviewSplitCapable && state.previewIntent === 'expanded')

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

  const collapsePreview = useCallback(() => {
    state.setPreviewIntent('collapsed')

    const selectedClientId = state.selectedClientId
    if (!selectedClientId) {
      return
    }

    window.requestAnimationFrame(() => {
      const selectedRow = document.querySelector<HTMLElement>(
        `[data-client-row-id="${window.CSS.escape(selectedClientId)}"]`,
      )
      selectedRow?.focus({ preventScroll: true })
    })
  }, [state])

  useEffect(() => {
    const layoutElement = layoutRef.current

    if (!layoutElement || previewMode) {
      return
    }

    function updateSplitCapability(width: number) {
      setIsPreviewSplitCapable(canUseClientsPreviewSplit(width))
    }

    const frameId = window.requestAnimationFrame(() => {
      updateSplitCapability(layoutElement.getBoundingClientRect().width)
    })

    if (typeof ResizeObserver === 'undefined') {
      return () => window.cancelAnimationFrame(frameId)
    }

    const observer = new ResizeObserver(([entry]) => {
      updateSplitCapability(entry?.contentRect.width ?? 0)
    })

    observer.observe(layoutElement)

    return () => {
      window.cancelAnimationFrame(frameId)
      observer.disconnect()
    }
  }, [previewMode])

  return (
    <PageLayout
      className={previewMode
        ? 'clients-v7-screen clients-v7-screen--preview'
        : 'clients-v7-screen'}
      data-testid="clients-screen"
      showHeader={previewMode ? true : false}
      title={previewMode ? fe5ClientListText.clientsListScreen_string_24dfeca0 : fe5ClientListText.clientsListScreen_string_ff296dda}
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
        <div
          className="clients-v7-layout"
          data-client-preview-layout={
            previewMode
              ? 'route-preview'
              : isPreviewSplitCapable
                ? state.previewIntent
                : 'fallback'
          }
          id="clients-results"
          ref={layoutRef}
        >
          <ClientsResults
            canManage={canManage}
            currentUserBranchId={currentUserBranchId}
            isSplitLayout={!previewMode && isPreviewSplitCapable}
            onOpen={openClient}
            onPreview={previewClient}
            state={state}
          />
          {showPreviewPanel ? (
            <ClientPreviewPanel
              canManage={canManage}
              onCollapse={collapsePreview}
              onOpen={openClient}
              state={state}
            />
          ) : null}
        </div>
      </PageSection>
    </PageLayout>
  )
}
