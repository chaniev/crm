import { Group, Loader, Text } from '@mantine/core'
import { IconAlertCircle, IconCheck } from '@tabler/icons-react'
import { Button } from '../shared/ux'
import type { AttendanceSaveState } from './types'

type AttendanceSaveStatusProps = {
  saveState: AttendanceSaveState
  errorMessage: string | null
  onRetry: () => void
}

export function AttendanceSaveStatus({
  saveState,
  errorMessage,
  onRetry,
}: AttendanceSaveStatusProps) {
  if (saveState === 'pending') {
    return <Group aria-live="polite" gap={6}><Loader size={14} /><Text c="dimmed" size="sm">Сохраняем…</Text></Group>
  }

  if (saveState === 'failed') {
    return (
      <Group aria-live="polite" className="attendance-save-error" gap="xs" wrap="wrap">
        <IconAlertCircle aria-hidden="true" size={16} />
        <Text size="sm">Не сохранено{errorMessage ? `: ${errorMessage}` : ''}</Text>
        <Button className="attendance-retry-button" onClick={onRetry} variant="subtle">Повторить</Button>
      </Group>
    )
  }

  if (saveState === 'saved') {
    return <Group aria-live="polite" gap={6}><IconCheck aria-hidden="true" size={16} /><Text c="dimmed" size="sm">Сохранено</Text></Group>
  }

  return <Text c="dimmed" size="sm">Выберите состояние</Text>
}
