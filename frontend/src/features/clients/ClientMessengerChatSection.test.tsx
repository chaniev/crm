import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  createClientMessengerTelegramLinkToken,
  getClientMessengerMessages,
  getClientMessengerSummary,
  type ClientMessengerLinkToken,
  type ClientMessengerSummary,
} from '../../lib/api'
import { renderWithProviders } from '../../test/render'
import { ClientMessengerChatSection } from './ClientMessengerChatSection'

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>()

  return {
    ...actual,
    createClientMessengerTelegramLinkToken: vi.fn(),
    getClientMessengerMessages: vi.fn(),
    getClientMessengerSummary: vi.fn(),
    markClientMessengerRead: vi.fn(),
  }
})

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
const originalExecCommand = Object.getOwnPropertyDescriptor(document, 'execCommand')

const createLinkTokenMock = vi.mocked(createClientMessengerTelegramLinkToken)
const getMessagesMock = vi.mocked(getClientMessengerMessages)
const getSummaryMock = vi.mocked(getClientMessengerSummary)

beforeEach(() => {
  createLinkTokenMock.mockReset()
  getMessagesMock.mockReset()
  getSummaryMock.mockReset()

  getSummaryMock.mockResolvedValue(buildSummary())
  createLinkTokenMock.mockResolvedValue(buildLinkToken())
})

afterEach(() => {
  restoreProperty(navigator, 'clipboard', originalClipboard)
  restoreProperty(document, 'execCommand', originalExecCommand)
})

describe('ClientMessengerChatSection', () => {
  test('copies the Telegram deep link with the legacy fallback when Clipboard API is unavailable', async () => {
    const execCommand = vi.fn().mockReturnValue(true)

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    })
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    })

    renderWithProviders(<ClientMessengerChatSection clientId="client-1" />)

    const linkButtons = await screen.findAllByRole('button', {
      name: 'Ссылка и QR',
    })
    fireEvent.click(linkButtons[0])

    const copyButton = await screen.findByRole('button', {
      name: 'Скопировать ссылку',
    })
    fireEvent.click(copyButton)

    await waitFor(() => expect(execCommand).toHaveBeenCalledWith('copy'))
    expect(createLinkTokenMock).toHaveBeenCalledWith('client-1')
    expect(copyButton).toHaveTextContent('Скопировано')
  })
})

function buildSummary(
  overrides: Partial<ClientMessengerSummary> = {},
): ClientMessengerSummary {
  return {
    platform: 'Telegram',
    capabilities: {
      visible: true,
      canRead: false,
      canReply: false,
      canCreateLink: true,
      canShowQr: true,
    },
    connection: {
      status: 'NotConnected',
      linkedAt: null,
      telegramUsername: null,
      telegramDisplayName: null,
      pendingLinkExpiresAt: null,
    },
    unreadCount: 0,
    totalMessageCount: 0,
    latestMessageAt: null,
    latestMessage: null,
    ...overrides,
  }
}

function buildLinkToken(
  overrides: Partial<ClientMessengerLinkToken> = {},
): ClientMessengerLinkToken {
  return {
    platform: 'Telegram',
    deepLinkUrl: 'https://t.me/k4pro_admin?start=client-token',
    qrCodeSvg: '<svg viewBox="0 0 10 10"><path d="M0 0h10v10H0z" /></svg>',
    expiresAt: '2026-05-24T12:42:00.000Z',
    connection: {
      status: 'PendingLink',
      linkedAt: null,
      telegramUsername: null,
      telegramDisplayName: null,
      pendingLinkExpiresAt: '2026-05-24T12:42:00.000Z',
    },
    ...overrides,
  }
}

function restoreProperty<T extends object, K extends keyof T>(
  target: T,
  key: K,
  descriptor: PropertyDescriptor | undefined,
) {
  if (descriptor) {
    Object.defineProperty(target, key, descriptor)
    return
  }

  Reflect.deleteProperty(target, key)
}
