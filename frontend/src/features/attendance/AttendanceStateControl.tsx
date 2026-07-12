import { Radio, Text } from '@mantine/core'
import type { AttendanceState } from '../../lib/api'

type AttendanceStateControlProps = {
  clientName: string
  disabled: boolean
  value: AttendanceState
  onChange: (state: AttendanceState) => void
}

const options: Array<{ label: string; value: AttendanceState }> = [
  { label: 'Не отмечено', value: 'Unmarked' },
  { label: 'Был', value: 'Present' },
  { label: 'Не был', value: 'Absent' },
]

export function AttendanceStateControl({ clientName, disabled, value, onChange }: AttendanceStateControlProps) {
  return (
    <Radio.Group
      aria-label={`Посещение: ${clientName}`}
      disabled={disabled}
      onChange={(nextValue) => onChange(nextValue as AttendanceState)}
      value={value}
    >
      <div className="attendance-state-control">
        {options.map((option) => (
          <Radio.Card
            aria-label={option.label}
            className="attendance-state-option"
            key={option.value}
            value={option.value}
          >
            <Text fw={600} size="sm">{option.label}</Text>
          </Radio.Card>
        ))}
      </div>
    </Radio.Group>
  )
}
