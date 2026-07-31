import { useEffect, useState } from 'react'
import { Alert, Group, Modal, NumberInput, Paper, Select, SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconAlertCircle, IconEdit, IconPlus } from '@tabler/icons-react'
import {
  ApiError,
  applyFieldErrors,
  createMembershipCatalogItem,
  getBranches,
  getMembershipCatalogItems,
  updateMembershipCatalogItem,
  type Branch,
  type MembershipBehaviorKind,
  type MembershipCatalogItem,
} from '../../lib/api'
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  PageSection,
  ResponsiveButtonGroup,
  TaskToolbarAction,
  TaskToolbarActions,
  TaskToolbarRefreshAction,
} from '../shared/ux'

type Props = { assignedBranchId?: string | null; canSelectBranch?: boolean }
type FormValues = { name: string; price: number | string; behaviorKind: Exclude<MembershipBehaviorKind, 'Professional'>; availableFrom: string; availableTo: string }
type ModalState = { mode: 'create' } | { mode: 'edit'; item: MembershipCatalogItem } | null

const behaviorOptions = [
  { value: 'SingleVisit', label: 'Разовое посещение' },
  { value: 'Term', label: 'Абонемент на срок' },
]

export function MembershipCatalogSettings({
  assignedBranchId,
  canSelectBranch = false,
}: Props) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchId, setBranchId] = useState(assignedBranchId ?? '')
  const [items, setItems] = useState<MembershipCatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [modal, setModal] = useState<ModalState>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<FormValues>({
    initialValues: { name: '', price: 0, behaviorKind: 'Term', availableFrom: new Date().toISOString().slice(0, 10), availableTo: '' },
    validate: {
      name: (value) => value.trim() ? null : 'Введите название.',
      price: (value) => Number(value) > 0 ? null : 'Цена должна быть больше нуля.',
      availableFrom: (value) => value ? null : 'Укажите дату начала.',
    },
  })

  useEffect(() => {
    const controller = new AbortController()
    void getBranches({}, controller.signal).then((next) => {
      const active = next.filter((branch) => !branch.isArchived)
      setBranches(active)
      setBranchId((current) => current || active[0]?.id || '')
    }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Не удалось загрузить филиалы.'))
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!branchId) return
    const controller = new AbortController()
    setLoading(true); setError(null)
    void getMembershipCatalogItems(branchId, controller.signal)
      .then(setItems)
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Не удалось загрузить каталог.'))
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [branchId, reloadKey])

  function openCreate() {
    form.setValues({ name: '', price: 0, behaviorKind: 'Term', availableFrom: new Date().toISOString().slice(0, 10), availableTo: '' })
    form.clearErrors(); setFormError(null); setModal({ mode: 'create' })
  }
  function openEdit(item: MembershipCatalogItem) {
    form.setValues({ name: item.name, price: item.price, behaviorKind: item.behaviorKind === 'SingleVisit' ? 'SingleVisit' : 'Term', availableFrom: item.availableFrom, availableTo: item.availableTo ?? '' })
    form.clearErrors(); setFormError(null); setModal({ mode: 'edit', item })
  }
  async function submit(values: FormValues) {
    if (!modal || !branchId) return
    setSubmitting(true); setFormError(null); form.clearErrors()
    try {
      const dates = { name: values.name.trim(), availableFrom: values.availableFrom, availableTo: values.availableTo || null }
      const saved = modal.mode === 'create'
        ? await createMembershipCatalogItem({ ...dates, branchId, price: Number(values.price), behaviorKind: values.behaviorKind })
        : await updateMembershipCatalogItem(modal.item.id, dates)
      setItems((current) => [...current.filter((item) => item.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name, 'ru')))
      setModal(null)
    } catch (reason) {
      const candidate = reason as { fieldErrors?: Record<string, string[]>; message?: string }
      if (reason instanceof ApiError || candidate.fieldErrors) form.setErrors(applyFieldErrors(candidate.fieldErrors ?? {}))
      setFormError(candidate.message ?? 'Не удалось сохранить абонемент.')
    } finally { setSubmitting(false) }
  }

  const branch = branches.find((item) => item.id === branchId)
  return <Stack gap="lg">
    <PageSection><Stack gap="lg">
      <TaskToolbarActions
        frequentActions={<TaskToolbarRefreshAction loading={loading} onClick={() => setReloadKey((key) => key + 1)} />}
        primaryAction={(
          <TaskToolbarAction
            disabled={!branchId}
            icon={<IconPlus size={18} />}
            label="Добавить абонемент"
            onClick={openCreate}
            priority="primary"
          />
        )}
      />
      {canSelectBranch ? <Select allowDeselect={false} data={branches.map((item) => ({ value: item.id, label: item.name }))} label="Филиал каталога" onChange={(value) => setBranchId(value ?? '')} value={branchId || null}/> : <Paper className="hint-card" p="md" withBorder><Text c="dimmed" size="sm">Филиал каталога</Text><Text fw={700}>{branch?.name ?? 'Не назначен'}</Text></Paper>}
      {loading ? <LoadingState label="Загружаем каталог..."/> : null}
      {!loading && error ? <ErrorState title="Каталог не загрузился" message={error}/> : null}
      {!loading && !error && items.length === 0 ? <EmptyState icon={<IconPlus size={24}/>} title="В этом филиале ещё нет абонементов"/> : null}
      {!loading && !error ? <Stack>{items.map((item) => <Paper className="list-row-card" key={item.id} p="lg" withBorder><Group justify="space-between"><Stack gap={6}><Text fw={700}>{item.name}</Text><Text c="dimmed" size="sm">{formatPrice(item.price)} • {item.availableFrom} — {item.availableTo ?? 'бессрочно'}</Text></Stack><Button aria-label={`Редактировать ${item.name}`} leftSection={<IconEdit size={16}/>} onClick={() => openEdit(item)} variant="light">Изменить</Button></Group></Paper>)}</Stack> : null}
    </Stack></PageSection>
    <Modal centered opened={Boolean(modal)} onClose={() => setModal(null)} title={modal?.mode === 'edit' ? 'Редактирование абонемента' : 'Новый абонемент'}><form onSubmit={form.onSubmit((values) => void submit(values))}><Stack>
      {formError ? <Alert color="red" icon={<IconAlertCircle size={18}/>}>{formError}</Alert> : null}
      <TextInput label="Название" {...form.getInputProps('name')}/>
      {modal?.mode === 'create' ? <SimpleGrid cols={2}><NumberInput label="Цена" min={0} {...form.getInputProps('price')}/><Select allowDeselect={false} data={behaviorOptions} label="Поведение" {...form.getInputProps('behaviorKind')}/></SimpleGrid> : null}
      <SimpleGrid cols={2}><TextInput type="date" label="Доступен с" {...form.getInputProps('availableFrom')}/><TextInput type="date" label="Доступен по" {...form.getInputProps('availableTo')}/></SimpleGrid>
      <ResponsiveButtonGroup justify="flex-end"><Button variant="secondary" onClick={() => setModal(null)}>Отменить</Button><Button type="submit" loading={submitting}>Сохранить</Button></ResponsiveButtonGroup>
    </Stack></form></Modal>
  </Stack>
}

function formatPrice(value: number) { return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 }).format(value) }
