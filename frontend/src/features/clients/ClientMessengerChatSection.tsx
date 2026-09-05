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
import { fe8ClientMessengerMediaText } from '../../resources/fe-8-client-messenger-media'


type ClientMessengerChatSectionProps = {
  clientId: string
}

const messagesTake = 50

const messageStatusLabels: Record<ClientMessengerMessage['status'], string> = {
  Received: fe8ClientMessengerMediaText.clientMessengerChatSection_received_06124cee,
  Queued: fe8ClientMessengerMediaText.clientMessengerChatSection_queued_b22a2454,
  Sending: fe8ClientMessengerMediaText.clientMessengerChatSection_sending_9ef21e53,
  SentToTelegram: fe8ClientMessengerMediaText.clientMessengerChatSection_sentToTelegram_13b9719a,
  Failed: fe8ClientMessengerMediaText.clientMessengerChatSection_failed_bf22dfee,
}

const messageStatusColors: Record<ClientMessengerMessage['status'], string> = {
  Received: 'teal',
  Queued: 'gray',
  Sending: 'blue',
  SentToTelegram: 'teal',
  Failed: 'red',
}

const telegramShareText =
  fe8ClientMessengerMediaText.clientMessengerChatSection_telegramShareText_b8bb4077

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
            : fe8ClientMessengerMediaText.clientMessengerChatSection_string_33c27632,
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
          : fe8ClientMessengerMediaText.clientMessengerChatSection_string_33c27632,
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
        title: fe8ClientMessengerMediaText.clientMessengerChatSection_title_c3386376,
        message:
          error instanceof Error
            ? error.message
            : fe8ClientMessengerMediaText.clientMessengerChatSection_string_43bf26a8,
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
        getApiErrorMessage(error, fe8ClientMessengerMediaText.clientMessengerChatSection_getApiErrorMessage_850ac5ad),
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
        fe8ClientMessengerMediaText.clientMessengerChatSection_setLinkCopyError_fe355f11,
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
        title: fe8ClientMessengerMediaText.clientMessengerChatSection_title_2d65bc85,
        text: telegramShareText,
        url: linkToken.deepLinkUrl,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }

      setLinkShareError(
        fe8ClientMessengerMediaText.clientMessengerChatSection_setLinkShareError_b9df5845,
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
          : fe8ClientMessengerMediaText.clientMessengerChatSection_string_a78ea756,
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
            <ThemeIcon color="var(--crm-action-primary)" radius="xl" size={34} variant="light">
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
              {fe8ClientMessengerMediaText.clientMessengerChatSection_jsxText_603e460b}</Button>
            {canCreateLink && !connected ? (
              <Button
                leftSection={<IconQrcode size={18} />}
                loading={linkCreating}
                onClick={() => void createLinkToken()}
                variant="light"
              >
                {fe8ClientMessengerMediaText.clientMessengerChatSection_jsxText_0465921b}</Button>
            ) : null}
          </Group>
        </Group>

        {loading ? (
          <Group justify="center" py="xl">
            <Loader color="var(--crm-action-primary)" />
            <Text c="dimmed" size="sm">
              {fe8ClientMessengerMediaText.clientMessengerChatSection_jsxText_bb442dee}</Text>
          </Group>
        ) : null}

        {!loading && loadError ? (
          <Alert
            color="red"
            icon={<IconAlertCircle size={18} />}
            title={fe8ClientMessengerMediaText.clientMessengerChatSection_string_33c27632}
            variant="light"
          >
            <Stack gap="sm">
              <Text size="sm">{loadError}</Text>
              <Group>
                <Button onClick={() => void refresh()} variant="light">
                  {fe8ClientMessengerMediaText.clientMessengerChatSection_jsxText_5189135a}</Button>
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
                    ? fe8ClientMessengerMediaText.clientMessengerChatSection_string_c917e434
                    : fe8ClientMessengerMediaText.clientMessengerChatSection_string_d33ec712
                }
                variant="light"
              >
                <Stack gap="sm">
                  <Text size="sm">
                    {canCreateLink
                      ? fe8ClientMessengerMediaText.clientMessengerChatSection_string_4b14a61e
                      : fe8ClientMessengerMediaText.clientMessengerChatSection_string_9372e5cf}
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
                        {fe8ClientMessengerMediaText.clientMessengerChatSection_jsxText_0465921b}</Button>
                    </Group>
                  ) : null}
                </Stack>
              </Alert>
            ) : null}

            {connected ? (
              <Stack gap="md">
                <Group gap="xs" wrap="wrap">
                  <Badge color="teal" radius="xl" variant="light">
                    {fe8ClientMessengerMediaText.clientMessengerChatSection_jsxText_a9a7ca66}</Badge>
                  {summary?.connection.telegramDisplayName ? (
                    <Text c="dimmed" size="sm">
                      {summary.connection.telegramDisplayName}
                    </Text>
                  ) : null}
                  {summary?.connection.telegramUsername ? (
                    <Text c="dimmed" size="sm">
                      {fe8ClientMessengerMediaText.clientMessengerChatSection_jsxText_c3641f85}{summary.connection.telegramUsername}
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
                            {fe8ClientMessengerMediaText.clientMessengerChatSection_jsxText_010ff624}</Button>
                        </Group>
                      ) : null}

                      {hasMessages ? (
                        messages.map((message) => (
                          <MessageCard key={message.id} message={message} />
                        ))
                      ) : (
                        <Text c="dimmed" py="lg" ta="center">
                          {fe8ClientMessengerMediaText.clientMessengerChatSection_jsxText_0994139f}</Text>
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
                      placeholder={fe8ClientMessengerMediaText.clientMessengerChatSection_placeholder_aac0c410}
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
                        {sending ? fe8ClientMessengerMediaText.clientMessengerChatSection_string_8192855b : fe8ClientMessengerMediaText.clientMessengerChatSection_string_ceb68a92}
                      </Button>
                    </Group>
                  </Stack>
                ) : (
                  <Alert color="gray" variant="light">
                    {fe8ClientMessengerMediaText.clientMessengerChatSection_jsxText_3b46e89c}</Alert>
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
        title={fe8ClientMessengerMediaText.clientMessengerChatSection_title_2d65bc85}
      >
        {linkToken ? (
          <Stack gap="md">
            <Text c="dimmed" size="sm">
              {fe8ClientMessengerMediaText.clientMessengerChatSection_jsxText_af9f52ba}</Text>
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
                  {fe8ClientMessengerMediaText.clientMessengerChatSection_jsxText_97b87834}{formatDateTime(linkToken.expiresAt)}
                </Text>
                <Button
                  fullWidth
                  leftSection={<IconBrandTelegram size={18} />}
                  onClick={openTelegramShare}
                >
                  {fe8ClientMessengerMediaText.clientMessengerChatSection_jsxText_420572a1}</Button>
                {canUseNativeShare ? (
                  <Button
                    fullWidth
                    leftSection={<IconShare2 size={18} />}
                    onClick={() => void shareLink()}
                    variant="light"
                  >
                    {fe8ClientMessengerMediaText.clientMessengerChatSection_jsxText_dc120821}</Button>
                ) : null}
                <Button
                  fullWidth
                  leftSection={<IconExternalLink size={18} />}
                  onClick={openTelegramLink}
                  variant="light"
                >
                  {fe8ClientMessengerMediaText.clientMessengerChatSection_jsxText_fb72b78f}</Button>
                <Button
                  color={linkCopied ? 'teal' : 'brand'}
                  fullWidth
                  leftSection={<IconCopy size={18} />}
                  loading={linkCopying}
                  onClick={() => void copyLink()}
                  variant="light"
                >
                  {linkCopied ? fe8ClientMessengerMediaText.clientMessengerChatSection_string_d2d08c71 : fe8ClientMessengerMediaText.clientMessengerChatSection_string_8d810136}
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
    : message.telegramDisplayName ?? message.telegramUsername ?? fe8ClientMessengerMediaText.clientMessengerChatSection_string_3e622aec

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
    return fe8ClientMessengerMediaText.clientMessengerChatSection_string_1fe35c6e
  }

  if (summary.connection.status === 'Connected') {
    return fe8ClientMessengerMediaText.clientMessengerChatSection_jsxText_a9a7ca66
  }

  if (summary.connection.status === 'PendingLink') {
    return summary.connection.pendingLinkExpiresAt
      ? fe8ClientMessengerMediaText.clientMessengerChatSection_template_e9da7455(formatDateTime(summary.connection.pendingLinkExpiresAt))
      : fe8ClientMessengerMediaText.clientMessengerChatSection_string_2a93cc16
  }

  return fe8ClientMessengerMediaText.clientMessengerChatSection_string_64db2165
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return fe8ClientMessengerMediaText.clientMessengerChatSection_string_89439c68
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

function getApiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    const fieldMessage = Object.values(error.fieldErrors)
      .flat()
      .find((message) => message)
    return fieldMessage ?? error.message
  }

  return error instanceof Error ? error.message : fallback
}
