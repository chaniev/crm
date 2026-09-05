import {
  useEffect,
  useRef,
  type CSSProperties,
  type MutableRefObject,
} from 'react'
import {
  Badge,
  CloseButton,
  Group,
  Popover,
  Stack,
  Text,
} from '@mantine/core'
import type { TrainingGroupListItem } from '../../lib/api'
import {
  formatScheduleEntryTimeRange,
  type ScheduleCalendarEntry,
  type ScheduleVisualDisclosureGroup,
  type ScheduleVisibleHourRange,
} from '../../lib/groupSchedule'
import {
  formatScheduleClientCount,
  formatScheduleEntryCount,
} from './schedulePresentation'
import { fe3ScheduleMutationsText } from '../../resources/fe-3-schedule-mutations'


type ScheduleEventsDisclosureProps = {
  dateLabel: string
  group: ScheduleVisualDisclosureGroup<TrainingGroupListItem>
  hourHeight: number
  isOpen: boolean
  onClose: () => void
  onNaturalHeight: (key: string, heightPx: number) => void
  onToggle: () => void
  triggerRefs: MutableRefObject<Map<string, HTMLButtonElement>>
  visibleHourRange: ScheduleVisibleHourRange
  weekdayLabel: string
}

export function ScheduleEventsDisclosure({
  dateLabel,
  group,
  hourHeight,
  isOpen,
  onClose,
  onNaturalHeight,
  onToggle,
  triggerRefs,
  visibleHourRange,
  weekdayLabel,
}: ScheduleEventsDisclosureProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const titleId = `${group.key}-title`
  const dropdownId = `${group.key}-details`
  const timeRange = formatScheduleDisclosureTimeRange(group)
  const visibleEntries = group.entries.slice(0, 2)
  const remainingCount = Math.max(0, group.count - visibleEntries.length)
  const style = buildDisclosureStyle(group, visibleHourRange, hourHeight)
  const accessibleName = [
    `${weekdayLabel} ${dateLabel}, ${timeRange}:`,
    fe3ScheduleMutationsText.scheduleEventsDisclosure_template_4c5bfbe1(formatScheduleEntryCount(group.count)),
    fe3ScheduleMutationsText.scheduleEventsDisclosure_string_89ce76b3,
  ].join(' ')

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus()
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [isOpen])

  return (
    <Popover
      closeOnEscape
      closeOnClickOutside={false}
      hideDetached={false}
      middlewares={{ flip: true, shift: true, size: { padding: 16 } }}
      onChange={(opened) => {
        if (!opened) {
          onClose()
        }
      }}
      onClose={onClose}
      opened={isOpen}
      position="bottom-start"
      returnFocus={false}
      shadow="md"
      trapFocus
      transitionProps={{ duration: 0 }}
      width="min(420px, calc(100vw - 32px))"
      withRoles={false}
      withinPortal
    >
      <Popover.Target>
        <button
          aria-controls={dropdownId}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          aria-label={accessibleName}
          className="schedule-events-disclosure"
          data-testid={`schedule-disclosure-${group.entries[0]?.weekday ?? 0}-${group.startMinutes}-${group.endMinutes}`}
          onClick={onToggle}
          ref={(node) => {
            if (node) {
              triggerRefs.current.set(group.key, node)
              onNaturalHeight(group.key, node.scrollHeight)
            } else {
              triggerRefs.current.delete(group.key)
            }
          }}
          style={style}
          type="button"
        >
          <span className="schedule-events-disclosure__time">
            {timeRange} {fe3ScheduleMutationsText.scheduleEventsDisclosure_jsxText_a137f17a}{formatScheduleEntryCount(group.count)}
          </span>
          <span className="schedule-events-disclosure__names">
            {visibleEntries.map((entry) => (
              <span key={entry.key}>{entry.group.name}</span>
            ))}
            {remainingCount > 0 ? (
              <span className="schedule-events-disclosure__more">{fe3ScheduleMutationsText.scheduleEventsDisclosure_jsxText_a318c242}{remainingCount}</span>
            ) : null}
          </span>
        </button>
      </Popover.Target>

      <Popover.Dropdown
        aria-labelledby={titleId}
        aria-modal="false"
        className="schedule-events-popover"
        id={dropdownId}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            onClose()
          }
        }}
        role="dialog"
      >
        <Group align="flex-start" justify="space-between" wrap="nowrap">
          <Stack gap={2}>
            <Text fw={900} id={titleId}>
              {fe3ScheduleMutationsText.scheduleEventsDisclosure_jsxText_65b19bb3}</Text>
            <Text c="dimmed" size="sm">
              {timeRange} {fe3ScheduleMutationsText.scheduleEventsDisclosure_jsxText_a137f17a}{formatScheduleEntryCount(group.count)}
            </Text>
          </Stack>
          <CloseButton
            aria-label={fe3ScheduleMutationsText.scheduleEventsDisclosure_ariaLabel_15189e3f}
            onClick={onClose}
            ref={closeButtonRef}
            size={44}
          />
        </Group>

        <ul className="schedule-events-popover__list">
          {group.entries.map((entry) => (
            <ScheduleEventsDisclosureRow
              entry={entry}
              key={entry.key}
            />
          ))}
        </ul>
      </Popover.Dropdown>
    </Popover>
  )
}

function ScheduleEventsDisclosureRow({
  entry,
}: {
  entry: ScheduleCalendarEntry<TrainingGroupListItem>
}) {
  const group = entry.group
  const timeRange = formatScheduleEntryTimeRange(entry)
  const trainerNames = formatTrainerNamesForDetails(group)
  const rowLabel = [
    timeRange,
    group.name,
    getScheduleTypeLabelForDetails(group),
    `${group.hallName} · ${group.branchName}`,
    trainerNames,
    formatScheduleClientCount(group.clientCount),
    group.isActive ? '' : fe3ScheduleMutationsText.scheduleEventsDisclosure_string_4f049897,
  ].filter(Boolean).join(', ')

  return (
    <li
      aria-label={rowLabel}
      className="schedule-events-popover__row"
    >
      <Text className="schedule-events-popover__time" fw={900}>
        {timeRange}
      </Text>
      <Stack gap={4}>
        <Group align="flex-start" gap="xs" wrap="wrap">
          <Text className="schedule-events-popover__name" fw={900}>
            {group.name}
          </Text>
          <span className="schedule-event-card__type-chip">
            {group.groupTypeName}
          </span>
          {!group.isActive ? (
            <Badge color="gray" radius="xl" size="xs" variant="light">
              {fe3ScheduleMutationsText.scheduleEventsDisclosure_string_4f049897}</Badge>
          ) : null}
        </Group>
        <Text c="dimmed" size="sm">
          {group.hallName} {fe3ScheduleMutationsText.scheduleEventsDisclosure_jsxText_a137f17a}{group.branchName}
        </Text>
        <Text c="dimmed" size="sm">
          {trainerNames}
        </Text>
        <Text c="dimmed" size="sm">
          {formatScheduleClientCount(group.clientCount)}
        </Text>
      </Stack>
    </li>
  )
}

function buildDisclosureStyle(
  group: ScheduleVisualDisclosureGroup<TrainingGroupListItem>,
  visibleHourRange: ScheduleVisibleHourRange,
  hourHeight: number,
) {
  const rangeStartMinutes = visibleHourRange.startHour * 60
  const top = ((group.startMinutes - rangeStartMinutes) / 60) * hourHeight
  const naturalHeight = ((group.endMinutes - group.startMinutes) / 60) * hourHeight

  return {
    top: `${top}px`,
    height: `${Math.max(54, naturalHeight)}px`,
  } satisfies CSSProperties
}

function formatScheduleDisclosureTimeRange(
  group: Pick<ScheduleVisualDisclosureGroup<TrainingGroupListItem>, 'startMinutes' | 'endMinutes'>,
) {
  return formatScheduleEntryTimeRange({
    startMinutes: group.startMinutes,
    endMinutes: group.endMinutes,
  })
}

function getScheduleTypeLabelForDetails(group: TrainingGroupListItem) {
  return group.groupTypeName.trim() || fe3ScheduleMutationsText.scheduleEventsDisclosure_string_e93b045d
}

function formatTrainerNamesForDetails(group: TrainingGroupListItem) {
  if (group.trainerNames.length > 0) {
    return group.trainerNames.join(', ')
  }

  if (group.trainers.length > 0) {
    return group.trainers.map((trainer) => trainer.fullName).join(', ')
  }

  return fe3ScheduleMutationsText.scheduleEventsDisclosure_string_a674b477
}
