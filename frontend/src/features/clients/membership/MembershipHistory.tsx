import { Badge, Group, Paper, Stack, Table, Text } from '@mantine/core'

import type { ClientMembership } from '../../../lib/api'
import {
  compareMembershipHistory,
  formatCurrencyValue,
  formatDateValue,
  formatExpirationValue,
  formatMembershipChangeReason,
  formatMembershipPricingProvenance,
  formatMembershipVersionDate,
  formatPaymentRecordingValue,
} from '../ClientManagement.formatting'
import { MembershipSaleComment } from './MembershipSaleComment'

type MembershipHistoryProps = {
  clientId: string
  history: ClientMembership[]
  onMembershipCommentChange: (membership: ClientMembership) => void
}

export function MembershipHistory({
  clientId,
  history,
  onMembershipCommentChange,
}: MembershipHistoryProps) {
  const sortedHistory = [...history].sort(compareMembershipHistory)
  const sales = groupMembershipVersionsBySale(sortedHistory)

  if (sortedHistory.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        История появится после первого действия с абонементом.
      </Text>
    )
  }

  return (
    <Stack gap="md">
      {sales.map(({ saleId, versions }) => (
        <Paper className="membership-sale-card" key={saleId} radius="md" withBorder>
          <MembershipSaleComment
            clientId={clientId}
            membership={versions[0]}
            onMembershipCommentChange={onMembershipCommentChange}
          />
          <div className="membership-history-card-list">
            {versions.map((membership) => (
              <Paper className="membership-history-version-card" key={membership.id} radius="8px" withBorder>
                <Stack gap="xs">
                  <Group gap="xs" wrap="wrap">
                    <Text fw={700} size="sm">
                      {membership.membershipName}
                    </Text>
                    <Badge radius="sm" variant="light">
                      {formatMembershipChangeReason(membership.changeReason)}
                    </Badge>
                    {membership.validTo ? null : (
                      <Badge color="teal" radius="sm" variant="light">
                        Текущая
                      </Badge>
                    )}
                  </Group>
                  <Text c="dimmed" size="sm">
                    {formatDateValue(membership.purchaseDate)} -{' '}
                    {formatExpirationValue(
                      membership.behaviorKind,
                      membership.expirationDate,
                    )}
                  </Text>
                  <TargetGroupsLine membership={membership} />
                  <Text size="sm">{formatCurrencyValue(membership.grossAmount)}</Text>
                  <Text c="dimmed" size="xs">
                    {formatDateValue(membership.paymentDate)} · {formatPaymentRecordingValue(membership)}
                  </Text>
                  <Text c="dimmed" size="xs">
                    Версия: {formatMembershipVersionDate(membership)}
                  </Text>
                </Stack>
              </Paper>
            ))}
          </div>
          <div className="membership-history-table-wrap">
            <Table
              className="membership-history-table"
              horizontalSpacing="md"
              verticalSpacing="sm"
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Событие</Table.Th>
                  <Table.Th>Период</Table.Th>
                  <Table.Th>Группы</Table.Th>
                  <Table.Th>Сумма</Table.Th>
                  <Table.Th>Дата оплаты</Table.Th>
                  <Table.Th>Дата версии</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {versions.map((membership) => (
                  <Table.Tr key={membership.id}>
                    <Table.Td>
                      <Group gap="xs" wrap="wrap">
                        <Text fw={700} size="sm">
                          {membership.membershipName}
                        </Text>
                        <Badge radius="sm" variant="light">
                          {formatMembershipChangeReason(membership.changeReason)}
                        </Badge>
                        {membership.validTo ? null : (
                          <Badge color="teal" radius="sm" variant="light">
                            Текущая
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text c="dimmed" size="sm">
                        {formatDateValue(membership.purchaseDate)} -{' '}
                        {formatExpirationValue(
                          membership.behaviorKind,
                          membership.expirationDate,
                        )}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <TargetGroupsLine membership={membership} />
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={2}>
                        <Text size="sm">
                          {formatCurrencyValue(membership.grossAmount)}
                        </Text>
                        <Text c="dimmed" size="xs">
                          {formatMembershipPricingProvenance(membership)}
                        </Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={2}>
                        <Text size="sm">
                          {formatDateValue(membership.paymentDate)}
                        </Text>
                        <Text c="dimmed" size="xs">
                          {formatPaymentRecordingValue(membership)}
                        </Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Text c="dimmed" size="sm">
                        {formatMembershipVersionDate(membership)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>
        </Paper>
      ))}
    </Stack>
  )
}

function groupMembershipVersionsBySale(history: ClientMembership[]) {
  const sales = new Map<string, ClientMembership[]>()
  for (const membership of history) {
    const versions = sales.get(membership.saleId) ?? []
    versions.push(membership)
    sales.set(membership.saleId, versions)
  }
  return [...sales].map(([saleId, versions]) => ({ saleId, versions }))
}

function TargetGroupsLine({ membership }: { membership: ClientMembership }) {
  const targetGroups = membership.targetGroups ?? []

  if (targetGroups.length === 0) {
    return (
      <Badge color="yellow" radius="sm" variant="light">
        Абонемент без групп
      </Badge>
    )
  }

  return (
    <Group gap={6} wrap="wrap">
      {targetGroups.map((target) => (
        <Badge key={`${membership.id}-${target.groupId}`} radius="sm" variant="light">
          {target.position + 1} {target.position === 0 ? 'Отчётность · ' : ''}{target.groupName}
        </Badge>
      ))}
    </Group>
  )
}
