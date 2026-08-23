export function formatScheduleEntryCount(count: number) {
  return `${count} ${formatLessonWord(count)}`
}

function formatLessonWord(count: number) {
  const absCount = Math.abs(count)
  const lastDigit = absCount % 10
  const lastTwoDigits = absCount % 100

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return 'занятий'
  }

  if (lastDigit === 1) {
    return 'занятие'
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'занятия'
  }

  return 'занятий'
}

export function formatScheduleClientCount(clientCount: number) {
  const absCount = Math.abs(clientCount)
  const lastDigit = absCount % 10
  const lastTwoDigits = absCount % 100
  let word = 'участников'

  if (lastTwoDigits < 11 || lastTwoDigits > 14) {
    if (lastDigit === 1) {
      word = 'участник'
    } else if (lastDigit >= 2 && lastDigit <= 4) {
      word = 'участника'
    }
  }

  return `${clientCount} ${word}`
}
