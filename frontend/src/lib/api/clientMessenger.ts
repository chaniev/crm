import { API_ENDPOINTS } from './endpoints'
import {
  isRecord,
  readBoolean,
  readNumber,
  readString,
} from './read-helpers'
import { request } from './transport'
import type {
  ClientMessengerCapabilities,
  ClientMessengerConnection,
  ClientMessengerConnectionStatus,
  ClientMessengerLatestMessage,
  ClientMessengerLinkToken,
  ClientMessengerMessage,
  ClientMessengerMessageDirection,
  ClientMessengerMessagePage,
  ClientMessengerMessageStatus,
  ClientMessengerReadState,
  ClientMessengerSummary,
  MessengerPlatform,
} from './types'

const connectionStatuses = new Set<ClientMessengerConnectionStatus>([
  'NotConnected',
  'PendingLink',
  'Connected',
])
const messageDirections = new Set<ClientMessengerMessageDirection>([
  'Inbound',
  'Outbound',
])
const messageStatuses = new Set<ClientMessengerMessageStatus>([
  'Received',
  'Queued',
  'Sending',
  'SentToTelegram',
  'Failed',
])

export async function getClientMessengerSummary(
  clientId: string,
  signal?: AbortSignal,
) {
  const payload = await request<unknown>(
    API_ENDPOINTS.clients.messenger.telegram.summary(clientId),
    { signal },
  )

  return mapClientMessengerSummary(payload)
}

export async function getClientMessengerMessages(
  clientId: string,
  params: { skip?: number; take?: number } = {},
  signal?: AbortSignal,
) {
  const searchParams = new URLSearchParams()
  if (typeof params.skip === 'number') {
    searchParams.set('skip', String(params.skip))
  }

  if (typeof params.take === 'number') {
    searchParams.set('take', String(params.take))
  }

  const query = searchParams.toString()
  const payload = await request<unknown>(
    `${API_ENDPOINTS.clients.messenger.telegram.messages(clientId)}${
      query ? `?${query}` : ''
    }`,
    { signal },
  )

  return mapClientMessengerMessagePage(payload)
}

export async function createClientMessengerTelegramLinkToken(clientId: string) {
  const payload = await request<unknown>(
    API_ENDPOINTS.clients.messenger.telegram.linkToken(clientId),
    { method: 'POST' },
  )

  return mapClientMessengerLinkToken(payload)
}

export async function sendClientMessengerMessage(
  clientId: string,
  text: string,
  idempotencyKey: string,
) {
  const payload = await request<unknown>(
    API_ENDPOINTS.clients.messenger.telegram.messages(clientId),
    {
      method: 'POST',
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        text,
        idempotencyKey,
      }),
    },
  )

  return mapClientMessengerMessage(payload)
}

export async function markClientMessengerRead(clientId: string) {
  const payload = await request<unknown>(
    API_ENDPOINTS.clients.messenger.telegram.read(clientId),
    { method: 'POST' },
  )

  return mapClientMessengerReadState(payload)
}

export function mapClientMessengerSummary(payload: unknown): ClientMessengerSummary {
  const record = isRecord(payload) ? payload : {}
  const latestMessage = readRecord(record, ['latestMessage', 'LatestMessage'])

  return {
    platform: mapPlatform(readString(record, ['platform', 'Platform'])),
    capabilities: mapCapabilities(
      readRecord(record, ['capabilities', 'Capabilities']),
    ),
    connection: mapConnection(readRecord(record, ['connection', 'Connection'])),
    unreadCount: readNumber(record, ['unreadCount', 'UnreadCount']) ?? 0,
    totalMessageCount:
      readNumber(record, ['totalMessageCount', 'TotalMessageCount']) ?? 0,
    latestMessageAt: readNullableString(record, [
      'latestMessageAt',
      'LatestMessageAt',
    ]),
    latestMessage: latestMessage ? mapLatestMessage(latestMessage) : null,
  }
}

export function mapClientMessengerMessagePage(
  payload: unknown,
): ClientMessengerMessagePage {
  const record = isRecord(payload) ? payload : {}
  const rawItems = readArray(record, ['items', 'Items', 'messages', 'Messages'])
  const items = rawItems.map(mapClientMessengerMessage)

  return {
    platform: mapPlatform(readString(record, ['platform', 'Platform'])),
    items,
    skip: readNumber(record, ['skip', 'Skip']) ?? 0,
    take: readNumber(record, ['take', 'Take']) ?? items.length,
    totalCount: readNumber(record, ['totalCount', 'TotalCount']) ?? items.length,
    hasMore: readBoolean(record, ['hasMore', 'HasMore']) ?? false,
  }
}

export function mapClientMessengerLinkToken(
  payload: unknown,
): ClientMessengerLinkToken {
  const record = isRecord(payload) ? payload : {}

  return {
    platform: mapPlatform(readString(record, ['platform', 'Platform'])),
    deepLinkUrl: readString(record, ['deepLinkUrl', 'DeepLinkUrl']) ?? '',
    qrCodeSvg: readString(record, ['qrCodeSvg', 'QrCodeSvg']) ?? '',
    expiresAt: readString(record, ['expiresAt', 'ExpiresAt']) ?? '',
    connection: mapConnection(readRecord(record, ['connection', 'Connection'])),
  }
}

export function mapClientMessengerMessage(payload: unknown): ClientMessengerMessage {
  const record = isRecord(payload) ? payload : {}

  return {
    id: readString(record, ['id', 'Id']) ?? '',
    direction: mapDirection(readString(record, ['direction', 'Direction'])),
    status: mapStatus(readString(record, ['status', 'Status'])),
    text: readString(record, ['text', 'Text']) ?? '',
    createdAt: readString(record, ['createdAt', 'CreatedAt']) ?? '',
    updatedAt: readString(record, ['updatedAt', 'UpdatedAt']) ?? '',
    sentAt: readNullableString(record, ['sentAt', 'SentAt']),
    failedAt: readNullableString(record, ['failedAt', 'FailedAt']),
    failureReason: readNullableString(record, [
      'failureReason',
      'FailureReason',
    ]),
    createdByUserName: readNullableString(record, [
      'createdByUserName',
      'CreatedByUserName',
    ]),
    telegramUsername: readNullableString(record, [
      'telegramUsername',
      'TelegramUsername',
    ]),
    telegramDisplayName: readNullableString(record, [
      'telegramDisplayName',
      'TelegramDisplayName',
    ]),
  }
}

export function mapClientMessengerReadState(
  payload: unknown,
): ClientMessengerReadState {
  const record = isRecord(payload) ? payload : {}

  return {
    platform: mapPlatform(readString(record, ['platform', 'Platform'])),
    lastReadAt: readString(record, ['lastReadAt', 'LastReadAt']) ?? '',
    unreadCount: readNumber(record, ['unreadCount', 'UnreadCount']) ?? 0,
  }
}

function mapCapabilities(
  record: Record<string, unknown> | null,
): ClientMessengerCapabilities {
  return {
    visible: readBoolean(record ?? {}, ['visible', 'Visible']) ?? false,
    canRead: readBoolean(record ?? {}, ['canRead', 'CanRead']) ?? false,
    canReply: readBoolean(record ?? {}, ['canReply', 'CanReply']) ?? false,
    canCreateLink:
      readBoolean(record ?? {}, ['canCreateLink', 'CanCreateLink']) ?? false,
    canShowQr: readBoolean(record ?? {}, ['canShowQr', 'CanShowQr']) ?? false,
  }
}

function mapConnection(
  record: Record<string, unknown> | null,
): ClientMessengerConnection {
  return {
    status: mapConnectionStatus(readString(record ?? {}, ['status', 'Status'])),
    linkedAt: readNullableString(record ?? {}, ['linkedAt', 'LinkedAt']),
    telegramUsername: readNullableString(record ?? {}, [
      'telegramUsername',
      'TelegramUsername',
    ]),
    telegramDisplayName: readNullableString(record ?? {}, [
      'telegramDisplayName',
      'TelegramDisplayName',
    ]),
    pendingLinkExpiresAt: readNullableString(record ?? {}, [
      'pendingLinkExpiresAt',
      'PendingLinkExpiresAt',
    ]),
  }
}

function mapLatestMessage(
  record: Record<string, unknown>,
): ClientMessengerLatestMessage {
  return {
    id: readString(record, ['id', 'Id']) ?? '',
    direction: mapDirection(readString(record, ['direction', 'Direction'])),
    status: mapStatus(readString(record, ['status', 'Status'])),
    text: readString(record, ['text', 'Text']) ?? '',
    createdAt: readString(record, ['createdAt', 'CreatedAt']) ?? '',
  }
}

function mapPlatform(platform?: string): MessengerPlatform {
  return platform === 'Telegram' ? 'Telegram' : 'Telegram'
}

function mapConnectionStatus(
  status?: string,
): ClientMessengerConnectionStatus {
  return connectionStatuses.has(status as ClientMessengerConnectionStatus)
    ? (status as ClientMessengerConnectionStatus)
    : 'NotConnected'
}

function mapDirection(direction?: string): ClientMessengerMessageDirection {
  return messageDirections.has(direction as ClientMessengerMessageDirection)
    ? (direction as ClientMessengerMessageDirection)
    : 'Inbound'
}

function mapStatus(status?: string): ClientMessengerMessageStatus {
  return messageStatuses.has(status as ClientMessengerMessageStatus)
    ? (status as ClientMessengerMessageStatus)
    : 'Failed'
}

function readRecord(
  record: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> | null {
  for (const key of keys) {
    const value = record[key]
    if (isRecord(value)) {
      return value
    }
  }

  return null
}

function readArray(
  record: Record<string, unknown>,
  keys: readonly string[],
): unknown[] {
  for (const key of keys) {
    const value = record[key]
    if (Array.isArray(value)) {
      return value
    }
  }

  return []
}

function readNullableString(
  record: Record<string, unknown>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const value = record[key]
    if (value === null) {
      return null
    }

    if (typeof value === 'string') {
      return value.trim()
    }
  }

  return null
}
