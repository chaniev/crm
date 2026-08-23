import { Badge, Group, Stack, Text } from '@mantine/core'

import type { ClientDetails, ClientMembership } from '../../../lib/api'
import { PageSection } from '../../shared/ux'
import type {
  MembershipActionMode,
  MembershipActionSubmission,
} from '../ClientManagement.types'
import { MembershipHistory } from './MembershipHistory'
import { MembershipCorrectionPanel } from './MembershipCorrectionPanel'
import { MembershipPurchasePanel } from './MembershipPurchasePanel'
import { MembershipRenewPanel } from './MembershipRenewPanel'

type ClientMembershipSectionProps = {
  actionMode: MembershipActionMode | null
  client: ClientDetails
  pending: boolean
  onCancelAction: () => void
  onSubmit: (submission: MembershipActionSubmission) => Promise<void>
  onMembershipCommentChange: (membership: ClientMembership) => void
}

export function ClientMembershipSection({
  actionMode,
  client,
  pending,
  onCancelAction,
  onSubmit,
  onMembershipCommentChange,
}: ClientMembershipSectionProps) {
  const currentMembership = client.currentMembership
  const canEditMembership = !client.isProfessional
  const canRenewFiniteProfessional =
    client.isProfessional &&
    currentMembership?.behaviorKind === 'Professional' &&
    currentMembership.expirationDate !== null

  return (
    <PageSection className="client-detail-card client-membership-card">
      <Stack gap="lg">
        <Group justify="space-between" wrap="wrap">
          <div>
            <Text fw={700}>История абонемента</Text>
            <Text c="dimmed" size="sm">
              Изменения срока, суммы и оплаты по клиенту.
            </Text>
          </div>

          <Badge color="sand" radius="sm" variant="light">
            Версий: {client.membershipHistory.length}
          </Badge>
        </Group>

        {canEditMembership && actionMode === 'purchase' ? (
          <MembershipPurchasePanel
            key={`purchase-${currentMembership?.id ?? 'empty'}`}
            branchId={client.branchId}
            businessDate={client.businessDate}
            pending={pending}
            onCancel={onCancelAction}
            onSubmit={onSubmit}
          />
        ) : null}

        {(canEditMembership || canRenewFiniteProfessional) &&
        actionMode === 'renew' &&
        currentMembership ? (
          <MembershipRenewPanel
            key={`renew-${currentMembership.id}`}
            branchId={client.branchId}
            businessDate={client.businessDate}
            currentMembership={currentMembership}
            pending={pending}
            onCancel={onCancelAction}
            onSubmit={onSubmit}
          />
        ) : null}

        {canEditMembership && actionMode === 'correct' && currentMembership ? (
          <MembershipCorrectionPanel
            key={`correct-${currentMembership.id}`}
            businessDate={client.businessDate}
            currentMembership={currentMembership}
            pending={pending}
            onCancel={onCancelAction}
            onSubmit={onSubmit}
          />
        ) : null}

        <MembershipHistory
          clientId={client.id}
          history={client.membershipHistory}
          onMembershipCommentChange={onMembershipCommentChange}
        />
      </Stack>
    </PageSection>
  )
}
