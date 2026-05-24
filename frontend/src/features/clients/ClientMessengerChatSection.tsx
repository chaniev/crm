import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconBrandTelegram,
  IconCopy,
  IconExternalLink,
  IconMessageCircle,
  IconQrcode,
  IconRefresh,
  IconSend,
  IconShare2,
} from '@tabler/icons-react'
import {
  ApiError,
  createClientMessengerTelegramLinkToken,
  getClientMessengerMessages,
  getClientMessengerSummary,
  markClientMessengerRead,
  sendClientMessengerMessage,
  type ClientMessengerLinkToken,
  type ClientMessengerMessage,
  type ClientMessengerSummary,
} from '../../lib/api'
import { copyTextToClipboard } from '../shared/clipboard'
import { PageSection } from '../shared/ux'
import { showAppNotification } from '../shared/notifications'

type ClientMessengerChatSectionProps = {
  clientId: string
}

const messagesTake = 50

const messageStatusLabels: Record<ClientMessengerMessage['status'], string> = {
  Received: 'Получено',
  Queued: 'В очереди',
  Sending: 'Отправка',
  SentToTelegram: 'Отправлено',
  Failed: 'Ошибка',
}

const messageStatusColors: Record<ClientMessengerMessage['status'], string> = {
  Received: 'teal',
  Queued: 'gray',
  Sending: 'blue',
  SentToTelegram: 'teal',
  Failed: 'red',
}

const telegramShareText =
  'Откройте ссылку, чтобы подключить Telegram-чат к CRM.'

export function ClientMessengerChatSection({
  clientId,
}: ClientMessengerChatSectionProps) {
  const [hidden, setHidden] = useState(false)
  const [summary, setSummary] = useState<ClientMessengerSummary | null>(null)
  const [messages, setMessages] = useState<ClientMessengerMessage[]>([])
  const [messageSkip, setMessageSkip] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [linkCreating, setLinkCreating] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [linkToken, setLinkToken] = useState<ClientMessengerLinkToken | null>(null)
  const [linkModalOpened, setLinkModalOpened] = useState(false)
  const [linkCopying, setLinkCopying] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [linkCopyError, setLinkCopyError] = useState<string | null>(null)
  const [linkShareError, setLinkShareError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const linkCopiedTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setLoadError(null)
      setHidden(false)
      setLinkToken(null)

      try {
        const nextSummary = await getClientMessengerSummary(
          clientId,
          controller.signal,
        )

        if (!nextSummary.capabilities.visible) {
          setHidden(true)
          return
        }

        setSummary(nextSummary)

        if (nextSummary.capabilities.canRead) {
          const initialSkip = Math.max(
            nextSummary.totalMessageCount - messagesTake,
            0,
          )
          const nextMessages = await getClientMessengerMessages(
            clientId,
            { skip: initialSkip, take: messagesTake },
            controller.signal,
          )
          setMessages(nextMessages.items)
          setMessageSkip(initialSkip)

          await markClientMessengerRead(clientId)
          setSummary({
            ...nextSummary,
            unreadCount: 0,
          })
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        if (error instanceof ApiError && error.status === 403) {
          setHidden(true)
          return
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить переписку.',
        )
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => controller.abort()
  }, [clientId])

  useEffect(() => {
    if (!scrollRef.current) {
      return
    }

    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages.length])

  useEffect(
    () => () => {
      clearLinkCopiedTimeout()
    },
    [],
  )

  if (hidden) {
    return null
  }

  const canReply = summary?.capabilities.canReply ?? false
  const canCreateLink = summary?.capabilities.canCreateLink ?? false
  const connected = summary?.connection.status === 'Connected'
  const pendingLink = summary?.connection.status === 'PendingLink'
  const hasMessages = messages.length > 0
  const hasOlderMessages = messageSkip > 0
  const canUseNativeShare = typeof navigator.share === 'function'

  async function refresh() {
    setLoading(true)
    setLoadError(null)

    try {
      const nextSummary = await getClientMessengerSummary(clientId)
      setSummary(nextSummary)

      if (nextSummary.capabilities.canRead) {
        const initialSkip = Math.max(
          nextSummary.totalMessageCount - messagesTake,
          0,
        )
        const nextMessages = await getClientMessengerMessages(clientId, {
          skip: initialSkip,
          take: messagesTake,
        })
        setMessages(nextMessages.items)
        setMessageSkip(initialSkip)
        await markClientMessengerRead(clientId)
        setSummary({
          ...nextSummary,
          unreadCount: 0,
        })
      }
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Не удалось загрузить переписку.',
      )
    } finally {
      setLoading(false)
    }
  }

  async function loadOlderMessages() {
    setLoadingMore(true)

    try {
      const nextSkip = Math.max(messageSkip - messagesTake, 0)
      const nextTake = messageSkip - nextSkip
      const page = await getClientMessengerMessages(clientId, {
        skip: nextSkip,
        take: nextTake,
      })
      setMessages((currentMessages) => [...page.items, ...currentMessages])
      setMessageSkip(nextSkip)
    } catch (error) {
      showAppNotification({
        id: `client-messenger-load-more-${clientId}`,
        title: 'Переписка не загрузилась',
        message:
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить более ранние сообщения.',
        color: 'red',
      })
    } finally {
      setLoadingMore(false)
    }
  }

  async function createLinkToken() {
    setLinkCreating(true)
    setLinkError(null)
    resetLinkCopyState()

    try {
      const nextLinkToken = await createClientMessengerTelegramLinkToken(clientId)
      setLinkToken(nextLinkToken)
      setLinkModalOpened(true)
      setSummary((currentSummary) =>
        currentSummary
          ? {
              ...currentSummary,
              connection: nextLinkToken.connection,
            }
          : currentSummary,
      )
    } catch (error) {
      setLinkError(
        error instanceof Error
          ? error.message
          : 'Не удалось создать ссылку подключения.',
      )
    } finally {
      setLinkCreating(false)
    }
  }

  function clearLinkCopiedTimeout() {
    if (linkCopiedTimeoutRef.current !== null) {
      window.clearTimeout(linkCopiedTimeoutRef.current)
      linkCopiedTimeoutRef.current = null
    }
  }

  function resetLinkCopyState() {
    clearLinkCopiedTimeout()
    setLinkCopying(false)
    setLinkCopied(false)
    setLinkCopyError(null)
    setLinkShareError(null)
  }

  function closeLinkModal() {
    setLinkModalOpened(false)
    resetLinkCopyState()
  }

  async function copyLink() {
    if (!linkToken?.deepLinkUrl || linkCopying) {
      return
    }

    setLinkCopying(true)
    setLinkCopyError(null)

    const copied = await copyTextToClipboard(linkToken.deepLinkUrl)

    setLinkCopying(false)

    if (!copied) {
      setLinkCopied(false)
      setLinkCopyError(
        'Не удалось скопировать автоматически. Выделите ссылку и скопируйте вручную.',
      )
      return
    }

    setLinkCopied(true)
    clearLinkCopiedTimeout()
    linkCopiedTimeoutRef.current = window.setTimeout(() => {
      setLinkCopied(false)
      linkCopiedTimeoutRef.current = null
    }, 2_000)
  }

  function openTelegramLink() {
    if (!linkToken?.deepLinkUrl) {
      return
    }

    openExternalUrl(linkToken.deepLinkUrl)
  }

  function openTelegramShare() {
    if (!linkToken?.deepLinkUrl) {
      return
    }

    openExternalUrl(buildTelegramShareUrl(linkToken.deepLinkUrl))
  }

  async function shareLink() {
    if (!linkToken?.deepLinkUrl || typeof navigator.share !== 'function') {
      return
    }

    setLinkShareError(null)

    try {
      await navigator.share({
        title: 'Подключение Telegram',
        text: telegramShareText,
        url: linkToken.deepLinkUrl,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }

      setLinkShareError(
        'Не удалось открыть системное меню. Отправьте ссылку в Telegram или скопируйте ее.',
      )
    }
  }

  async function sendMessage() {
    const text = draft.trim()
    if (!text || sending) {
      return
    }

    setSending(true)
    setSendError(null)

    try {
      const idempotencyKey =
        typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`
      const sentMessage = await sendClientMessengerMessage(
        clientId,
        text,
        idempotencyKey,
      )

      setMessages((currentMessages) => [...currentMessages, sentMessage])
      setDraft('')
      textareaRef.current?.focus()
      setSummary((currentSummary) =>
        currentSummary
          ? {
              ...currentSummary,
              totalMessageCount: currentSummary.totalMessageCount + 1,
              latestMessageAt: sentMessage.createdAt,
              latestMessage: {
                id: sentMessage.id,
                direction: sentMessage.direction,
                status: sentMessage.status,
                text: sentMessage.text,
                createdAt: sentMessage.createdAt,
              },
            }
          : currentSummary,
      )
    } catch (error) {
      setSendError(
        error instanceof Error
          ? error.message
          : 'Не удалось отправить сообщение.',
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <PageSection className="client-section-card client-messenger-section">
      <Stack gap="lg">
        <Group justify="space-between" wrap="wrap">
          <Group gap="xs">
            <ThemeIcon color="brand.7" radius="xl" size={34} variant="light">
              <IconBrandTelegram size={18} />
            </ThemeIcon>
            <div>
              <Group gap="xs" wrap="wrap">
                <Text fw={700}>Telegram</Text>
                {summary?.unreadCount ? (
                  <Badge color="red" radius="xl" variant="filled">
                    {summary.unreadCount}
                  </Badge>
                ) : null}
              </Group>
              <Text c="dimmed" size="sm">
                {getConnectionText(summary)}
              </Text>
            </div>
          </Group>

          <Group gap="xs" wrap="wrap">
            <Button
              leftSection={<IconRefresh size={18} />}
              loading={loading}
              onClick={() => void refresh()}
              variant="light"
            >
              Обновить
            </Button>
            {canCreateLink && !connected ? (
              <Button
                leftSection={<IconQrcode size={18} />}
                loading={linkCreating}
                onClick={() => void createLinkToken()}
                variant="light"
              >
                Ссылка и QR
              </Button>
            ) : null}
          </Group>
        </Group>

        {loading ? (
          <Group justify="center" py="xl">
            <Loader color="brand.7" />
            <Text c="dimmed" size="sm">
              Загружаем переписку...
            </Text>
          </Group>
        ) : null}

        {!loading && loadError ? (
          <Alert
            color="red"
            icon={<IconAlertCircle size={18} />}
            title="Не удалось загрузить переписку."
            variant="light"
          >
            <Stack gap="sm">
              <Text size="sm">{loadError}</Text>
              <Group>
                <Button onClick={() => void refresh()} variant="light">
                  Повторить
                </Button>
              </Group>
            </Stack>
          </Alert>
        ) : null}

        {!loading && !loadError ? (
          <>
            {!connected ? (
              <Alert
                color={pendingLink ? 'blue' : 'gray'}
                icon={<IconMessageCircle size={18} />}
                title={
                  pendingLink
                    ? 'Клиент еще не открыл чат в Telegram.'
                    : 'Telegram не подключен.'
                }
                variant="light"
              >
                <Stack gap="sm">
                  <Text size="sm">
                    {canCreateLink
                      ? 'Сгенерируйте ссылку или покажите QR-код, чтобы клиент начал диалог.'
                      : 'Доступ к переписке появится после подключения клиента.'}
                  </Text>
                  {linkError ? (
                    <Text c="red" size="sm">
                      {linkError}
                    </Text>
                  ) : null}
                  {canCreateLink ? (
                    <Group>
                      <Button
                        leftSection={<IconQrcode size={18} />}
                        loading={linkCreating}
                        onClick={() => void createLinkToken()}
                      >
                        Ссылка и QR
                      </Button>
                    </Group>
                  ) : null}
                </Stack>
              </Alert>
            ) : null}

            {connected ? (
              <Stack gap="md">
                <Group gap="xs" wrap="wrap">
                  <Badge color="teal" radius="xl" variant="light">
                    Чат подключен
                  </Badge>
                  {summary?.connection.telegramDisplayName ? (
                    <Text c="dimmed" size="sm">
                      {summary.connection.telegramDisplayName}
                    </Text>
                  ) : null}
                  {summary?.connection.telegramUsername ? (
                    <Text c="dimmed" size="sm">
                      @{summary.connection.telegramUsername}
                    </Text>
                  ) : null}
                </Group>

                <Paper className="client-messenger-history" radius="8px" withBorder>
                  <ScrollArea.Autosize
                    mah={440}
                    viewportRef={scrollRef}
                    type="auto"
                  >
                    <Stack gap="sm" p="sm">
                      {hasOlderMessages ? (
                        <Group justify="center">
                          <Button
                            loading={loadingMore}
                            onClick={() => void loadOlderMessages()}
                            size="xs"
                            variant="subtle"
                          >
                            Загрузить еще
                          </Button>
                        </Group>
                      ) : null}

                      {hasMessages ? (
                        messages.map((message) => (
                          <MessageCard key={message.id} message={message} />
                        ))
                      ) : (
                        <Text c="dimmed" py="lg" ta="center">
                          Чат подключен, сообщений пока нет.
                        </Text>
                      )}
                    </Stack>
                  </ScrollArea.Autosize>
                </Paper>

                {canReply ? (
                  <Stack gap="xs">
                    <Textarea
                      autosize
                      disabled={sending}
                      maxRows={6}
                      minRows={2}
                      onChange={(event) => setDraft(event.currentTarget.value)}
                      placeholder="Введите сообщение клиенту"
                      ref={textareaRef}
                      value={draft}
                    />
                    {sendError ? (
                      <Text c="red" size="sm">
                        {sendError}
                      </Text>
                    ) : null}
                    <Group justify="flex-end">
                      <Button
                        disabled={!draft.trim()}
                        leftSection={<IconSend size={18} />}
                        loading={sending}
                        onClick={() => void sendMessage()}
                      >
                        {sending ? 'Отправка...' : 'Отправить'}
                      </Button>
                    </Group>
                  </Stack>
                ) : (
                  <Alert color="gray" variant="light">
                    Доступ только для чтения. Отправка сообщений доступна администратору.
                  </Alert>
                )}
              </Stack>
            ) : null}
          </>
        ) : null}
      </Stack>

      <Modal
        centered
        onClose={closeLinkModal}
        opened={linkModalOpened}
        radius="8px"
        size="lg"
        title="Подключение Telegram"
      >
        {linkToken ? (
          <Stack gap="md">
            <Text c="dimmed" size="sm">
              Отправьте клиенту ссылку или дайте отсканировать QR-код.
            </Text>
            <Group align="flex-start" gap="lg" wrap="wrap">
              <div
                className="client-messenger-qr"
                dangerouslySetInnerHTML={{ __html: linkToken.qrCodeSvg }}
              />
              <Stack className="client-messenger-link-stack" gap="sm">
                <Text className="client-messenger-link" size="sm">
                  {linkToken.deepLinkUrl}
                </Text>
                <Text c="dimmed" size="sm">
                  Действует до {formatDateTime(linkToken.expiresAt)}
                </Text>
                <Button
                  fullWidth
                  leftSection={<IconBrandTelegram size={18} />}
                  onClick={openTelegramShare}
                >
                  Отправить в Telegram
                </Button>
                {canUseNativeShare ? (
                  <Button
                    fullWidth
                    leftSection={<IconShare2 size={18} />}
                    onClick={() => void shareLink()}
                    variant="light"
                  >
                    Поделиться
                  </Button>
                ) : null}
                <Button
                  fullWidth
                  leftSection={<IconExternalLink size={18} />}
                  onClick={openTelegramLink}
                  variant="light"
                >
                  Открыть Telegram
                </Button>
                <Button
                  color={linkCopied ? 'teal' : 'brand'}
                  fullWidth
                  leftSection={<IconCopy size={18} />}
                  loading={linkCopying}
                  onClick={() => void copyLink()}
                  variant="light"
                >
                  {linkCopied ? 'Скопировано' : 'Скопировать ссылку'}
                </Button>
                {linkCopyError ? (
                  <Text c="red" size="sm">
                    {linkCopyError}
                  </Text>
                ) : null}
                {linkShareError ? (
                  <Text c="red" size="sm">
                    {linkShareError}
                  </Text>
                ) : null}
              </Stack>
            </Group>
          </Stack>
        ) : null}
      </Modal>
    </PageSection>
  )
}

function MessageCard({ message }: { message: ClientMessengerMessage }) {
  const outbound = message.direction === 'Outbound'
  const title = outbound
    ? message.createdByUserName ?? 'CRM'
    : message.telegramDisplayName ?? message.telegramUsername ?? 'Клиент'

  return (
    <Paper
      className={
        outbound
          ? 'client-messenger-message client-messenger-message--outbound'
          : 'client-messenger-message'
      }
      radius="8px"
      withBorder
    >
      <Stack gap={6}>
        <Group justify="space-between" wrap="wrap">
          <Text fw={700} size="sm">
            {title}
          </Text>
          <Group gap="xs" wrap="wrap">
            <Text c="dimmed" size="xs">
              {formatDateTime(message.createdAt)}
            </Text>
            <Badge
              color={messageStatusColors[message.status]}
              radius="xl"
              size="sm"
              variant="light"
            >
              {messageStatusLabels[message.status]}
            </Badge>
          </Group>
        </Group>
        <Text size="sm" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          {message.text}
        </Text>
        {message.status === 'Failed' && message.failureReason ? (
          <Text c="red" size="xs">
            {message.failureReason}
          </Text>
        ) : null}
      </Stack>
    </Paper>
  )
}

function getConnectionText(summary: ClientMessengerSummary | null) {
  if (!summary) {
    return 'Telegram-чат клиента'
  }

  if (summary.connection.status === 'Connected') {
    return 'Чат подключен'
  }

  if (summary.connection.status === 'PendingLink') {
    return summary.connection.pendingLinkExpiresAt
      ? `Ожидаем подключение до ${formatDateTime(summary.connection.pendingLinkExpiresAt)}`
      : 'Ожидаем подключение клиента'
  }

  return 'Клиент еще не подключил Telegram'
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'дата не указана'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function buildTelegramShareUrl(deepLinkUrl: string) {
  const searchParams = new URLSearchParams({
    url: deepLinkUrl,
    text: telegramShareText,
  })

  return `https://t.me/share/url?${searchParams.toString()}`
}

function openExternalUrl(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}
