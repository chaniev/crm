import { useEffect, useRef, useState } from 'react'
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
import { fe12SettingsMembershipText } from '../../resources/fe-12-settings-membership'


type Props = { assignedBranchId?: string | null; canSelectBranch?: boolean }
type FormValues = { name: string; price: number | string; behaviorKind: Exclude<MembershipBehaviorKind, 'Professional'>; availableFrom: string; availableTo: string }
type ModalState = { mode: 'create' } | { mode: 'edit'; item: MembershipCatalogItem } | null

const behaviorOptions = [
  { value: 'SingleVisit', label: fe12SettingsMembershipText.membershipCatalogSettings_label_a4dd0afc },
  { value: 'Term', label: fe12SettingsMembershipText.membershipCatalogSettings_label_274b0f43 },
]

export function MembershipCatalogSettings({
  assignedBranchId,
  canSelectBranch = false,
}: Props) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchId, setBranchId] = useState(assignedBranchId ?? '')
  const [items, setItems] = useState<MembershipCatalogItem[]>([])
  const [branchesLoading, setBranchesLoading] = useState(true)
  const [branchesError, setBranchesError] = useState<string | null>(null)
  const [branchesReloadKey, setBranchesReloadKey] = useState(0)
  const [itemsLoading, setItemsLoading] = useState(Boolean(assignedBranchId))
  const [itemsError, setItemsError] = useState<string | null>(null)
  const [itemsReloadKey, setItemsReloadKey] = useState(0)
  const [modal, setModal] = useState<ModalState>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const itemsRequestId = useRef(0)
  const form = useForm<FormValues>({
    initialValues: { name: '', price: 0, behaviorKind: 'Term', availableFrom: new Date().toISOString().slice(0, 10), availableTo: '' },
    validate: {
      name: (value) => value.trim() ? null : fe12SettingsMembershipText.membershipCatalogSettings_string_61be650d,
      price: (value) => Number(value) > 0 ? null : fe12SettingsMembershipText.membershipCatalogSettings_string_326a3ef9,
      availableFrom: (value) => value ? null : fe12SettingsMembershipText.membershipCatalogSettings_string_b284dfda,
    },
  })

  useEffect(() => {
    const controller = new AbortController()
    setBranchesLoading(true)
    setBranchesError(null)

    void getBranches({}, controller.signal)
      .then((next) => {
        if (controller.signal.aborted) return
        const active = next.filter((branch) => !branch.isArchived)
        setBranches(active)
        setBranchId((current) => {
          if (assignedBranchId) {
            return active.some((branch) => branch.id === assignedBranchId)
              ? assignedBranchId
              : ''
          }

          return active.some((branch) => branch.id === current)
            ? current
            : active[0]?.id ?? ''
        })
      })
      .catch((reason) => {
        if (controller.signal.aborted) return
        setBranches([])
        setBranchId('')
        setBranchesError(reason instanceof Error ? reason.message : fe12SettingsMembershipText.membershipCatalogSettings_string_eb5b2e75)
      })
      .finally(() => {
        if (!controller.signal.aborted) setBranchesLoading(false)
      })

    return () => controller.abort()
  }, [assignedBranchId, branchesReloadKey])

  const branch = branches.find((item) => item.id === branchId)
  const canUseAssignedScopeBeforeInitialBranchLoad =
    !canSelectBranch &&
    Boolean(assignedBranchId) &&
    branchesReloadKey === 0 &&
    branchesLoading &&
    !branchesError
  const itemBranchId =
    canUseAssignedScopeBeforeInitialBranchLoad
      ? assignedBranchId ?? ''
      : !branchesLoading && !branchesError && branchId
        ? branchId
        : ''

  useEffect(() => {
    if (!itemBranchId) {
      itemsRequestId.current += 1
      setItems([])
      setItemsLoading(false)
      setItemsError(null)
      return
    }

    const controller = new AbortController()
    const requestId = itemsRequestId.current + 1
    itemsRequestId.current = requestId
    setItems([])
    setItemsLoading(true)
    setItemsError(null)
    void getMembershipCatalogItems(itemBranchId, controller.signal)
      .then((nextItems) => {
        if (controller.signal.aborted || itemsRequestId.current !== requestId) return
        setItems(nextItems)
      })
      .catch((reason) => {
        if (controller.signal.aborted || itemsRequestId.current !== requestId) return
        setItemsError(reason instanceof Error ? reason.message : fe12SettingsMembershipText.membershipCatalogSettings_string_2998ba4c)
      })
      .finally(() => {
        if (!controller.signal.aborted && itemsRequestId.current === requestId) {
          setItemsLoading(false)
        }
      })
    return () => controller.abort()
  }, [itemBranchId, itemsReloadKey])

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
      setFormError(candidate.message ?? fe12SettingsMembershipText.membershipCatalogSettings_string_018f2727)
    } finally { setSubmitting(false) }
  }

  const scopeResolved = Boolean(branch)
  const scopeStatus = branchesLoading
    ? fe12SettingsMembershipText.membershipCatalogSettings_string_029764c0
    : branchesError
      ? fe12SettingsMembershipText.membershipCatalogSettings_string_9d518c0f
      : scopeResolved
        ? branch?.name ?? fe12SettingsMembershipText.membershipCatalogSettings_string_271a3cca
        : fe12SettingsMembershipText.membershipCatalogSettings_string_271a3cca
  const createDisabledReason = !scopeResolved && canSelectBranch ? scopeStatus : null
  const refreshLoading = branchesLoading || (scopeResolved && itemsLoading)

  function refresh() {
    if (branchesLoading || itemsLoading) return

    if (!scopeResolved || branchesError) {
      setBranchesReloadKey((key) => key + 1)
      return
    }

    setItemsReloadKey((key) => key + 1)
  }

  return <Stack gap="lg">
    <PageSection><Stack gap="lg">
      <div className="settings-catalog-toolbar">
        <div className="settings-catalog-scope">
          {canSelectBranch ? (
            <Select
              allowDeselect={false}
              className="settings-catalog-scope__select"
              data={branches.map((item) => ({ value: item.id, label: item.name }))}
              description={scopeResolved ? branch?.name : undefined}
              descriptionProps={{ className: 'visually-hidden' }}
              disabled={branchesLoading || Boolean(branchesError) || branches.length === 0}
              inputWrapperOrder={['label', 'input', 'description']}
              label={fe12SettingsMembershipText.membershipCatalogSettings_label_6c90f338}
              onChange={(value) => setBranchId(value ?? '')}
              placeholder={scopeStatus}
              value={branchId || null}
            />
          ) : (
            <Paper
              className="settings-catalog-scope__static"
              withBorder
            >
              <Text c="dimmed" size="sm">{fe12SettingsMembershipText.membershipCatalogSettings_label_6c90f338}</Text>
              <Text className="settings-catalog-scope__value" fw={700}>{scopeStatus}</Text>
            </Paper>
          )}
          {createDisabledReason ? (
            <Text c="dimmed" className="settings-catalog-scope__reason" size="sm">
              {createDisabledReason}
            </Text>
          ) : null}
        </div>
        <TaskToolbarActions
          aria-label={fe12SettingsMembershipText.membershipCatalogSettings_template_6c24496b(scopeStatus)}
          role="group"
          frequentActions={(
            <TaskToolbarRefreshAction
              loading={refreshLoading}
              onClick={refresh}
            />
          )}
          primaryAction={(
            <TaskToolbarAction
              disabled={!scopeResolved}
              icon={<IconPlus size={18} />}
              label={fe12SettingsMembershipText.membershipCatalogSettings_label_cad58cd3}
              onClick={openCreate}
              priority="primary"
            />
          )}
        />
      </div>
      {itemsLoading ? <LoadingState label={fe12SettingsMembershipText.membershipCatalogSettings_label_2e4affe4}/> : null}
      {branchesError ? <ErrorState title={fe12SettingsMembershipText.membershipCatalogSettings_title_63cfba6d} message={branchesError}/> : null}
      {scopeResolved && !itemsLoading && itemsError ? <ErrorState title={fe12SettingsMembershipText.membershipCatalogSettings_title_db57eb5b} message={itemsError}/> : null}
      {scopeResolved && !itemsLoading && !itemsError && items.length === 0 ? <EmptyState icon={<IconPlus size={24}/>} title={fe12SettingsMembershipText.membershipCatalogSettings_title_af483cf5}/> : null}
      {scopeResolved && !itemsLoading && !itemsError ? <Stack>{items.map((item) => <Paper className="list-row-card" key={item.id} p="lg" withBorder><Group justify="space-between"><Stack gap={6}><Text fw={700}>{item.name}</Text><Text c="dimmed" size="sm">{formatPrice(item.price)} {fe12SettingsMembershipText.membershipCatalogSettings_jsxText_4f8865ab}{item.availableFrom} {fe12SettingsMembershipText.membershipCatalogSettings_jsxText_bda05058}{item.availableTo ?? fe12SettingsMembershipText.membershipCatalogSettings_string_a25d9d8a}</Text></Stack><Button aria-label={fe12SettingsMembershipText.membershipCatalogSettings_template_415f4687(item.name)} leftSection={<IconEdit size={16}/>} onClick={() => openEdit(item)} variant="light">{fe12SettingsMembershipText.membershipCatalogSettings_jsxText_b8b151d4}</Button></Group></Paper>)}</Stack> : null}
    </Stack></PageSection>
    <Modal centered opened={Boolean(modal)} onClose={() => setModal(null)} returnFocus title={modal?.mode === 'edit' ? fe12SettingsMembershipText.membershipCatalogSettings_string_8cce07e6 : fe12SettingsMembershipText.membershipCatalogSettings_string_a946d490}><form onSubmit={form.onSubmit((values) => void submit(values))}><Stack>
      {formError ? <Alert color="red" icon={<IconAlertCircle size={18}/>}>{formError}</Alert> : null}
      <TextInput label={fe12SettingsMembershipText.membershipCatalogSettings_label_0918b4ba} {...form.getInputProps('name')}/>
      {modal?.mode === 'create' ? <SimpleGrid cols={2}><NumberInput label={fe12SettingsMembershipText.membershipCatalogSettings_label_be0e705c} min={0} {...form.getInputProps('price')}/><Select allowDeselect={false} data={behaviorOptions} label={fe12SettingsMembershipText.membershipCatalogSettings_label_132b8f43} {...form.getInputProps('behaviorKind')}/></SimpleGrid> : null}
      <SimpleGrid cols={2}><TextInput type="date" label={fe12SettingsMembershipText.membershipCatalogSettings_label_9d2be902} {...form.getInputProps('availableFrom')}/><TextInput type="date" label={fe12SettingsMembershipText.membershipCatalogSettings_label_4a3c0cb7} {...form.getInputProps('availableTo')}/></SimpleGrid>
      <ResponsiveButtonGroup justify="flex-end"><Button variant="secondary" onClick={() => setModal(null)}>{fe12SettingsMembershipText.membershipCatalogSettings_jsxText_7c47f729}</Button><Button type="submit" loading={submitting}>{fe12SettingsMembershipText.membershipCatalogSettings_jsxText_b4d30cae}</Button></ResponsiveButtonGroup>
    </Stack></form></Modal>
  </Stack>
}

function formatPrice(value: number) { return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 }).format(value) }
