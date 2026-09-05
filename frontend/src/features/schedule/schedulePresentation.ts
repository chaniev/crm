
import { fe2ScheduleCoreText } from '../../resources/fe-2-schedule-core'
export function formatScheduleEntryCount(count: number) {
  return `${count} ${formatLessonWord(count)}`
}

function formatLessonWord(count: number) {
  const absCount = Math.abs(count)
  const lastDigit = absCount % 10
  const lastTwoDigits = absCount % 100

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return fe2ScheduleCoreText.schedulePresentation_string_ba6c01b2
  }

  if (lastDigit === 1) {
    return fe2ScheduleCoreText.schedulePresentation_string_8ed71a94
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return fe2ScheduleCoreText.schedulePresentation_string_5f915be7
  }

  return fe2ScheduleCoreText.schedulePresentation_string_ba6c01b2
}

export function formatScheduleClientCount(clientCount: number) {
  const absCount = Math.abs(clientCount)
  const lastDigit = absCount % 10
  const lastTwoDigits = absCount % 100
  let word: string = fe2ScheduleCoreText.schedulePresentation_word_e3c8a505

  if (lastTwoDigits < 11 || lastTwoDigits > 14) {
    if (lastDigit === 1) {
      word = fe2ScheduleCoreText.schedulePresentation_string_3728896b
    } else if (lastDigit >= 2 && lastDigit <= 4) {
      word = fe2ScheduleCoreText.schedulePresentation_string_cebd852c
    }
  }

  return `${clientCount} ${word}`
}
