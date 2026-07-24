import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Anchor, Badge, Group, Paper, SimpleGrid, Stack, Text } from '@mantine/core'
import { IconBrandTelegram, IconCalendarEvent, IconCheck, IconUserHeart } from '@tabler/icons-react'
import { getClientAttentionItems, markMissedTrainingContacted, type ClientAttentionItem, type ClientAttentionReason } from '../../lib/api'
import { resources } from '../../lib/resources'
import { Button, EmptyState, ErrorState, LoadingState, PageSection, RefreshButton, ResponsiveButtonGroup, SectionHeader } from '../shared/ux'

type AttentionPanelProps = { onCountChange?: (count: number | null) => void; onOpenClient?: (clientId: string) => void }

export function AttentionPanel({ onCountChange, onOpenClient }: AttentionPanelProps) {
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
    setLoading(true); setError(null)
    if (!loaded.current) onCountChange?.(null)
    void getClientAttentionItems(controller.signal).then((items) => {
      if (controller.signal.aborted) return
      loaded.current = true; setClients(items); onCountChange?.(items.length); setLastSuccessfulCheck(new Date())
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : resources.home.attention.loadingErrorMessage)
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [onCountChange, reloadKey])

  useEffect(() => {
    if (loaded.current) onCountChange?.(clients.length)
  }, [clients, onCountChange])

  async function contacted(client: ClientAttentionItem) {
    setPendingClientId(client.clientId)
    setActionErrors((current) => ({ ...current, [client.clientId]: '' }))
    try {
      const updated = await markMissedTrainingContacted(client.clientId)
      setClients((current) => {
        return updated ? current.map((item) => item.clientId === client.clientId ? updated : item) : current.filter((item) => item.clientId !== client.clientId)
      })
      if (!updated) queueMicrotask(() => headingRef.current?.focus())
    } catch (reason) {
      setActionErrors((current) => ({ ...current, [client.clientId]: reason instanceof Error ? reason.message : resources.home.attention.actionError }))
    } finally { setPendingClientId(null) }
  }

  return <PageSection className="home-memberships-panel">
    <Stack gap="lg">
      <Group justify="space-between" wrap="wrap">
        <SectionHeader description={resources.home.attention.description} title={resources.home.attention.title} />
        <RefreshButton loading={loading} onClick={() => setReloadKey((value) => value + 1)} />
      </Group>
      <Text component="h2" ref={headingRef} style={{ height: 0, margin: 0, overflow: 'hidden' }} tabIndex={-1}>Список клиентов</Text>
      {lastSuccessfulCheck ? <Text c="dimmed" data-testid="memberships-last-check" size="sm">Проверено: {lastSuccessfulCheck.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</Text> : null}
      {loading && !loaded.current ? <LoadingState label="Загружаем клиентов..." /> : null}
      {!loading && error && !loaded.current ? <ErrorState action={<RefreshButton label="Повторить" onClick={() => setReloadKey((v) => v + 1)} />} message={error} title={resources.home.attention.loadingErrorTitle} /> : null}
      {error && loaded.current ? <Text aria-live="polite" c="red" size="sm">{error}</Text> : null}
      {loaded.current && clients.length === 0 ? <EmptyState description={resources.home.attention.emptyDescription} icon={<IconCalendarEvent size={28} />} title={resources.home.attention.emptyTitle} /> : null}
      {loaded.current && clients.length > 0 ? <Stack aria-label="Клиенты, требующие внимания" data-testid="home-attention-list" gap="sm" role="list">
        {clients.map((client) => <Paper className="home-client-row-card" data-testid={`home-client-card-${client.clientId}`} key={client.clientId} radius="lg" role="listitem" withBorder>
          <Stack gap="md">
            <Text fw={700} size="lg">{client.fullName}</Text>
            <Stack aria-label="Причины" gap="xs" role="list">{client.reasons.map((reason, index) => <ReasonRow client={client} error={actionErrors[client.clientId]} key={`${reason.type}-${index}`} onContacted={() => void contacted(client)} pending={pendingClientId === client.clientId} reason={reason} />)}</Stack>
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <HomeField label="Абонемент" value={client.membership ? `${client.membership.membershipName || resources.common.membership.typeLabels[client.membership.behaviorKind]} · ${client.membership.isPaid ? 'оплачен' : 'не оплачен'}` : 'Нет данных'} />
              <HomeField label="Контакты" value={<Stack gap={2}>{client.phone ? <Anchor href={`tel:${client.phone}`}>{client.phone}</Anchor> : <Text size="sm">Телефон не указан</Text>}{client.telegramLink ? <Anchor aria-label="Открыть Telegram в новой вкладке" href={client.telegramLink} rel="noopener noreferrer" target="_blank"><IconBrandTelegram size={16} /> Telegram</Anchor> : null}</Stack>} />
              <HomeField label="Заметки" value={client.notes || 'Нет заметок'} />
            </SimpleGrid>
            {onOpenClient ? <ResponsiveButtonGroup justify="flex-end"><Button leftSection={<IconUserHeart size={18} />} onClick={() => onOpenClient(client.clientId)} variant="light">Карточка клиента</Button></ResponsiveButtonGroup> : null}
          </Stack>
        </Paper>)}
      </Stack> : null}
    </Stack>
  </PageSection>
}

function ReasonRow({ client, error, onContacted, pending, reason }: { client: ClientAttentionItem; error?: string; onContacted: () => void; pending: boolean; reason: ClientAttentionReason }) {
  if (reason.type === 'missedTraining') return <Paper bg="var(--mantine-color-orange-light)" p="sm" role="listitem" withBorder><Group align="center" justify="space-between" wrap="wrap"><Stack gap={4}><Badge color="orange">Пропущено подряд: {reason.missedCount}</Badge><Text size="sm">Пора связаться с клиентом</Text></Stack><Button aria-label={pending ? `Сохраняем связь с ${client.fullName}` : `Связались с ${client.fullName}`} leftSection={<IconCheck size={18} />} loading={pending} onClick={onContacted}>{pending ? 'Сохраняем…' : 'Связались'}</Button></Group>{error ? <Text aria-live="polite" c="red" mt="xs" size="sm">{error}. Нажмите «Связались», чтобы повторить.</Text> : null}</Paper>
  if (reason.type === 'unpaidMembership') return <Group role="listitem"><Badge color="yellow" variant="light">Требует оплаты</Badge><Text size="sm">Ожидается оплата</Text></Group>
  const expired = reason.type === 'expiredMembership'
  const days = reason.daysUntilExpiration === null ? null : Math.abs(reason.daysUntilExpiration)
  const detail = days === null ? (expired ? 'Дата окончания прошла' : 'Срок окончания приближается') : expired ? `Истек ${days} ${dayWord(days)} назад` : `Осталось ${days} ${dayWord(days)}`
  return <Group role="listitem"><Badge color={expired ? 'red' : 'orange'} variant="light">{expired ? 'Истек' : 'Скоро истечет'}</Badge><Text size="sm">{detail}</Text></Group>
}

function dayWord(value: number) { const n = value % 100; const d = n % 10; if (n >= 11 && n <= 19) return 'дней'; if (d === 1) return 'день'; if (d >= 2 && d <= 4) return 'дня'; return 'дней' }
function HomeField({ label, value }: { label: string; value: ReactNode }) { return <div className="home-client-row__field"><Text c="dimmed" fw={700} size="xs" tt="uppercase">{label}</Text>{typeof value === 'string' ? <Text fw={600} size="sm" style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{value}</Text> : value}</div> }
