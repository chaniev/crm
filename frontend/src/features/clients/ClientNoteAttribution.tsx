import { Text } from '@mantine/core'
import { formatNoteAttributionDate } from './noteAttribution'

type ClientNoteAttributionProps = {
  authorName: string
  changedAt: string
}

export function ClientNoteAttribution({
  authorName,
  changedAt,
}: ClientNoteAttributionProps) {
  const formattedDate = formatNoteAttributionDate(changedAt)

  return formattedDate ? (
    <Text c="dimmed" size="xs" style={{ overflowWrap: 'anywhere' }}>
      {authorName} · {formattedDate}
    </Text>
  ) : null
}
