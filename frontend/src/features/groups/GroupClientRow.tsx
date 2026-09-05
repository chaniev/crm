import { Badge, Button, Group, Paper, Stack, Text } from '@mantine/core'
import { IconUserCircle } from '@tabler/icons-react'
import type { GroupClient } from '../../lib/api'
import { fe13GroupsCoreText } from '../../resources/fe-13-groups-core'


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
              {fe13GroupsCoreText.groupClientRow_jsxText_353ad7d1}{client.phone}
            </Text>
          ) : null}
        </Stack>

        <Group className="group-client-row__meta" gap="sm" wrap="nowrap">
          <Badge radius="xl" variant="light">
            {client.status}
          </Badge>
          <Button
            aria-label={fe13GroupsCoreText.groupClientRow_template_a4942e1b(client.fullName)}
            className="group-client-profile-action"
            data-group-client-profile-action-id={client.id}
            leftSection={<IconUserCircle size={18} />}
            onClick={() => onOpenClient(client.id)}
            type="button"
            variant="light"
          >
            <span className="group-client-profile-action__label">
              {fe13GroupsCoreText.groupClientRow_jsxText_a912ec86}</span>
          </Button>
        </Group>
      </Group>
    </Paper>
  )
}
