import { describe, expect, it } from 'vitest'
import {
  mapClientMessengerLinkToken,
  mapClientMessengerMessage,
  mapClientMessengerMessagePage,
  mapClientMessengerSummary,
} from './clientMessenger'

describe('client messenger API mappers', () => {
  it('maps summary capabilities and connection state from backend payload', () => {
    const summary = mapClientMessengerSummary({
      platform: 'Telegram',
      capabilities: {
        visible: true,
        canRead: true,
        canReply: false,
        canCreateLink: false,
        canShowQr: false,
      },
      connection: {
        status: 'Connected',
        linkedAt: '2026-05-21T10:00:00Z',
        telegramUsername: 'client_user',
        telegramDisplayName: 'Client User',
      },
      unreadCount: 3,
      totalMessageCount: 8,
      latestMessageAt: '2026-05-21T10:05:00Z',
      latestMessage: {
        id: 'message-id',
        direction: 'Inbound',
        status: 'Received',
        text: 'Здравствуйте',
        createdAt: '2026-05-21T10:05:00Z',
      },
    })

    expect(summary.capabilities.canRead).toBe(true)
    expect(summary.capabilities.canReply).toBe(false)
    expect(summary.connection.status).toBe('Connected')
    expect(summary.unreadCount).toBe(3)
    expect(summary.latestMessage?.status).toBe('Received')
  })

  it('uses safe defaults for unknown states', () => {
    const summary = mapClientMessengerSummary({
      capabilities: {},
      connection: {
        status: 'Unexpected',
      },
      unreadCount: 'not-a-number',
    })
    const message = mapClientMessengerMessage({
      direction: 'Sideways',
      status: 'Delivered',
    })

    expect(summary.platform).toBe('Telegram')
    expect(summary.capabilities.visible).toBe(false)
    expect(summary.connection.status).toBe('NotConnected')
    expect(summary.unreadCount).toBe(0)
    expect(message.direction).toBe('Inbound')
    expect(message.status).toBe('Failed')
  })

  it('maps messages page and link token payloads', () => {
    const page = mapClientMessengerMessagePage({
      items: [
        {
          id: 'outbound-id',
          direction: 'Outbound',
          status: 'SentToTelegram',
          text: 'Добрый день',
          createdAt: '2026-05-21T10:00:00Z',
          updatedAt: '2026-05-21T10:00:01Z',
          sentAt: '2026-05-21T10:00:01Z',
          createdByUserName: 'Admin',
        },
      ],
      skip: 0,
      take: 50,
      totalCount: 1,
      hasMore: false,
    })
    const linkToken = mapClientMessengerLinkToken({
      platform: 'Telegram',
      deepLinkUrl: 'https://t.me/gym_client_bot?start=token',
      qrCodeSvg: '<svg />',
      expiresAt: '2026-05-21T10:30:00Z',
      connection: {
        status: 'PendingLink',
        pendingLinkExpiresAt: '2026-05-21T10:30:00Z',
      },
    })

    expect(page.items).toHaveLength(1)
    expect(page.items[0]?.direction).toBe('Outbound')
    expect(page.items[0]?.status).toBe('SentToTelegram')
    expect(linkToken.connection.status).toBe('PendingLink')
    expect(linkToken.qrCodeSvg).toBe('<svg />')
  })
})
