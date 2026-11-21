// This function is built inside the audit screen to reuse its existing formatters and button.
function AuditLogGridRow({ entry, onOpenDetails }: AuditLogGridRowProps) {
  const { date, time } = formatDateTimeParts(entry.createdAt)
  const description = getAuditDescription(entry)
  const channel = [
    entry.source && !['Web', 'Bot'].includes(entry.source) ? formatSource(entry.source) : null,
    entry.messengerPlatform && entry.messengerPlatform !== 'Telegram' ? formatMessengerPlatform(entry.messengerPlatform) : null,
  ].filter(Boolean).join(' · ')

  return <div role="row" className="review-row crm-list-row-surface" data-testid="audit-log-row">
    <div role="cell" className="review-date">
      <time dateTime={entry.createdAt}><span>{date}</span> <strong>{time}</strong></time>
    </div>
    <div role="cell" className="review-event">
      <Text className="review-description">{description}</Text>
      {channel && <Text className="review-channel">{channel}</Text>}
    </div>
    <div role="cell" className="review-author" aria-label={'Автор: ' + entry.userName}>
      <span className="review-name"><span className="review-author-label" aria-hidden="true">Автор · </span>{entry.userName}</span>
    </div>
    <div role="cell" className="review-action">
      <Button variant="light" size="xs" aria-haspopup="dialog"
        aria-label={fe16AuditText.auditLogScreen_template_f73af74a(description)}
        onClick={event => {
          event.currentTarget.focus({ preventScroll: true })
          onOpenDetails(entry)
        }}>Детали</Button>
    </div>
  </div>
}
