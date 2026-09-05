import {
  ActionIcon,
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
  IconCreditCard,
  IconExternalLink,
  IconMessage,
  IconRefresh,
  IconUserHeart,
  IconX,
} from '@tabler/icons-react'
import { buildClientPreviewViewModel } from './clientListViewModel'
import type { ClientsListState } from './useClientsListState'
import { fe5ClientListText } from '../../../resources/fe-5-client-list'


type ClientPreviewPanelProps = {
  canManage: boolean
  state: ClientsListState
  onOpen: (clientId: string) => void
  onCollapse: () => void
}

export function ClientPreviewPanel({
  canManage,
  state,
  onOpen,
  onCollapse,
}: ClientPreviewPanelProps) {
  const selectedClientId = state.selectedClientId

  if (!selectedClientId) {
    return (
      <Paper className="clients-v7-preview" data-testid="client-preview-panel" withBorder>
        <Text c="dimmed" size="sm">
          {fe5ClientListText.clientPreviewPanel_jsxText_efa5d3cd}</Text>
      </Paper>
    )
  }

  if (state.previewLoading && !state.selectedPreview) {
    return (
      <Paper className="clients-v7-preview" data-testid="client-preview-panel" withBorder>
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
      <Paper className="clients-v7-preview" data-testid="client-preview-panel" withBorder>
        <Stack gap="sm">
          <PreviewPanelHeader onCollapse={onCollapse} />
          <Alert
            color="red"
            icon={<IconAlertCircle size={18} />}
            title={fe5ClientListText.clientPreviewPanel_title_85a05a71}
            variant="light"
          >
            {state.previewError}
          </Alert>
          <Group gap="xs" wrap="wrap">
            <Button
              leftSection={<IconRefresh size={16} />}
              onClick={state.reloadPreview}
              variant="light"
            >
              {fe5ClientListText.clientPreviewPanel_jsxText_5189135a}</Button>
            <Button
              leftSection={<IconExternalLink size={16} />}
              onClick={() => onOpen(selectedClientId)}
              variant="default"
            >
              {fe5ClientListText.clientPreviewPanel_jsxText_82efa6ea}</Button>
          </Group>
        </Stack>
      </Paper>
    )
  }

  if (!state.selectedPreview) {
    return (
      <Paper className="clients-v7-preview" data-testid="client-preview-panel" withBorder>
        <Text c="dimmed" size="sm">
          {fe5ClientListText.clientPreviewPanel_jsxText_e869584b}</Text>
      </Paper>
    )
  }

  const preview = buildClientPreviewViewModel(state.selectedPreview, canManage)

  return (
    <Paper className="clients-v7-preview" data-testid="client-preview-panel" withBorder>
      <Stack gap="md">
        <PreviewPanelHeader onCollapse={onCollapse} />
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
            {fe5ClientListText.clientPreviewPanel_jsxText_1e125223}</Text>
          <Group gap="xs" mt={6}>
            <Badge color={preview.nextAction.tone} variant="filled">
              {preview.nextAction.label}
            </Badge>
            {preview.nextAction.description ? (
              <Text size="sm">{preview.nextAction.description}</Text>
            ) : null}
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
            {fe5ClientListText.clientPreviewPanel_jsxText_18e1009d}</Text>
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
              {fe5ClientListText.clientPreviewPanel_jsxText_3d64c6af}</Text>
          )}
        </Stack>

        <div className="clients-v7-preview__actions">
          {canManage ? (
            <>
              <Button
                leftSection={<IconCreditCard size={16} />}
                onClick={() => onOpen(selectedClientId)}
                variant="default"
              >
                {fe5ClientListText.clientPreviewPanel_jsxText_63e29a54}</Button>
              <Button
                leftSection={<IconMessage size={16} />}
                onClick={() => onOpen(selectedClientId)}
                variant="default"
              >
                {fe5ClientListText.clientPreviewPanel_jsxText_3e0ccd92}</Button>
              <Button
                leftSection={<IconCalendarCheck size={16} />}
                onClick={() => onOpen(selectedClientId)}
                variant="default"
              >
                {fe5ClientListText.clientPreviewPanel_jsxText_ba936c58}</Button>
            </>
          ) : null}
          <Button
            leftSection={canManage ? <IconExternalLink size={16} /> : <IconUserHeart size={16} />}
            onClick={() => onOpen(selectedClientId)}
            variant={canManage ? 'default' : 'light'}
          >
            {fe5ClientListText.clientPreviewPanel_jsxText_82efa6ea}</Button>
        </div>
      </Stack>
    </Paper>
  )
}

function PreviewPanelHeader({ onCollapse }: { onCollapse: () => void }) {
  return (
    <Group className="clients-v7-preview__header" justify="flex-end">
      <ActionIcon
        aria-label={fe5ClientListText.clientPreviewPanel_ariaLabel_a0f74e3c}
        onClick={onCollapse}
        size={44}
        variant="subtle"
      >
        <IconX aria-hidden="true" size={18} />
      </ActionIcon>
    </Group>
  )
}
