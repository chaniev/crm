import { useEffect, useRef, useState } from 'react'
import { Badge, Button as MantineButton, Menu, Paper, Stack, Text } from '@mantine/core'
import {
  IconBrandTelegram,
  IconCalendarEvent,
  IconCheck,
  IconDotsVertical,
  IconPhone,
  IconUserHeart,
} from '@tabler/icons-react'
import {
  getClientAttentionItems,
  markMissedTrainingContacted,
  type ClientAttentionItem,
  type ClientAttentionReason,
} from '../../lib/api'
import { resources } from '../../lib/resources'
import {
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  PageSection,
  RefreshButton,
  TaskToolbarActions,
  TaskToolbarRefreshAction,
} from '../shared/ux'

type AttentionPanelProps = { onOpenClient?: (clientId: string) => void }

export function AttentionPanel({ onOpenClient }: AttentionPanelProps) {
  const [clients, setClients] = useState<ClientAttentionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [pendingClientId, setPendingClientId] = useState<string | null>(null)
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({})
  const [lastSuccessfulCheck, setLastSuccessfulCheck] = useState<Date | null>(null)
  const loaded = useRef(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    void getClientAttentionItems(controller.signal).then((items) => {
      if (controller.signal.aborted) return
      loaded.current = true
      setClients(items)
      setLastSuccessfulCheck(new Date())
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) {
        setError(reason instanceof Error ? reason.message : resources.attention.loadingErrorMessage)
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [reloadKey])

  async function contacted(client: ClientAttentionItem) {
    setPendingClientId(client.clientId)
    setActionErrors((current) => ({ ...current, [client.clientId]: '' }))
    try {
      const updated = await markMissedTrainingContacted(client.clientId)
      setClients((current) => updated
        ? current.map((item) => item.clientId === client.clientId ? updated : item)
        : current.filter((item) => item.clientId !== client.clientId))
      if (!updated) queueMicrotask(() => headingRef.current?.focus())
    } catch (reason) {
      setActionErrors((current) => ({
        ...current,
        [client.clientId]: reason instanceof Error
          ? reason.message
          : resources.attention.actionError,
      }))
    } finally {
      setPendingClientId(null)
    }
  }

  const expiredCount = clients.filter((client) =>
    client.reasons.some((reason) => reason.type === 'expiredMembership')).length

  return (
    <PageSection className="attention-panel" variant="plain">
      <Stack className="attention-panel__content" gap="xs">
        <div className="attention-controls-row">
          <TaskToolbarActions
            frequentActions={(
              <TaskToolbarRefreshAction
                loading={loading}
                onClick={() => setReloadKey((value) => value + 1)}
              />
            )}
          />
        </div>
        <Text
          className="visually-hidden"
          component="h2"
          id="attention-list-title"
          ref={headingRef}
          tabIndex={-1}
        >
          Список клиентов
        </Text>
        <div className="attention-list-status" role="status">
          <Text aria-label={`Всего клиентов: ${clients.length}`} component="span">
            Всего: {clients.length}
          </Text>
          <Text aria-label={`Просроченных абонементов: ${expiredCount}`} component="span">
            Просрочен: {expiredCount}
          </Text>
          {lastSuccessfulCheck ? (
            <Text c="dimmed" component="span" data-testid="memberships-last-check">
              Проверено: {lastSuccessfulCheck.toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          ) : null}
        </div>
        {loading && !loaded.current ? <LoadingState label="Загружаем клиентов..." /> : null}
        {!loading && error && !loaded.current ? (
          <ErrorState
            action={<RefreshButton label="Повторить" onClick={() => setReloadKey((v) => v + 1)} />}
            message={error}
            title={resources.attention.loadingErrorTitle}
          />
        ) : null}
        {error && loaded.current ? (
          <Text aria-live="polite" c="red" size="sm">{error}</Text>
        ) : null}
        {loaded.current && clients.length === 0 ? (
          <EmptyState
            description={resources.attention.emptyDescription}
            icon={<IconCalendarEvent size={28} />}
            title={resources.attention.emptyTitle}
          />
        ) : null}
        {loaded.current && clients.length > 0 ? (
          <Stack
            aria-labelledby="attention-list-title"
            className="attention-list"
            data-testid="attention-list"
            gap="xs"
            role="list"
          >
            {clients.map((client) => (
              <AttentionClientRow
                actionError={actionErrors[client.clientId]}
                client={client}
                key={attentionItemKey(client)}
                onContacted={() => void contacted(client)}
                onOpenClient={onOpenClient}
                pending={pendingClientId === client.clientId}
              />
            ))}
          </Stack>
        ) : null}
      </Stack>
    </PageSection>
  )
}

type AttentionClientRowProps = {
  actionError?: string
  client: ClientAttentionItem
  onContacted: () => void
  onOpenClient?: (clientId: string) => void
  pending: boolean
}

function AttentionClientRow({
  actionError,
  client,
  onContacted,
  onOpenClient,
  pending,
}: AttentionClientRowProps) {
  const hasMissedTraining = client.reasons.some((reason) => reason.type === 'missedTraining')
  const primaryKind: AttentionPrimaryKind = hasMissedTraining
    ? 'contacted'
    : client.phone
      ? 'phone'
      : client.telegramLink
        ? 'telegram'
        : onOpenClient
          ? 'profile'
          : null

  return (
    <Paper
      className="attention-client-row-card crm-list-row-surface"
      data-testid={`attention-client-card-${attentionItemKey(client)}`}
      role="listitem"
      tabIndex={0}
      withBorder
    >
      <div className="attention-client-row__content">
        <Text className="attention-client-row__name" fw={800} title={client.fullName}>
          {client.fullName}
        </Text>
        <div aria-label="Причины" className="attention-client-row__reasons">
          {client.reasons.length > 0
            ? client.reasons.map((reason, index) => (
                <ReasonSummary key={`${reason.type}-${index}`} reason={reason} />
              ))
            : <Text component="span">Причина не указана</Text>}
        </div>
        <div className="attention-client-row__metadata">
          <Text component="span" title={formatAttentionMembershipLabel(client)}>
            {formatAttentionMembershipLabel(client)}
          </Text>
          <Text component="span" title={client.membership?.targetSummary ?? 'Группы не указаны'}>
            {client.membership?.targetSummary ?? 'Группы не указаны'}
          </Text>
          <Text component="span" title={client.phone ?? 'Телефон не указан'}>
            {client.phone ?? 'Телефон не указан'}
          </Text>
          <Text component="span" title={client.notes || 'Нет заметок'}>
            {client.notes || 'Нет заметок'}
          </Text>
        </div>
      </div>
      <div className="attention-client-row__actions">
        {primaryKind === 'contacted' ? (
          <Button
            aria-label={pending
              ? `Сохраняем связь с ${client.fullName}`
              : `Связались с ${client.fullName}`}
            className="attention-client-row__primary"
            leftSection={<IconCheck size={18} />}
            loading={pending}
            onClick={onContacted}
          >
            {pending ? 'Сохраняем…' : 'Связались'}
          </Button>
        ) : null}
        {primaryKind === 'phone' ? (
          <MantineButton
            aria-label={`Позвонить ${client.fullName}`}
            className="attention-client-row__primary"
            color="var(--crm-action-primary)"
            component="a"
            data-crm-recipe="button"
            data-crm-variant="primary"
            href={`tel:${client.phone}`}
            leftSection={<IconPhone size={18} />}
            radius="xl"
          >
            Позвонить
          </MantineButton>
        ) : null}
        {primaryKind === 'telegram' ? (
          <MantineButton
            aria-label={`Открыть Telegram ${client.fullName}`}
            className="attention-client-row__primary"
            color="var(--crm-action-primary)"
            component="a"
            data-crm-recipe="button"
            data-crm-variant="primary"
            href={client.telegramLink ?? undefined}
            leftSection={<IconBrandTelegram size={18} />}
            radius="xl"
            rel="noopener noreferrer"
            target="_blank"
          >
            Telegram
          </MantineButton>
        ) : null}
        {primaryKind === 'profile' && onOpenClient ? (
          <Button
            aria-label={`Открыть карточку ${client.fullName}`}
            className="attention-client-row__primary"
            leftSection={<IconUserHeart size={18} />}
            onClick={() => onOpenClient(client.clientId)}
          >
            Карточка
          </Button>
        ) : null}
        <AttentionActionsMenu
          client={client}
          onOpenClient={onOpenClient}
          primaryKind={primaryKind}
        />
      </div>
      {actionError ? (
        <Text aria-live="polite" className="attention-client-row__error" c="red">
          {actionError}. Нажмите «Связались», чтобы повторить.
        </Text>
      ) : null}
    </Paper>
  )
}

type AttentionPrimaryKind = 'contacted' | 'phone' | 'profile' | 'telegram' | null

function AttentionActionsMenu({
  client,
  onOpenClient,
  primaryKind,
}: {
  client: ClientAttentionItem
  onOpenClient?: (clientId: string) => void
  primaryKind: AttentionPrimaryKind
}) {
  const hasPhoneAction = Boolean(client.phone && primaryKind !== 'phone')
  const hasTelegramAction = Boolean(client.telegramLink && primaryKind !== 'telegram')
  const hasProfileAction = Boolean(onOpenClient && primaryKind !== 'profile')
  const triggerKey = attentionItemKey(client)

  if (!hasPhoneAction && !hasTelegramAction && !hasProfileAction) return null

  return (
    <Menu
      onClose={() => window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const trigger = Array.from(
            document.querySelectorAll<HTMLButtonElement>('[data-attention-menu-trigger]'),
          ).find((element) => element.dataset.attentionMenuTrigger === triggerKey)
          trigger?.focus({ preventScroll: true })
        })
      })}
      position="bottom-end"
      shadow="md"
      withinPortal
    >
      <Menu.Target>
        <IconButton
          icon={<IconDotsVertical size={20} />}
          data-attention-menu-trigger={triggerKey}
          label={`Другие действия для ${client.fullName}`}
          variant="secondary"
        />
      </Menu.Target>
      <Menu.Dropdown>
        {hasPhoneAction ? (
          <Menu.Item
            aria-label={`Позвонить ${client.fullName}`}
            className="attention-actions-menu__item"
            component="a"
            href={`tel:${client.phone}`}
            leftSection={<IconPhone size={18} />}
          >
            Позвонить
          </Menu.Item>
        ) : null}
        {hasTelegramAction ? (
          <Menu.Item
            aria-label={`Открыть Telegram ${client.fullName}`}
            className="attention-actions-menu__item"
            component="a"
            href={client.telegramLink ?? undefined}
            leftSection={<IconBrandTelegram size={18} />}
            rel="noopener noreferrer"
            target="_blank"
          >
            Telegram
          </Menu.Item>
        ) : null}
        {hasProfileAction && onOpenClient ? (
          <Menu.Item
            aria-label={`Открыть карточку ${client.fullName}`}
            className="attention-actions-menu__item"
            leftSection={<IconUserHeart size={18} />}
            onClick={() => onOpenClient(client.clientId)}
          >
            Карточка клиента
          </Menu.Item>
        ) : null}
      </Menu.Dropdown>
    </Menu>
  )
}

function ReasonSummary({ reason }: { reason: ClientAttentionReason }) {
  if (reason.type === 'missedTraining') {
    const label = `Пропущено подряд: ${reason.missedCount}`
    return <Badge title={label} variant="light">{label}</Badge>
  }

  const expired = reason.type === 'expiredMembership'
  const days = reason.daysUntilExpiration === null ? null : Math.abs(reason.daysUntilExpiration)
  const detail = days === null
    ? expired
      ? 'Дата окончания прошла'
      : 'Срок окончания приближается'
    : days === 0
      ? expired
        ? 'Истек сегодня'
        : 'Истекает сегодня'
      : expired
        ? `Истек ${days} ${dayWord(days)} назад`
        : `Осталось ${days} ${dayWord(days)}`

  return (
    <span
      aria-label={`${expired ? 'Истек' : 'Скоро истечет'}: ${detail}`}
      className="attention-client-row__reason"
      title={detail}
    >
      <Badge variant="light">{expired ? 'Истек' : 'Скоро истечет'}</Badge>
      <Text component="span">{detail}</Text>
    </span>
  )
}

function dayWord(value: number) {
  const n = value % 100
  const d = n % 10
  if (n >= 11 && n <= 19) return 'дней'
  if (d === 1) return 'день'
  if (d >= 2 && d <= 4) return 'дня'
  return 'дней'
}

function attentionItemKey(client: ClientAttentionItem) {
  return client.membership
    ? `${client.clientId}:${client.membership.membershipId}:${client.membership.saleId}`
    : client.clientId
}

function formatAttentionMembershipLabel(client: ClientAttentionItem) {
  return client.membership
    ? (client.membership.membershipName
      || resources.common.membership.typeLabels[client.membership.behaviorKind])
    : 'Нет данных'
}
