import type { ClientProfileOriginInput } from '../clients/clientProfileReturnState'
import { PageLayout } from '../shared/ux'
import { AttentionPanel } from './AttentionPanel'
import { fe9AttentionText } from '../../resources/fe-9-attention'


type AttentionDashboardProps = {
  focusOnReturn?: boolean
  onOpenClient?: (clientId: string, origin?: ClientProfileOriginInput | null) => void
}

export function AttentionDashboard({ onOpenClient, focusOnReturn }: AttentionDashboardProps) {
  return (
    <PageLayout
      className="attention-dashboard"
      data-testid="attention-screen"
      showHeader={false}
      title={fe9AttentionText.attentionDashboard_title_f17ceff0}
    >
      <AttentionPanel focusOnReturn={focusOnReturn} onOpenClient={onOpenClient ? (clientId) => onOpenClient(clientId, {
        kind: 'attention', route: { kind: 'section', section: 'Attention' }, anchorClientId: clientId,
      }) : undefined} />
    </PageLayout>
  )
}
