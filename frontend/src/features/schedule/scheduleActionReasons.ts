const SCHEDULE_ACTION_REASON_LABELS: Record<string, string> = {
  'attendance-forbidden': 'Посещаемость недоступна для вашей роли или зоны доступа.',
  'future-lesson': 'Посещаемость станет доступна в разрешённый период отметок.',
  'lesson-cancelled': 'Занятие отменено.',
  'lesson-not-cancelled': 'Занятие не отменено.',
  'lesson-not-scheduled': 'Занятие сейчас не запланировано.',
  'lesson-attendance-state-conflict': 'У занятия уже есть отметки посещаемости.',
  'no-substitution': 'Для занятия нет активной замены тренера.',
  'not-cancelled': 'Занятие не отменено.',
  'role-not-allowed': 'Создание разового занятия недоступно для вашей роли.',
  'schedule-mutations-unavailable': 'Изменение расписания сейчас недоступно.',
  'not-implemented': 'Действие пока недоступно.',
  'not-wired': 'Действие пока недоступно.',
  'lesson-mutation-preview-invalid': 'Предпросмотр больше не действует. Получите новый предпросмотр.',
  'lesson-mutation-preview-expired': 'Время подтверждения истекло. Получите новый предпросмотр.',
  'lesson-mutation-preview-stale': 'Параметры изменились после предпросмотра. Получите новый предпросмотр.',
  lesson_hall_overlap: 'В выбранное время в зале есть другое занятие.',
  lesson_trainer_overlap: 'В выбранное время у тренера есть другое занятие.',
  group_trainer_assignment_overlap:
    'У тренера есть пересекающееся постоянное назначение в другой группе.',
}

export function formatScheduleActionUnavailableReason(reason: string | null | undefined) {
  if (!reason) {
    return 'Действие сейчас недоступно.'
  }

  return SCHEDULE_ACTION_REASON_LABELS[reason] ?? 'Действие сейчас недоступно.'
}

export function formatScheduleProblemCode(code: string | null | undefined) {
  return code ? SCHEDULE_ACTION_REASON_LABELS[code] ?? null : null
}
