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
            <Text fw={700}>История абонемента</Text>
            <Text c="dimmed" size="sm">
              Изменения срока, суммы и оплаты по клиенту.
            </Text>
          </div>

          <Badge color="sand" radius="sm" variant="light">
            Версий: {client.membershipHistory.length}
          </Badge>
          {canPurchaseMembership ? (
            <Button
              disabled={pending}
              onClick={() => onActionModeChange('purchase')}
              variant={actionMode === 'purchase' ? 'filled' : 'light'}
            >
              Новый абонемент
            </Button>
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
              Текущих абонементов нет.
            </Text>
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
                Все группы
              </Badge>
            ) : null}
          </Group>
        </Group>
        {membership.entitlementState === 'LegacyTargetMissing' ? (
          <Text c="var(--crm-status-warning)" size="sm">
            Абонемент без групп не даёт доступ. Исправьте группы перед использованием.
          </Text>
        ) : null}
        <div className="membership-target-chip-list">
          {membership.targetGroups.length === 0 ? (
            <Badge color="yellow" radius="sm" variant="light">
              Абонемент без групп
            </Badge>
          ) : (
            membership.targetGroups.map((target) => (
              <Badge key={`${membership.id}-${target.groupId}`} radius="sm" variant="light">
                {target.position + 1} {target.position === 0 ? 'Отчётность · ' : ''}{target.groupName}
              </Badge>
            ))
          )}
        </div>
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <Info label="Сумма" value={formatCurrencyValue(membership.grossAmount)} />
          <Info label="Расчёт" value={formatMembershipPricingProvenance(membership)} />
          <Info label="Дата оплаты" value={formatDateValue(membership.paymentDate)} />
        </SimpleGrid>
        <Group gap="sm" wrap="wrap">
          {canRenew ? (
            <Button
              disabled={pending}
              onClick={() => onActionModeChange('renew', membership.id)}
              variant={actionMode === 'renew' && isSelected ? 'filled' : 'light'}
            >
              Продлить
            </Button>
          ) : null}
          {canCorrect ? (
            <Button
              disabled={pending}
              onClick={() => onActionModeChange('correct', membership.id)}
              variant={actionMode === 'correct' && isSelected ? 'filled' : 'light'}
            >
              {membership.entitlementState === 'LegacyTargetMissing' ? 'Исправить группы' : 'Исправить'}
            </Button>
          ) : null}
        </Group>
      </Stack>
    </Paper>
  )
}

const entitlementStateLabels: Record<ClientMembership['entitlementState'], string> = {
  Active: 'Активен',
  Future: 'Будущий',
  Expired: 'Истёк',
  UsedSingleVisit: 'Разовое использовано',
  LegacyTargetMissing: 'Без групп',
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
