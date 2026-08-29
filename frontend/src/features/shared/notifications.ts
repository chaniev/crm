import { notifications, type NotificationData } from '@mantine/notifications'
import {
  getSemanticToneDefinition,
  type SemanticTone,
} from '../../theme/semanticTones'

export const APP_NOTIFICATION_AUTO_CLOSE_MS = 10_000
export const APP_NOTIFICATION_LIMIT = 5

export type AppNotificationData = Omit<NotificationData, 'color'> & {
  color?: NotificationData['color']
  tone?: SemanticTone
}

export function showAppNotification(notification: AppNotificationData) {
  const { tone, ...notificationPayload } = notification
  const toneColor = tone
    ? getSemanticToneDefinition(tone).mantineColor
    : undefined
  const payload: NotificationData = {
    autoClose: APP_NOTIFICATION_AUTO_CLOSE_MS,
    ...notificationPayload,
    color: notificationPayload.color ?? toneColor,
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

export function showPoliteStatusNotification(notification: AppNotificationData) {
  return showAppNotification({
    ...notification,
    role: 'status',
    'aria-live': 'polite',
  })
}
