<Stack gap="sm">
  <Group className="review-detail-badges" gap="xs" wrap="wrap">
    {formatActionType(entry.actionType) !== entry.actionType && (
      <Badge color="var(--crm-brand-primary-soft)" radius="xl" variant="light">
        {formatActionType(entry.actionType)}
      </Badge>
    )}
    {entry.source && entry.source !== 'Bot' && <Badge color="cyan" radius="xl" variant="light">{formatSource(entry.source)}</Badge>}
    {entry.messengerPlatform && entry.messengerPlatform !== 'Telegram' && (
      <Badge color="teal" radius="xl" variant="light">
        {formatMessengerPlatform(entry.messengerPlatform)}
      </Badge>
    )}
  </Group>
  <Text fw={800}>{description}</Text>
  <Text size="sm" style={{ overflowWrap: 'anywhere' }}>Автор · {entry.userName}</Text>
  {dateTimeParts && <Text c="dimmed" size="sm">{dateTimeParts.date}, {dateTimeParts.time}</Text>}
</Stack>
