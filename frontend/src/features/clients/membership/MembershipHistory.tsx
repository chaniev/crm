import { Badge, Group, Paper, Stack, Table, Text } from '@mantine/core'

import type { ClientDetails, ClientMembership } from '../../../lib/api'
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
  onClientChange: (client: ClientDetails) => void
}

export function MembershipHistory({
  clientId,
  history,
  onClientChange,
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
            onClientChange={onClientChange}
          />
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
