import { Group, Loader, Text } from '@mantine/core'
import { IconAlertCircle, IconCheck } from '@tabler/icons-react'
import { Button } from '../shared/ux'
import type { AttendanceSaveState } from './types'
import { fe4AttendanceText } from '../../resources/fe-4-attendance'


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
    return <Group aria-live="polite" gap={6}><Loader size={14} /><Text c="dimmed" size="sm">{fe4AttendanceText.attendanceSaveStatus_jsxText_9c27c381}</Text></Group>
  }

  if (saveState === 'failed') {
    return (
      <Group aria-live="polite" className="attendance-save-error" gap="xs" wrap="wrap">
        <IconAlertCircle aria-hidden="true" size={16} />
        <Text size="sm">{fe4AttendanceText.attendanceSaveStatus_jsxText_c5805f8b}{errorMessage ? `: ${errorMessage}` : ''}</Text>
        <Button className="attendance-retry-button" onClick={onRetry} variant="subtle">{fe4AttendanceText.attendanceSaveStatus_jsxText_5189135a}</Button>
      </Group>
    )
  }

  if (saveState === 'saved') {
    return <Group aria-live="polite" gap={6}><IconCheck aria-hidden="true" size={16} /><Text c="dimmed" size="sm">{fe4AttendanceText.attendanceSaveStatus_jsxText_2fe8f2fd}</Text></Group>
  }

  return <Text c="dimmed" size="sm">{fe4AttendanceText.attendanceSaveStatus_jsxText_90777d97}</Text>
}
