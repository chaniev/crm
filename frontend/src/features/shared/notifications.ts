import { notifications, type NotificationData } from '@mantine/notifications'

export const APP_NOTIFICATION_AUTO_CLOSE_MS = 10_000
export const APP_NOTIFICATION_LIMIT = 5

export function showAppNotification(notification: NotificationData) {
  const payload: NotificationData = {
    autoClose: APP_NOTIFICATION_AUTO_CLOSE_MS,
    ...notification,
  }

  notifications.cleanQueue()
  const notificationId = notifications.show(payload)

  if (payload.id) {
    notifications.update({
      ...payload,
      id: notificationId,
    })
  }

  return notificationId
}

export function showPoliteStatusNotification(notification: NotificationData) {
  return showAppNotification({
    ...notification,
    role: 'status',
    'aria-live': 'polite',
  })
}
