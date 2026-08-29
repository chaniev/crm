import { notifications, type NotificationData } from '@mantine/notifications'
import { createElement } from 'react'
import {
  getSemanticToneDefinition,
  type SemanticTone,
} from '../../theme/semanticTones'
import { Button } from './Button'
import {
  GYM_CRM_NOTIFICATION_AUTO_CLOSE_MS,
  GYM_CRM_NOTIFICATION_LIMIT,
} from '../../theme/componentRecipeConstants'

export const APP_NOTIFICATION_AUTO_CLOSE_MS = GYM_CRM_NOTIFICATION_AUTO_CLOSE_MS
export const APP_NOTIFICATION_LIMIT = GYM_CRM_NOTIFICATION_LIMIT

export type AppNotificationUrgency = 'polite' | 'assertive'

export type AppNotificationAction = {
  label: string
  onClick: () => void
}

export type AppNotificationData = Omit<NotificationData, 'color'> & {
  action?: AppNotificationAction
  color?: NotificationData['color']
  persistent?: boolean
  tone?: SemanticTone
  urgency?: AppNotificationUrgency
}

export function showAppNotification(notification: AppNotificationData) {
  const {
    action,
    persistent,
    tone,
    urgency = tone === 'danger' ? 'assertive' : undefined,
    ...notificationPayload
  } = notification
  const toneColor = tone
    ? getSemanticToneDefinition(tone).mantineColor
    : undefined
  const accessibility: Partial<NotificationData> =
    urgency === 'assertive'
      ? {
          'aria-live': 'assertive',
          role: 'alert',
        }
      : urgency === 'polite'
        ? {
            'aria-live': 'polite',
            role: 'status',
          }
      : {}
  const payload: NotificationData = {
    ...notificationPayload,
    autoClose:
      notificationPayload.autoClose ??
      (persistent ? false : APP_NOTIFICATION_AUTO_CLOSE_MS),
    ...accessibility,
    color: notificationPayload.color ?? toneColor,
    message: action
      ? createNotificationMessage(notificationPayload.message, action)
      : notificationPayload.message,
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
    urgency: 'polite',
  })
}

function createNotificationMessage(
  message: NotificationData['message'],
  action: AppNotificationAction,
) {
  return createElement(
    'div',
    { className: 'app-notification__content' },
    createElement('div', { className: 'app-notification__message' }, message),
    createElement(
      Button,
      {
        className: 'app-notification__action',
        onClick: action.onClick,
        type: 'button',
        variant: 'secondary',
      },
      action.label,
    ),
  )
}
