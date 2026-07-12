import { ActionIcon, Button, Group, Select, TextInput } from '@mantine/core'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import type { AttendanceGroup } from '../../lib/api'

type AttendanceContextControlsProps = {
  groups: AttendanceGroup[]
  selectedGroupId: string | null
  trainingDate: string
  maxTrainingDate: string
  today: string
  onGroupChange: (groupId: string | null) => void
  onTrainingDateChange: (trainingDate: string) => void
}

export function AttendanceContextControls({
  groups,
  selectedGroupId,
  trainingDate,
  maxTrainingDate,
  today,
  onGroupChange,
  onTrainingDateChange,
}: AttendanceContextControlsProps) {
  const nextDate = shiftIsoDate(trainingDate, 1)

  return (
    <div className="attendance-context-controls" data-testid="attendance-toolbar">
      <Select
        data-testid="attendance-group-select"
        data={groups.map((group) => ({ value: group.id, label: group.name }))}
        label="Группа"
        onChange={onGroupChange}
        placeholder="Выберите группу"
        searchable
        size="md"
        value={selectedGroupId}
      />
      <div className="attendance-date-control">
        <TextInput
          data-testid="attendance-date-input"
          label="Дата тренировки"
          max={maxTrainingDate}
          onChange={(event) => onTrainingDateChange(event.currentTarget.value)}
          size="md"
          type="date"
          value={trainingDate}
        />
        <Group gap={6} wrap="nowrap">
          <ActionIcon
            aria-label="Предыдущая дата"
            data-testid="attendance-date-previous"
            disabled={!trainingDate}
            onClick={() => onTrainingDateChange(shiftIsoDate(trainingDate, -1))}
            size={44}
            variant="default"
          >
            <IconChevronLeft size={20} />
          </ActionIcon>
          <Button
            aria-label="Сегодня"
            data-testid="attendance-date-today"
            disabled={!today || trainingDate === today}
            onClick={() => onTrainingDateChange(today)}
            size="md"
            variant="default"
          >
            Сегодня
          </Button>
          <ActionIcon
            aria-label="Следующая дата"
            data-testid="attendance-date-next"
            disabled={!trainingDate || !nextDate || nextDate > maxTrainingDate}
            onClick={() => onTrainingDateChange(nextDate)}
            size={44}
            title={!trainingDate || !nextDate || nextDate > maxTrainingDate ? 'Будущие даты недоступны' : 'Следующая дата'}
            variant="default"
          >
            <IconChevronRight size={20} />
          </ActionIcon>
        </Group>
      </div>
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
