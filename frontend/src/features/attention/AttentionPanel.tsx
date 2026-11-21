import { useEffect, useRef, useState } from 'react'
import { useMediaQuery } from '@mantine/hooks'
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
  type ClientAttentionMembershipReason,
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
import { fe9AttentionText } from '../../resources/fe-9-attention'


type AttentionPanelProps = { focusOnReturn?: boolean; onOpenClient?: (clientId: string) => void }

export function AttentionPanel({ onOpenClient, focusOnReturn }: AttentionPanelProps) {
  const mobile = useMediaQuery('(max-width: 47.99em)')
  const [clients, setClients] = useState<ClientAttentionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [pendingClientIds, setPendingClientIds] = useState<string[]>([])
  const activeRead = useRef<AbortController | null>(null)
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({})
  const [lastSuccessfulCheck, setLastSuccessfulCheck] = useState<Date | null>(null)
  const loaded = useRef(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    activeRead.current = controller
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
      if (!controller.signal.aborted) {
        activeRead.current = null
        setLoading(false)
      }
    })
    return () => controller.abort()
  }, [reloadKey])

  useEffect(() => {
    if (focusOnReturn && !loading) headingRef.current?.focus()
  }, [focusOnReturn, loading])

  async function contacted(client: ClientAttentionItem) {
    setPendingClientIds((current) => [...current, client.clientId])
    setActionErrors((current) => ({ ...current, [client.clientId]: '' }))
    try {
      const updated = await markMissedTrainingContacted(client.clientId)
      if (updated || activeRead.current) {
        activeRead.current?.abort()
        setReloadKey((value) => value + 1)
      }
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
      setPendingClientIds((current) => current.filter((id) => id !== client.clientId))
    }
  }

  const expiredCount = clients.reduce((count, client) =>
    count + client.reasons.filter((reason) => reason.type === 'expiredMembership').length, 0)

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
          {fe9AttentionText.attentionPanel_jsxText_b4533fb8}</Text>
        <div className="attention-list-status" role="status">
          <Text aria-label={fe9AttentionText.attentionPanel_template_15a88e60(clients.length)} component="span">
            {fe9AttentionText.attentionPanel_jsxText_f8ba76ae}{clients.length}
          </Text>
          <Text aria-label={fe9AttentionText.attentionPanel_template_427c7cbf(expiredCount)} component="span">
            {fe9AttentionText.attentionPanel_jsxText_b625bade}{expiredCount}
          </Text>
          {lastSuccessfulCheck ? (
            <Text c="var(--crm-text-secondary)" component="span" data-testid="memberships-last-check">
              {fe9AttentionText.attentionPanel_jsxText_6fad7653}{lastSuccessfulCheck.toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          ) : null}
        </div>
        {loading && !loaded.current ? <LoadingState label={fe9AttentionText.attentionPanel_label_34e77243} /> : null}
        {!loading && error && !loaded.current ? (
          <ErrorState
            action={<RefreshButton label={fe9AttentionText.attentionPanel_label_5189135a} onClick={() => setReloadKey((v) => v + 1)} />}
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
            gap={mobile ? 6 : 'xs'}
            role="list"
          >
            {clients.map((client) => (
              <AttentionClientRow
                actionError={actionErrors[client.clientId]}
                client={client}
                mobile={mobile}
                key={client.clientId}
                onContacted={() => void contacted(client)}
                onOpenClient={onOpenClient}
                pending={pendingClientIds.includes(client.clientId)}
              />
            ))}
          </Stack>
        ) : null}
      </Stack>
    </PageSection>
  )
}

type AttentionClientRowProps = {
  mobile: boolean
  actionError?: string
  client: ClientAttentionItem
  onContacted: () => void
  onOpenClient?: (clientId: string) => void
  pending: boolean
}

function AttentionClientRow({
  actionError,
  client,
  mobile,
  onContacted,
  onOpenClient,
  pending,
}: AttentionClientRowProps) {
  const hasMissedTraining = client.reasons.some((reason) => reason.type === 'missedTraining')
  const memberships = client.reasons.filter((reason) => reason.type !== 'missedTraining')
  const multipleSales = memberships.length > 1
  const membership = memberships[0]
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
      data-mobile={mobile || undefined}
      data-testid={`attention-client-card-${client.clientId}`}
      role="listitem"
      tabIndex={0}
      withBorder
    >
      <div className="attention-client-row__content">
        <Text className="attention-client-row__name" fw={800} title={client.fullName}>
          {client.fullName}
        </Text>
        <div
          aria-label={fe9AttentionText.attentionPanel_ariaLabel_93096e67}
          className="attention-client-row__reasons"
          data-multiple-sales={multipleSales || undefined}
        >
          {client.reasons.length > 0
            ? client.reasons.map((reason) => (
                <ReasonSummary
                  key={reason.type === 'missedTraining' ? reason.type : `${reason.membershipId}:${reason.saleId}`}
                  reason={reason}
                  mobile={mobile}
                  showSale={multipleSales}
                />
              ))
            : <Text component="span">{fe9AttentionText.attentionPanel_jsxText_bffdeff3}</Text>}
        </div>
        {mobile ? (
          <div className="attention-client-row__details">
            {[
              multipleSales ? null : membershipLabel(membership),
              multipleSales ? null : targetLabel(membership, true),
              client.notes || fe9AttentionText.attentionPanel_string_20df618a,
              client.phone ? null : fe9AttentionText.noPhone,
            ].filter(Boolean).join(' · ')}
          </div>
        ) : (
          <div className="attention-client-row__metadata">
            {!multipleSales ? (
              <>
                <Text component="span" title={membershipLabel(membership)}>{membershipLabel(membership)}</Text>
                <Text component="span" title={targetLabel(membership, false)}>{targetLabel(membership, false)}</Text>
              </>
            ) : null}
            <Text component="span" title={client.phone ?? fe9AttentionText.attentionPanel_string_1fc40e1a}>
              {client.phone ?? fe9AttentionText.attentionPanel_string_1fc40e1a}
            </Text>
            <Text component="span" title={client.notes || fe9AttentionText.attentionPanel_string_20df618a}>
              {client.notes || fe9AttentionText.attentionPanel_string_20df618a}
            </Text>
          </div>
        )}
      </div>
      <div className="attention-client-row__actions">
        {mobile && primaryKind === 'contacted' && client.phone ? (
          <a
            aria-label={fe9AttentionText.callNumber(client.fullName, client.phone)}
            className="attention-client-row__call"
            href={`tel:${client.phone}`}
          >
            <IconPhone aria-hidden size={16} />
            {client.phone}
          </a>
        ) : null}
        {primaryKind === 'contacted' ? (
          <Button
            aria-label={pending
              ? fe9AttentionText.attentionPanel_template_a35598f8(client.fullName)
              : fe9AttentionText.attentionPanel_template_0ad31512(client.fullName)}
            className="attention-client-row__primary"
            leftSection={mobile ? undefined : <IconCheck size={18} />}
            loading={pending}
            onClick={onContacted}
          >
            {pending ? fe9AttentionText.attentionPanel_string_9c27c381 : fe9AttentionText.attentionPanel_string_82dd6ade}
          </Button>
        ) : null}
        {primaryKind === 'phone' ? (
          <MantineButton
            aria-label={mobile && client.phone
              ? fe9AttentionText.callNumber(client.fullName, client.phone)
              : fe9AttentionText.attentionPanel_template_e50e96fc(client.fullName)}
            className="attention-client-row__primary"
            color="var(--crm-action-primary)"
            component="a"
            data-crm-recipe="button"
            data-crm-variant="primary"
            href={`tel:${client.phone}`}
            leftSection={<IconPhone size={18} />}
            radius="xl"
          >
            {mobile ? client.phone : fe9AttentionText.attentionPanel_jsxText_0701381c}
          </MantineButton>
        ) : null}
        {primaryKind === 'telegram' ? (
          <MantineButton
            aria-label={fe9AttentionText.attentionPanel_template_50ce20af(client.fullName)}
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
            aria-label={fe9AttentionText.attentionPanel_template_a98de9df(client.fullName)}
            className="attention-client-row__primary"
            leftSection={<IconUserHeart size={18} />}
            onClick={() => onOpenClient(client.clientId)}
          >
            {fe9AttentionText.attentionPanel_jsxText_18c7acca}</Button>
        ) : null}
        <AttentionActionsMenu
          client={client}
          onOpenClient={onOpenClient}
          primaryKind={primaryKind}
          showPhone={!mobile && primaryKind !== 'phone'}
        />
      </div>
      {actionError ? (
        <Text aria-live="polite" className="attention-client-row__error" c="red">
          {actionError}{fe9AttentionText.attentionPanel_jsxText_3a45c61a}</Text>
      ) : null}
    </Paper>
  )
}

type AttentionPrimaryKind = 'contacted' | 'phone' | 'profile' | 'telegram' | null

function AttentionActionsMenu({
  client,
  onOpenClient,
  primaryKind,
  showPhone,
}: {
  client: ClientAttentionItem
  onOpenClient?: (clientId: string) => void
  primaryKind: AttentionPrimaryKind
  showPhone: boolean
}) {
  const hasPhoneAction = Boolean(client.phone && showPhone)
  const hasTelegramAction = Boolean(client.telegramLink && primaryKind !== 'telegram')
  const hasProfileAction = Boolean(onOpenClient && primaryKind !== 'profile')

  if (!hasPhoneAction && !hasTelegramAction && !hasProfileAction) return null

  return (
    <Menu position="bottom-end" shadow="md" withinPortal>
      <Menu.Target>
        <IconButton
          icon={<IconDotsVertical size={20} />}
          className="attention-client-row__more"
          onClick={event => event.currentTarget.focus({ preventScroll: true })}
          label={fe9AttentionText.attentionPanel_template_c6ca6019(client.fullName)}
          variant="secondary"
        />
      </Menu.Target>
      <Menu.Dropdown>
        {hasPhoneAction ? (
          <Menu.Item
            aria-label={fe9AttentionText.attentionPanel_template_e50e96fc(client.fullName)}
            className="attention-actions-menu__item"
            component="a"
            href={`tel:${client.phone}`}
            leftSection={<IconPhone size={18} />}
          >
            {fe9AttentionText.attentionPanel_jsxText_0701381c}</Menu.Item>
        ) : null}
        {hasTelegramAction ? (
          <Menu.Item
            aria-label={fe9AttentionText.attentionPanel_template_50ce20af(client.fullName)}
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
            aria-label={fe9AttentionText.attentionPanel_template_a98de9df(client.fullName)}
            className="attention-actions-menu__item"
            leftSection={<IconUserHeart size={18} />}
            onClick={() => onOpenClient(client.clientId)}
          >
            {fe9AttentionText.attentionPanel_jsxText_a912ec86}</Menu.Item>
        ) : null}
      </Menu.Dropdown>
    </Menu>
  )
}

function membershipLabel(membership?: ClientAttentionMembershipReason) {
  return membership
    ? membership.membershipName || resources.common.membership.typeLabels[membership.behaviorKind]
    : fe9AttentionText.attentionPanel_string_76848548
}

function targetLabel(membership: ClientAttentionMembershipReason | undefined, mobile: boolean) {
  if (mobile && membership?.targetGroups.length === 1) {
    const group = membership.targetGroups[0]
    return [group.groupName || group.groupId, group.branchName].filter(Boolean).join(' · ')
  }
  return membership?.targetSummary ?? fe9AttentionText.attentionPanel_string_5047bc55
}

function mobileReasonLabel(reason: ClientAttentionReason) {
  if (reason.type === 'missedTraining') return fe9AttentionText.missedInARow(reason.missedCount)
  const expired = reason.type === 'expiredMembership'
  if (reason.daysUntilExpiration === null) {
    return expired ? fe9AttentionText.expired : fe9AttentionText.expiring
  }
  const days = Math.abs(reason.daysUntilExpiration)
  if (days === 0) return expired ? fe9AttentionText.expiredToday : fe9AttentionText.expiresToday
  return expired
    ? fe9AttentionText.expiredDaysAgo(days, dayWord(days))
    : fe9AttentionText.expiresInDays(days, dayWord(days))
}

function ReasonSummary({ reason, mobile, showSale }: {
  reason: ClientAttentionReason
  mobile: boolean
  showSale: boolean
}) {
  if (mobile) {
    const label = mobileReasonLabel(reason)
    const text = showSale && reason.type !== 'missedTraining'
      ? [label, membershipLabel(reason), targetLabel(reason, true)].join(' · ')
      : label
    return <span>{text}</span>
  }

  if (reason.type === 'missedTraining') {
    const label = fe9AttentionText.attentionPanel_label_4cd3b5b4(reason.missedCount)
    return <Badge title={label} variant="light">{label}</Badge>
  }

  const expired = reason.type === 'expiredMembership'
  const days = reason.daysUntilExpiration === null ? null : Math.abs(reason.daysUntilExpiration)
  const detail = days === null
    ? expired
      ? fe9AttentionText.attentionPanel_string_bb034c97
      : fe9AttentionText.attentionPanel_string_e77d1c5f
    : days === 0
      ? expired
        ? fe9AttentionText.attentionPanel_string_8173243b
        : fe9AttentionText.attentionPanel_string_043dabe8
      : expired
        ? fe9AttentionText.attentionPanel_template_1182acc1(days, dayWord(days))
        : fe9AttentionText.attentionPanel_template_ccba39cd(days, dayWord(days))

  return (
    <span
      aria-label={showSale ? undefined : fe9AttentionText.attentionPanel_template_f3d8e459(expired ? fe9AttentionText.attentionPanel_string_53217635 : fe9AttentionText.attentionPanel_string_92e9102e, detail)}
      className="attention-client-row__reason"
      title={detail}
    >
      <Badge variant="light">{expired ? fe9AttentionText.attentionPanel_string_53217635 : fe9AttentionText.attentionPanel_string_92e9102e}</Badge>
      <Text component="span">{detail}</Text>
      {showSale ? (
        <>
          <Text component="span">{membershipLabel(reason)}</Text>
          <Text component="span">{targetLabel(reason, false)}</Text>
        </>
      ) : null}
    </span>
  )
}

function dayWord(value: number) {
  const n = value % 100
  const d = n % 10
  if (n >= 11 && n <= 19) return fe9AttentionText.attentionPanel_string_c27d559b
  if (d === 1) return fe9AttentionText.attentionPanel_string_8eae90e5
  if (d >= 2 && d <= 4) return fe9AttentionText.attentionPanel_string_748dc44e
  return fe9AttentionText.attentionPanel_string_c27d559b
}
