import { Badge, Button, Group, Paper, Stack, Text } from '@mantine/core'
import { IconUserCircle } from '@tabler/icons-react'
import type { GroupClient } from '../../lib/api'

type GroupClientRowProps = {
  client: GroupClient
  onOpenClient: (clientId: string) => void
}

export function GroupClientRow({ client, onOpenClient }: GroupClientRowProps) {
  return (
    <Paper
      className="list-row-card group-client-row"
      data-testid={`group-client-row-${client.id}`}
      radius="24px"
      withBorder
    >
      <Group className="group-client-row__content" justify="space-between" wrap="nowrap">
        <Stack className="group-client-row__identity" gap={6}>
          <Text fw={700}>{client.fullName}</Text>
          {client.phone ? (
            <Text c="dimmed" size="sm">
              Телефон: {client.phone}
            </Text>
          ) : null}
        </Stack>

        <Group className="group-client-row__meta" gap="sm" wrap="nowrap">
          <Badge radius="xl" variant="light">
            {client.status}
          </Badge>
          <Button
            aria-label={`Открыть карточку клиента ${client.fullName}`}
            className="group-client-profile-action"
            data-group-client-profile-action-id={client.id}
            leftSection={<IconUserCircle size={18} />}
            onClick={() => onOpenClient(client.id)}
            type="button"
            variant="light"
          >
            <span className="group-client-profile-action__label">
              Карточка клиента
            </span>
          </Button>
        </Group>
      </Group>
    </Paper>
  )
}
