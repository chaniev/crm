import { Badge, Button, Group, Paper, SimpleGrid, Stack, Text } from '@mantine/core'

import type { ClientDetails, ClientMembership } from '../../../lib/api'
import { PageSection } from '../../shared/ux'
import {
  formatCurrencyValue,
  formatDateValue,
  formatExpirationValue,
  formatMembershipPricingProvenance,
} from '../ClientManagement.formatting'
import type {
  MembershipActionMode,
  MembershipActionSubmission,
} from '../ClientManagement.types'
import { MembershipHistory } from './MembershipHistory'
import { MembershipCorrectionPanel } from './MembershipCorrectionPanel'
import { MembershipGroupTransferSurface } from './MembershipGroupTransferSurface'
import { MembershipPurchasePanel } from './MembershipPurchasePanel'
import { MembershipRenewPanel } from './MembershipRenewPanel'
import { fe7ClientMembershipText } from '../../../resources/fe-7-client-membership'


type ClientMembershipSectionProps = {
  actionMode: MembershipActionMode | null
  client: ClientDetails
  pending: boolean
  selectedMembershipId: string | null
  onCancelAction: () => void
  onActionModeChange: (mode: MembershipActionMode, membershipId?: string) => void
  onClientChange: (client: ClientDetails) => void
  onSubmit: (submission: MembershipActionSubmission) => Promise<void>
  onMembershipCommentChange: (membership: ClientMembership) => void
}

export function ClientMembershipSection({
  actionMode,
  client,
  pending,
  selectedMembershipId,
  onCancelAction,
  onActionModeChange,
  onClientChange,
  onSubmit,
  onMembershipCommentChange,
}: ClientMembershipSectionProps) {
  const canPurchaseMembership = !client.isProfessional
  const canCorrectMembership = true
  const currentMemberships = client.currentMemberships
  const selectedMembership =
    selectedMembershipId
      ? currentMemberships.find((membership) => membership.id === selectedMembershipId) ?? null
      : null

  return (
    <PageSection className="client-detail-card client-membership-card">
      <Stack gap="lg">
        <Group justify="space-between" wrap="wrap">
          <div>
            <Text fw={700}>{fe7ClientMembershipText.clientMembershipSection_jsxText_bf6f178a}</Text>
            <Text c="dimmed" size="sm">
              {fe7ClientMembershipText.clientMembershipSection_jsxText_55ab75c7}</Text>
          </div>

          <Badge color="sand" radius="sm" variant="light">
            {fe7ClientMembershipText.clientMembershipSection_jsxText_2239797e}{client.membershipHistory.length}
          </Badge>
          {canPurchaseMembership ? (
            <Button
              disabled={pending}
              onClick={() => onActionModeChange('purchase')}
              variant={actionMode === 'purchase' ? 'filled' : 'light'}
            >
              {fe7ClientMembershipText.clientMembershipSection_jsxText_a946d490}</Button>
          ) : null}
        </Group>

        {canPurchaseMembership && actionMode === 'purchase' ? (
          <MembershipPurchasePanel
            key="purchase"
            branchId={client.branchId}
            businessDate={client.businessDate}
            pending={pending}
            onCancel={onCancelAction}
            onSubmit={onSubmit}
          />
        ) : null}

        {actionMode === 'renew' && selectedMembership ? (
          <MembershipRenewPanel
            key={`renew-${selectedMembership.id}`}
            branchId={client.branchId}
            businessDate={client.businessDate}
            currentMembership={selectedMembership}
            pending={pending}
            onCancel={onCancelAction}
            onSubmit={onSubmit}
          />
        ) : null}

        {canCorrectMembership && actionMode === 'correct' && selectedMembership ? (
          <MembershipCorrectionPanel
            key={`correct-${selectedMembership.id}`}
            businessDate={client.businessDate}
            currentMembership={selectedMembership}
            pending={pending}
            onCancel={onCancelAction}
            onSubmit={onSubmit}
          />
        ) : null}

        <Stack gap="sm">
          {currentMemberships.length === 0 ? (
            <Text c="dimmed" size="sm">
              {fe7ClientMembershipText.clientMembershipSection_jsxText_10110ccf}</Text>
          ) : (
            currentMemberships.map((membership) => (
              <CurrentMembershipCard
                actionMode={actionMode}
                key={membership.id}
                membership={membership}
                pending={pending}
                selectedMembershipId={selectedMembershipId}
                canCorrect={canCorrectMembership}
                onActionModeChange={onActionModeChange}
              />
            ))
          )}
        </Stack>

        {currentMemberships.length > 0 ? (
          <MembershipGroupTransferSurface
            client={client}
            pending={pending}
            onTransferred={onClientChange}
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

type CurrentMembershipCardProps = {
  actionMode: MembershipActionMode | null
  canCorrect: boolean
  membership: ClientMembership
  pending: boolean
  selectedMembershipId: string | null
  onActionModeChange: (mode: MembershipActionMode, membershipId?: string) => void
}

function CurrentMembershipCard({
  actionMode,
  canCorrect,
  membership,
  pending,
  selectedMembershipId,
  onActionModeChange,
}: CurrentMembershipCardProps) {
  const canRenew =
    membership.behaviorKind !== 'SingleVisit' &&
    membership.entitlementState !== 'LegacyTargetMissing'
  const isSelected = selectedMembershipId === membership.id

  return (
    <Paper className="current-membership-card" radius="8px" withBorder>
      <Stack gap="sm">
        <Group justify="space-between" wrap="wrap">
          <div>
            <Text fw={700}>{membership.membershipName}</Text>
            <Text c="dimmed" size="sm">
              {formatExpirationValue(membership.behaviorKind, membership.expirationDate)}
            </Text>
          </div>
          <Group gap="xs" wrap="wrap">
            <Badge radius="sm" variant="light">
              {entitlementStateLabels[membership.entitlementState]}
            </Badge>
            {membership.coverageKind === 'AllGroups' ? (
              <Badge color="blue" radius="sm" variant="light">
                {fe7ClientMembershipText.clientMembershipSection_jsxText_d71b0c68}</Badge>
            ) : null}
          </Group>
        </Group>
        {membership.entitlementState === 'LegacyTargetMissing' ? (
          <Text c="var(--crm-status-warning)" size="sm">
            {fe7ClientMembershipText.clientMembershipSection_jsxText_71606622}</Text>
        ) : null}
        <div className="membership-target-chip-list">
          {membership.targetGroups.length === 0 ? (
            <Badge color="yellow" radius="sm" variant="light">
              {fe7ClientMembershipText.clientMembershipSection_jsxText_9a0b1924}</Badge>
          ) : (
            membership.targetGroups.map((target) => (
              <Badge key={`${membership.id}-${target.groupId}`} radius="sm" variant="light">
                {target.position + 1} {target.position === 0 ? fe7ClientMembershipText.clientMembershipSection_string_68f7b035 : ''}{target.groupName}
              </Badge>
            ))
          )}
        </div>
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <Info label={fe7ClientMembershipText.clientMembershipSection_label_46a0edbb} value={formatCurrencyValue(membership.grossAmount)} />
          <Info label={fe7ClientMembershipText.clientMembershipSection_label_b3ae4c00} value={formatMembershipPricingProvenance(membership)} />
          <Info label={fe7ClientMembershipText.clientMembershipSection_label_6611d56d} value={formatDateValue(membership.paymentDate)} />
        </SimpleGrid>
        <Group gap="sm" wrap="wrap">
          {canRenew ? (
            <Button
              disabled={pending}
              onClick={() => onActionModeChange('renew', membership.id)}
              variant={actionMode === 'renew' && isSelected ? 'filled' : 'light'}
            >
              {fe7ClientMembershipText.clientMembershipSection_jsxText_659ad690}</Button>
          ) : null}
          {canCorrect ? (
            <Button
              disabled={pending}
              onClick={() => onActionModeChange('correct', membership.id)}
              variant={actionMode === 'correct' && isSelected ? 'filled' : 'light'}
            >
              {membership.entitlementState === 'LegacyTargetMissing' ? fe7ClientMembershipText.clientMembershipSection_string_de3830e7 : fe7ClientMembershipText.clientMembershipSection_string_8d0e3e8b}
            </Button>
          ) : null}
        </Group>
      </Stack>
    </Paper>
  )
}

const entitlementStateLabels: Record<ClientMembership['entitlementState'], string> = {
  Active: fe7ClientMembershipText.clientMembershipSection_active_a87a4b39,
  Future: fe7ClientMembershipText.clientMembershipSection_future_a01345ca,
  Expired: fe7ClientMembershipText.clientMembershipSection_expired_85d3fd5f,
  UsedSingleVisit: fe7ClientMembershipText.clientMembershipSection_usedSingleVisit_a091d291,
  LegacyTargetMissing: fe7ClientMembershipText.clientMembershipSection_legacyTargetMissing_214235ce,
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="compact-info-item">
      <Text c="dimmed" fw={600} size="xs">
        {label}
      </Text>
      <Text fw={700} size="sm">
        {value}
      </Text>
    </div>
  )
}
