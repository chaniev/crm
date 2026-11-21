import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  ApiError,
  createClientMessengerTelegramLinkToken,
  getClientMessengerMessages,
  getClientMessengerSummary,
  markClientMessengerRead,
  sendClientMessengerMessage,
  type ClientMessengerMessagePage,
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
    sendClientMessengerMessage: vi.fn(),
  }
})

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
const originalExecCommand = Object.getOwnPropertyDescriptor(document, 'execCommand')
const originalShare = Object.getOwnPropertyDescriptor(navigator, 'share')

const createLinkTokenMock = vi.mocked(createClientMessengerTelegramLinkToken)
const getMessagesMock = vi.mocked(getClientMessengerMessages)
const getSummaryMock = vi.mocked(getClientMessengerSummary)

beforeEach(() => {
  vi.mocked(markClientMessengerRead).mockReset()
  createLinkTokenMock.mockReset()
  getMessagesMock.mockReset()
  getSummaryMock.mockReset()

  getSummaryMock.mockResolvedValue(buildSummary())
  createLinkTokenMock.mockResolvedValue(buildLinkToken())
})

afterEach(() => {
  vi.restoreAllMocks()
  restoreProperty(navigator, 'clipboard', originalClipboard)
  restoreProperty(document, 'execCommand', originalExecCommand)
  restoreProperty(navigator, 'share', originalShare)
})

describe('ClientMessengerChatSection', () => {
  test.each([false, true])('leaving before history resolves prevents a read receipt (refresh=%s)', async (refresh) => {
    const readable = buildSummary()
    readable.capabilities.canRead = true
    getSummaryMock.mockResolvedValue(readable)
    const page: ClientMessengerMessagePage = { platform: 'Telegram', items: [], skip: 0, take: 50, totalCount: 0, hasMore: false }
    if (refresh) getMessagesMock.mockResolvedValueOnce(page)
    let finish!: (value: ClientMessengerMessagePage) => void
    getMessagesMock.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const view = renderWithProviders(<ClientMessengerChatSection clientId="client-1" />)
    if (refresh) {
      await waitFor(() => expect(markClientMessengerRead).toHaveBeenCalledTimes(1))
      fireEvent.click(screen.getByRole('button', { name: 'Обновить' }))
    }
    await waitFor(() => expect(getMessagesMock).toHaveBeenCalledTimes(refresh ? 2 : 1))
    view.rerender(<ClientMessengerChatSection clientId="client-1" active={false} />)
    await act(async () => finish(page))
    expect(markClientMessengerRead).toHaveBeenCalledTimes(refresh ? 1 : 0)
  })

  test('retains the reply between tabs and retries it after a failed send', async () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() })
    Object.defineProperty(document, 'fonts', { configurable: true, value: new EventTarget() })
    const summary = buildSummary()
    summary.capabilities.canRead = true
    summary.capabilities.canReply = true
    summary.connection.status = 'Connected'
    getSummaryMock.mockResolvedValue(summary)
    getMessagesMock.mockResolvedValue({ platform: 'Telegram', items: [], skip: 0, take: 50, totalCount: 0, hasMore: false })
    vi.mocked(sendClientMessengerMessage).mockRejectedValueOnce(new Error('Сбой отправки')).mockResolvedValueOnce({
      id: 'new', direction: 'Outbound', status: 'Queued', text: 'Ответ', createdAt: '2026-11-21T10:00:00Z',
      updatedAt: '', sentAt: null, failedAt: null, failureReason: null, createdByUserName: null,
      telegramUsername: null, telegramDisplayName: null,
    })
    const view = renderWithProviders(<ClientMessengerChatSection clientId="client-1" />)
    fireEvent.change(await screen.findByRole('textbox'), { target: { value: 'Ответ' } })
    view.rerender(<ClientMessengerChatSection clientId="client-1" active={false} />)
    expect(screen.queryByRole('textbox')).toBeNull()
    view.rerender(<ClientMessengerChatSection clientId="client-1" />)
    expect(await screen.findByRole('textbox')).toHaveValue('Ответ')
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }))
    expect(await screen.findByText('Сбой отправки')).toBeVisible()
    expect(screen.getByRole('textbox')).toHaveValue('Ответ')
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }))
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(''))
    expect(screen.getByText('Ответ')).toBeVisible()
  })

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

    await openLinkModal()

    const copyButton = await screen.findByRole('button', {
      name: 'Скопировать ссылку',
    })
    fireEvent.click(copyButton)

    await waitFor(() => expect(execCommand).toHaveBeenCalledWith('copy'))
    expect(createLinkTokenMock).toHaveBeenCalledWith('client-1')
    expect(copyButton).toHaveTextContent('Скопировано')
  })

  test('opens Telegram share dialog with the generated deep link', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)

    renderWithProviders(<ClientMessengerChatSection clientId="client-1" />)

    await openLinkModal()

    fireEvent.click(screen.getByRole('button', { name: 'Отправить в Telegram' }))

    expect(open).toHaveBeenCalledWith(
      expect.stringContaining('https://t.me/share/url?'),
      '_blank',
      'noopener,noreferrer',
    )

    const shareUrl = new URL(String(open.mock.calls[0]?.[0]))
    expect(`${shareUrl.origin}${shareUrl.pathname}`).toBe('https://t.me/share/url')
    expect(shareUrl.searchParams.get('url')).toBe(
      'https://t.me/k4pro_admin?start=client-token',
    )
    expect(shareUrl.searchParams.get('text')).toContain('Telegram-чат')
  })

  test('opens the generated deep link directly', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)

    renderWithProviders(<ClientMessengerChatSection clientId="client-1" />)

    await openLinkModal()

    fireEvent.click(screen.getByRole('button', { name: 'Открыть Telegram' }))

    expect(open).toHaveBeenCalledWith(
      'https://t.me/k4pro_admin?start=client-token',
      '_blank',
      'noopener,noreferrer',
    )
  })

  test('shows backend link-token validation details', async () => {
    createLinkTokenMock.mockRejectedValue(
      new ApiError('Не удалось выполнить запрос.', 400, {
        botUsername: [
          'Укажите ClientTelegram__BotUsername в формате gym_client_bot.',
        ],
      }),
    )

    renderWithProviders(<ClientMessengerChatSection clientId="client-1" />)

    const linkButtons = await screen.findAllByRole('button', {
      name: 'Ссылка и QR',
    })
    fireEvent.click(linkButtons[0])

    expect(
      await screen.findByText(
        'Укажите ClientTelegram__BotUsername в формате gym_client_bot.',
      ),
    ).toBeInTheDocument()
  })

  test('uses native share when the browser supports it', async () => {
    const share = vi.fn().mockResolvedValue(undefined)

    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: share,
    })

    renderWithProviders(<ClientMessengerChatSection clientId="client-1" />)

    await openLinkModal()

    fireEvent.click(screen.getByRole('button', { name: 'Поделиться' }))

    await waitFor(() =>
      expect(share).toHaveBeenCalledWith({
        title: 'Подключение Telegram',
        text: expect.stringContaining('Telegram-чат'),
        url: 'https://t.me/k4pro_admin?start=client-token',
      }),
    )
  })
})

async function openLinkModal() {
  const linkButtons = await screen.findAllByRole('button', {
    name: 'Ссылка и QR',
  })

  fireEvent.click(linkButtons[0])

  return screen.findByText('https://t.me/k4pro_admin?start=client-token')
}

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
