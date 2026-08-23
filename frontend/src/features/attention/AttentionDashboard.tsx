import type { ClientProfileOriginInput } from '../clients/clientProfileReturnState'
import { PageLayout } from '../shared/ux'
import { AttentionPanel } from './AttentionPanel'

type AttentionDashboardProps = {
  onOpenClient?: (clientId: string, origin?: ClientProfileOriginInput | null) => void
}

export function AttentionDashboard({ onOpenClient }: AttentionDashboardProps) {
  return (
    <PageLayout
      className="attention-dashboard"
      data-testid="attention-screen"
      showHeader={false}
      title="Внимание"
    >
      <AttentionPanel onOpenClient={onOpenClient} />
    </PageLayout>
  )
}
