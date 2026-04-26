import {
  Alert,
  Avatar,
  Badge,
  Button,
  Divider,
  Group,
  Paper,
  Skeleton,
  Stack,
  Text,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconCalendarCheck,
  IconEdit,
  IconUserHeart,
} from '@tabler/icons-react'
import { buildClientPreviewViewModel } from './clientListViewModel'
import type { ClientsListState } from './useClientsListState'

type ClientPreviewPanelProps = {
  canManage: boolean
  state: ClientsListState
  onOpen: (clientId: string) => void
}

export function ClientPreviewPanel({
  canManage,
  state,
  onOpen,
}: ClientPreviewPanelProps) {
  const selectedClientId = state.selectedClientId

  if (!selectedClientId) {
    return (
      <Paper className="clients-v7-preview" withBorder>
        <Text c="dimmed" size="sm">
          Выберите клиента в списке.
        </Text>
      </Paper>
    )
  }

  if (state.previewLoading && !state.selectedPreview) {
    return (
      <Paper className="clients-v7-preview" withBorder>
        <Stack gap="sm">
          <Skeleton circle height={56} />
          <Skeleton height={18} />
          <Skeleton height={14} width="70%" />
          <Divider />
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton height={28} key={index} />
          ))}
        </Stack>
      </Paper>
    )
  }

  if (state.previewError && !state.selectedPreview) {
    return (
      <Paper className="clients-v7-preview" withBorder>
        <Alert
          color="red"
          icon={<IconAlertCircle size={18} />}
          title="Preview не загрузился"
          variant="light"
        >
          {state.previewError}
        </Alert>
      </Paper>
    )
  }

  if (!state.selectedPreview) {
    return (
      <Paper className="clients-v7-preview" withBorder>
        <Text c="dimmed" size="sm">
          Загружаем краткую карточку.
        </Text>
      </Paper>
    )
  }

  const preview = buildClientPreviewViewModel(state.selectedPreview, canManage)

  return (
    <Paper className="clients-v7-preview" withBorder>
      <Stack gap="md">
        <Group align="flex-start" gap="sm" wrap="nowrap">
          <Avatar
            name={preview.fullName}
            radius="xl"
            size={56}
            src={preview.photoUrl}
          />
          <div>
            <Text fw={800}>{preview.fullName}</Text>
            {preview.phoneLabel ? (
              <Text c="dimmed" size="sm">
                {preview.phoneLabel}
              </Text>
            ) : null}
            <Badge
              color={state.selectedPreview.status === 'Active' ? 'teal' : 'gray'}
              mt={6}
              variant="light"
            >
              {preview.statusLabel}
            </Badge>
          </div>
        </Group>

        <Paper className="clients-v7-preview__need" radius="md">
          <Text c="dimmed" size="xs" tt="uppercase">
            Нужно сейчас
          </Text>
          <Group gap="xs" mt={6}>
            <Badge color={preview.nextAction.tone} variant="filled">
              {preview.nextAction.label}
            </Badge>
            <Text size="sm">{preview.nextAction.description}</Text>
          </Group>
        </Paper>

        <Stack gap={8}>
          {preview.facts.map((fact) => (
            <Group justify="space-between" key={fact.label} wrap="nowrap">
              <Text c="dimmed" size="sm">
                {fact.label}
              </Text>
              <Text fw={600} size="sm" ta="right">
                {fact.value}
              </Text>
            </Group>
          ))}
        </Stack>

        <Divider />

        <Stack gap={8}>
          <Text fw={700} size="sm">
            Последние события
          </Text>
          {preview.events.length > 0 ? (
            preview.events.map((event, index) => (
              <Group justify="space-between" key={`${event.label}-${index}`} wrap="nowrap">
                <Text size="sm">{event.label}</Text>
                <Text c="dimmed" size="sm" ta="right">
                  {event.value}
                </Text>
              </Group>
            ))
          ) : (
            <Text c="dimmed" size="sm">
              Событий пока нет
            </Text>
          )}
        </Stack>

        <Group grow>
          <Button
            leftSection={<IconUserHeart size={16} />}
            onClick={() => onOpen(selectedClientId)}
            variant="light"
          >
            Открыть
          </Button>
          <Button
            component="a"
            href="/attendance"
            leftSection={<IconCalendarCheck size={16} />}
            variant="default"
          >
            Визит
          </Button>
          {canManage ? (
            <Button
              component="a"
              href={`/clients/${encodeURIComponent(selectedClientId)}/edit`}
              leftSection={<IconEdit size={16} />}
              variant="default"
            >
              Редактировать
            </Button>
          ) : null}
        </Group>
      </Stack>
    </Paper>
  )
}
