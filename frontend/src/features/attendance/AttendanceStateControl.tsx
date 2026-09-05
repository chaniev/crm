import { Radio, Text } from '@mantine/core'
import type { AttendanceState } from '../../lib/api'
import { fe4AttendanceText } from '../../resources/fe-4-attendance'


type AttendanceStateControlProps = {
  clientName: string
  disabled: boolean
  value: AttendanceState
  onChange: (state: AttendanceState) => void
}

const options: Array<{ label: string; value: AttendanceState }> = [
  { label: fe4AttendanceText.attendanceStateControl_label_7c7cca86, value: 'Unmarked' },
  { label: fe4AttendanceText.attendanceStateControl_label_ff13de89, value: 'Present' },
  { label: fe4AttendanceText.attendanceStateControl_label_cd2e8ad3, value: 'Absent' },
]

export function AttendanceStateControl({ clientName, disabled, value, onChange }: AttendanceStateControlProps) {
  return (
    <Radio.Group
      aria-label={fe4AttendanceText.attendanceStateControl_template_63505065(clientName)}
      disabled={disabled}
      onChange={(nextValue) => onChange(nextValue as AttendanceState)}
      value={value}
    >
      <div className="attendance-state-control">
        {options.map((option) => (
          <Radio.Card
            aria-label={option.label}
            className="attendance-state-option"
            disabled={disabled}
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
