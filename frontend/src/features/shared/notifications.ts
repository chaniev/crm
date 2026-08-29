import { notifications, type NotificationData } from '@mantine/notifications'
import {
  getSemanticToneDefinition,
  type SemanticTone,
} from '../../theme/semanticTones'
import {
  GYM_CRM_NOTIFICATION_AUTO_CLOSE_MS,
  GYM_CRM_NOTIFICATION_LIMIT,
} from '../../theme/componentRecipeConstants'

export const APP_NOTIFICATION_AUTO_CLOSE_MS = GYM_CRM_NOTIFICATION_AUTO_CLOSE_MS
export const APP_NOTIFICATION_LIMIT = GYM_CRM_NOTIFICATION_LIMIT

export type AppNotificationData = Omit<NotificationData, 'color'> & {
  color?: NotificationData['color']
  tone?: SemanticTone
}

export function showAppNotification(notification: AppNotificationData) {
  const { tone, ...notificationPayload } = notification
  const toneColor = tone
    ? getSemanticToneDefinition(tone).mantineColor
    : undefined
  const toneAccessibility: Partial<NotificationData> =
    tone === 'danger'
      ? {
          'aria-live': 'assertive',
          role: 'alert',
        }
      : {}
  const payload: NotificationData = {
    autoClose: APP_NOTIFICATION_AUTO_CLOSE_MS,
    ...toneAccessibility,
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
