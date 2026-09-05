
import { fe2ScheduleCoreText } from '../../resources/fe-2-schedule-core'
const SCHEDULE_ACTION_REASON_LABELS: Record<string, string> = {
  'attendance-forbidden': fe2ScheduleCoreText.scheduleActionReasons_attendanceForbidden_a90255c9,
  'future-lesson': fe2ScheduleCoreText.scheduleActionReasons_futureLesson_a00df924,
  'lesson-cancelled': fe2ScheduleCoreText.scheduleActionReasons_lessonCancelled_558a4a9c,
  'lesson-not-cancelled': fe2ScheduleCoreText.scheduleActionReasons_lessonNotCancelled_ff754a71,
  'lesson-not-scheduled': fe2ScheduleCoreText.scheduleActionReasons_lessonNotScheduled_14a746f8,
  'lesson-attendance-state-conflict': fe2ScheduleCoreText.scheduleActionReasons_lessonAttendanceStateConflict_811c0c2e,
  'no-substitution': fe2ScheduleCoreText.scheduleActionReasons_noSubstitution_1ec89fcc,
  'not-cancelled': fe2ScheduleCoreText.scheduleActionReasons_lessonNotCancelled_ff754a71,
  'role-not-allowed': fe2ScheduleCoreText.scheduleActionReasons_roleNotAllowed_ee8482c5,
  'schedule-mutations-unavailable': fe2ScheduleCoreText.scheduleActionReasons_scheduleMutationsUnavailable_bd3a9985,
  'not-implemented': fe2ScheduleCoreText.scheduleActionReasons_notImplemented_366e9d65,
  'not-wired': fe2ScheduleCoreText.scheduleActionReasons_notImplemented_366e9d65,
  'lesson-mutation-preview-invalid': fe2ScheduleCoreText.scheduleActionReasons_lessonMutationPreviewInvalid_ffd3593c,
  'lesson-mutation-preview-expired': fe2ScheduleCoreText.scheduleActionReasons_lessonMutationPreviewExpired_d57c7823,
  'lesson-mutation-preview-stale': fe2ScheduleCoreText.scheduleActionReasons_lessonMutationPreviewStale_4558ad4e,
  lesson_hall_overlap: fe2ScheduleCoreText.scheduleActionReasons_lessonHallOverlap_b7d37a1e,
  lesson_trainer_overlap: fe2ScheduleCoreText.scheduleActionReasons_lessonTrainerOverlap_a0dfe4d6,
  group_trainer_assignment_overlap:
    fe2ScheduleCoreText.scheduleActionReasons_groupTrainerAssignmentOverlap_96c9bf50,
}

export function formatScheduleActionUnavailableReason(reason: string | null | undefined) {
  if (!reason) {
    return fe2ScheduleCoreText.scheduleActionReasons_string_6f1c3a2e
  }

  return SCHEDULE_ACTION_REASON_LABELS[reason] ?? fe2ScheduleCoreText.scheduleActionReasons_string_6f1c3a2e
}

export function formatScheduleProblemCode(code: string | null | undefined) {
  return code ? SCHEDULE_ACTION_REASON_LABELS[code] ?? null : null
}
