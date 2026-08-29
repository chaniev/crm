import type { ReactNode } from 'react'
import {
  IconBan,
  IconChevronRight,
  IconRefresh,
  IconSettings,
  IconUsers,
} from '@tabler/icons-react'
import type { ScheduleLesson } from '../../lib/api'

export type ScheduleDeferredActionId =
  | 'edit'
  | 'move'
  | 'series'
  | 'assign-substitution'
  | 'cancel-substitution'
  | 'cancel'
  | 'restore'

export type ScheduleDeferredAction = {
  id: ScheduleDeferredActionId
  label: string
  accessibleName: string
  icon: ReactNode
  danger: boolean
  run: () => void
}

function formatIntervalLabel(lesson: ScheduleLesson) {
  const trim = (value: string) => value.match(/^\d{2}:\d{2}/)?.[0] ?? value
  return `${trim(lesson.startTime)}-${trim(lesson.endTime)}`
}

/**
 * Single capability-derived deferred-action model shared by the desktop
 * `Menu` and the mobile/compact-height `Drawer`. Cancellation/restore is
 * always last.
 */
export function buildScheduleDeferredActions(
  lesson: ScheduleLesson,
  handlers: {
    onMoveLesson: (lesson: ScheduleLesson) => void
    onEditSeries: (lesson: ScheduleLesson, scope: 'this-and-future' | 'entire') => void
    onTrainerSubstitution: (lesson: ScheduleLesson, action: 'Assign' | 'Cancel') => void
    onCancelOrRestoreLesson: (
      lesson: ScheduleLesson,
      action: 'Cancel' | 'Restore',
    ) => void
  },
): ScheduleDeferredAction[] {
  const actions: ScheduleDeferredAction[] = []

  if (lesson.allowedActions.move.allowed) {
    actions.push({
      id: 'move',
      label: 'Перенести',
      accessibleName: `Перенести занятие: ${lesson.groupName}, ${formatIntervalLabel(lesson)}`,
      icon: <IconChevronRight size={18} />,
      danger: false,
      run: () => handlers.onMoveLesson(lesson),
    })
  }

  if (lesson.lessonSeriesId && lesson.allowedActions.edit.allowed) {
    actions.push({
      id: 'series',
      label: 'Серия',
      accessibleName: `Изменить серию занятий: ${lesson.groupName}`,
      icon: <IconSettings size={18} />,
      danger: false,
      run: () => handlers.onEditSeries(lesson, 'this-and-future'),
    })
  }

  if (lesson.allowedActions.assignTrainerSubstitution.allowed) {
    actions.push({
      id: 'assign-substitution',
      label: 'Замена',
      accessibleName: `Назначить замену тренера: ${lesson.groupName}, ${formatIntervalLabel(lesson)}`,
      icon: <IconUsers size={18} />,
      danger: false,
      run: () => handlers.onTrainerSubstitution(lesson, 'Assign'),
    })
  }

  if (lesson.allowedActions.cancelTrainerSubstitution.allowed) {
    actions.push({
      id: 'cancel-substitution',
      label: 'Снять замену',
      accessibleName: `Снять замену тренера: ${lesson.groupName}, ${formatIntervalLabel(lesson)}`,
      icon: <IconRefresh size={18} />,
      danger: false,
      run: () => handlers.onTrainerSubstitution(lesson, 'Cancel'),
    })
  }

  // Cancellation/restore stays last among deferred actions.
  if (lesson.allowedActions.cancel.allowed) {
    actions.push({
      id: 'cancel',
      label: 'Отменить',
      accessibleName: `Отменить занятие: ${lesson.groupName}, ${formatIntervalLabel(lesson)}`,
      icon: <IconBan size={18} />,
      danger: true,
      run: () => handlers.onCancelOrRestoreLesson(lesson, 'Cancel'),
    })
  } else if (lesson.allowedActions.restore.allowed) {
    actions.push({
      id: 'restore',
      label: 'Восстановить',
      accessibleName: `Восстановить занятие: ${lesson.groupName}, ${formatIntervalLabel(lesson)}`,
      icon: <IconRefresh size={18} />,
      danger: false,
      run: () => handlers.onCancelOrRestoreLesson(lesson, 'Restore'),
    })
  }

  return actions
}
