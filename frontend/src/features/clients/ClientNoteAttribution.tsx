import { Text } from '@mantine/core'
import { formatNoteAttributionDate } from './noteAttribution'
import { fe8ClientMessengerMediaText } from '../../resources/fe-8-client-messenger-media'


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
      {authorName} {fe8ClientMessengerMediaText.clientNoteAttribution_jsxText_a137f17a}{formattedDate}
    </Text>
  ) : null
}
