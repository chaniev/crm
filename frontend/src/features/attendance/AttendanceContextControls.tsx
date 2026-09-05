import { ActionIcon, Button, Group, Select, TextInput } from '@mantine/core'
import { IconCalendar, IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import type { AttendanceGroup } from '../../lib/api'
import { fe4AttendanceText } from '../../resources/fe-4-attendance'


type AttendanceContextControlsProps = {
  groups: AttendanceGroup[]
  selectedGroupId: string | null
  trainingDate: string
  minTrainingDate: string | null
  maxTrainingDate: string
  today: string
  onGroupChange: (groupId: string | null) => void
  onTrainingDateChange: (trainingDate: string) => void
  progress?: ReactNode
  rosterViewControl?: ReactNode
  refreshAction?: ReactNode
}

export function AttendanceContextControls({
  groups,
  selectedGroupId,
  trainingDate,
  minTrainingDate,
  maxTrainingDate,
  today,
  onGroupChange,
  onTrainingDateChange,
  progress,
  rosterViewControl,
  refreshAction,
}: AttendanceContextControlsProps) {
  const nextDate = shiftIsoDate(trainingDate, 1)

  return (
    <div
      className="attendance-context-controls crm-context-surface"
      data-testid="attendance-toolbar"
    >
      <Select
        data-testid="attendance-group-select"
        data={groups.map((group) => ({ value: group.id, label: group.name }))}
        label={fe4AttendanceText.attendanceContextControls_label_907efbd4}
        onChange={onGroupChange}
        placeholder={fe4AttendanceText.attendanceContextControls_placeholder_298a07c0}
        searchable
        size="md"
        value={selectedGroupId}
      />
      <div className="attendance-date-control">
        <TextInput
          data-testid="attendance-date-input"
          label={fe4AttendanceText.attendanceContextControls_label_a06b48f8}
          max={maxTrainingDate}
          min={minTrainingDate ?? undefined}
          onChange={(event) => onTrainingDateChange(event.currentTarget.value)}
          size="md"
          type="date"
          value={trainingDate}
        />
        <Group className="attendance-date-actions" gap={8} wrap="nowrap">
          <ActionIcon
            aria-label={fe4AttendanceText.attendanceContextControls_ariaLabel_669d9acd}
            data-testid="attendance-date-previous"
            disabled={!trainingDate || Boolean(minTrainingDate && shiftIsoDate(trainingDate, -1) < minTrainingDate)}
            onClick={() => onTrainingDateChange(shiftIsoDate(trainingDate, -1))}
            size={44}
            title={
              minTrainingDate && shiftIsoDate(trainingDate, -1) < minTrainingDate
                ? fe4AttendanceText.attendanceContextControls_string_f9b11001
                : fe4AttendanceText.attendanceContextControls_ariaLabel_669d9acd
            }
            variant="default"
          >
            <IconChevronLeft size={20} />
          </ActionIcon>
          <Button
            aria-label={fe4AttendanceText.attendanceContextControls_ariaLabel_b688b4c0}
            data-testid="attendance-date-today"
            disabled={!today || trainingDate === today}
            leftSection={<IconCalendar aria-hidden="true" size={18} />}
            onClick={() => onTrainingDateChange(today)}
            size="md"
            title={fe4AttendanceText.attendanceContextControls_ariaLabel_b688b4c0}
            variant="default"
          >
            <span className="attendance-date-today-label">{fe4AttendanceText.attendanceContextControls_ariaLabel_b688b4c0}</span>
          </Button>
          <ActionIcon
            aria-label={fe4AttendanceText.attendanceContextControls_ariaLabel_47cce16a}
            data-testid="attendance-date-next"
            disabled={!trainingDate || !nextDate || nextDate > maxTrainingDate}
            onClick={() => onTrainingDateChange(nextDate)}
            size={44}
            title={!trainingDate || !nextDate || nextDate > maxTrainingDate ? fe4AttendanceText.attendanceContextControls_string_58b83677 : fe4AttendanceText.attendanceContextControls_ariaLabel_47cce16a}
            variant="default"
          >
            <IconChevronRight size={20} />
          </ActionIcon>
        </Group>
      </div>
      {progress ? <div className="attendance-toolbar-progress">{progress}</div> : null}
      {rosterViewControl ? <div className="attendance-toolbar-view">{rosterViewControl}</div> : null}
      {refreshAction ? <div className="attendance-toolbar-refresh">{refreshAction}</div> : null}
    </div>
  )
}

function shiftIsoDate(value: string, days: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return ''
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
