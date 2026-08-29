import { isValidElement } from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const notificationsMock = vi.hoisted(() => ({
  cleanQueue: vi.fn(),
  show: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@mantine/notifications', () => ({
  notifications: notificationsMock,
}))

import {
  APP_NOTIFICATION_AUTO_CLOSE_MS,
  showAppNotification,
  showPoliteStatusNotification,
} from './notifications'

describe('showAppNotification', () => {
  beforeEach(() => {
    notificationsMock.cleanQueue.mockClear()
    notificationsMock.show.mockReset()
    notificationsMock.update.mockClear()
    notificationsMock.show.mockReturnValue('notification-id')
  })

  test('applies the app auto-close timeout to ordinary notifications', () => {
    showAppNotification({
      title: 'Группа создана',
      message: 'Изменения сохранены.',
      color: 'teal',
    })

    expect(notificationsMock.cleanQueue).toHaveBeenCalledTimes(1)
    expect(notificationsMock.show).toHaveBeenCalledWith({
      autoClose: APP_NOTIFICATION_AUTO_CLOSE_MS,
      title: 'Группа создана',
      message: 'Изменения сохранены.',
      color: 'teal',
    })
  })

  test('allows persistent notifications through explicit opt-in', () => {
    showAppNotification({
      title: 'Критичное уведомление',
      message: 'Требует ручного закрытия.',
      autoClose: false,
    })

    expect(notificationsMock.show).toHaveBeenCalledWith({
      autoClose: false,
      title: 'Критичное уведомление',
      message: 'Требует ручного закрытия.',
    })
  })

  test('keeps contextual action notifications persistent and keyboard reachable', () => {
    const retry = vi.fn()

    showAppNotification({
      action: {
        label: 'Повторить',
        onClick: retry,
      },
      message: 'Сервер не ответил.',
      persistent: true,
      title: 'Не удалось сохранить',
      tone: 'danger',
    })

    const payload = notificationsMock.show.mock.calls[0]?.[0]

    expect(payload).toMatchObject({
      'aria-live': 'assertive',
      autoClose: false,
      color: 'var(--crm-status-danger-fg)',
      role: 'alert',
      title: 'Не удалось сохранить',
    })
    expect(isValidElement(payload.message)).toBe(true)
    const actionContainer = payload.message.props.children[1]
    expect(actionContainer.props.children).toBe('Повторить')
    expect(actionContainer.props.type).toBe('button')
    actionContainer.props.onClick()
    expect(retry).toHaveBeenCalledTimes(1)
  })

  test('maps semantic tones to shared functional status variables', () => {
    showAppNotification({
      title: 'Абонемент сохранен',
      message: 'Изменения применены.',
      tone: 'success',
    })

    expect(notificationsMock.show).toHaveBeenCalledWith({
      autoClose: APP_NOTIFICATION_AUTO_CLOSE_MS,
      title: 'Абонемент сохранен',
      message: 'Изменения применены.',
      color: 'var(--crm-status-success-fg)',
    })
  })

  test('upserts stable-id notifications so the latest payload wins', () => {
    showAppNotification({
      id: 'settings-group-type-create',
      title: 'Тип группы создан',
      message: 'Справочник сохранен.',
      color: 'teal',
    })

    expect(notificationsMock.show).toHaveBeenCalledWith({
      autoClose: APP_NOTIFICATION_AUTO_CLOSE_MS,
      id: 'settings-group-type-create',
      title: 'Тип группы создан',
      message: 'Справочник сохранен.',
      color: 'teal',
    })
    expect(notificationsMock.update).toHaveBeenCalledWith({
      autoClose: APP_NOTIFICATION_AUTO_CLOSE_MS,
      id: 'notification-id',
      title: 'Тип группы создан',
      message: 'Справочник сохранен.',
      color: 'teal',
    })
  })

  test('marks route recovery notifications as polite status feedback', () => {
    showPoliteStatusNotification({
      id: 'route-access-denied-user-1',
      title: 'Открыт доступный раздел',
      message: 'Раздел больше недоступен.',
      color: 'yellow',
    })

    expect(notificationsMock.show).toHaveBeenCalledWith({
      autoClose: APP_NOTIFICATION_AUTO_CLOSE_MS,
      id: 'route-access-denied-user-1',
      title: 'Открыт доступный раздел',
      message: 'Раздел больше недоступен.',
      color: 'yellow',
      role: 'status',
      'aria-live': 'polite',
    })
  })

  test('does not let callers downgrade polite status semantics', () => {
    showPoliteStatusNotification({
      id: 'route-access-denied-user-2',
      title: 'Открыт доступный раздел',
      message: 'Раздел больше недоступен.',
      color: 'yellow',
      role: 'alert',
      'aria-live': 'assertive',
    })

    expect(notificationsMock.show).toHaveBeenCalledWith({
      autoClose: APP_NOTIFICATION_AUTO_CLOSE_MS,
      id: 'route-access-denied-user-2',
      title: 'Открыт доступный раздел',
      message: 'Раздел больше недоступен.',
      color: 'yellow',
      role: 'status',
      'aria-live': 'polite',
    })
  })
})
