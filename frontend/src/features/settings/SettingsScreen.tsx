import { useEffect, useState } from 'react'
import {
  Alert,
  Badge,
  Group,
  Modal,
  Paper,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useMediaQuery } from '@mantine/hooks'
import {
  IconAlertCircle,
  IconDeviceFloppy,
  IconEdit,
  IconSettings,
  IconTags,
  IconIdBadge2,
  IconTrash,
  IconUserCog,
} from '@tabler/icons-react'
import {
  ApiError,
  applyFieldErrors,
  createGroupType,
  deleteGroupType,
  getGroupTypes,
  updateGroupType,
  type GroupType,
  type AuthenticatedUser,
} from '../../lib/api'
import {
  Button,
  ConfirmActionModal,
  EmptyState,
  ErrorState,
  LoadingState,
  PageLayout,
  PageSection,
  PageTabsPanel,
  ResponsiveButtonGroup,
  TaskToolbarAction,
  TaskToolbarActions,
  TaskToolbarRefreshAction,
} from '../shared/ux'
import { showAppNotification } from '../shared/notifications'
import { BranchSettingsScreen } from './BranchSettingsScreen'
import { AdministratorsSettingsPanel } from './AdministratorsSettingsPanel'
import { MembershipCatalogSettings } from './MembershipCatalogSettings'
import { fe10SettingsBranchesShellText } from '../../resources/fe-10-settings-branches-shell'


type SettingsTab = 'catalog' | 'group-types' | 'branches' | 'administrators'

export function SettingsScreen({ user }: { user: AuthenticatedUser }) {
  const isMobile = useMediaQuery('(max-width: 48em)')
  const [activeTab, setActiveTab] = useState<SettingsTab>('catalog')
  const canManageAdministrators = user.createRoleOptions?.includes('Administrator') === true
  const canManageGroupTypes = user.permissions.canManageSettings
  const canManageHeadCoachSettings = user.createRoleOptions?.includes('SuperAdministrator') === true

  return (
    <PageLayout data-testid="settings-screen" showHeader={false} title={fe10SettingsBranchesShellText.settingsScreen_title_985b5e0f}>
      <Tabs
        className="settings-tabs"
        keepMounted={false}
        onChange={(value) => setActiveTab((value as SettingsTab | null) ?? 'catalog')}
        value={activeTab}
      >
        <PageSection>
          <Tabs.List className="settings-tabs__list" grow={isMobile}>
            <Tabs.Tab leftSection={<IconIdBadge2 size={18} />} value={'catalog' satisfies SettingsTab}>
              {fe10SettingsBranchesShellText.settingsScreen_jsxText_b2644036}</Tabs.Tab>
            {canManageGroupTypes ? (
              <Tabs.Tab
                leftSection={<IconTags size={18} />}
                value={'group-types' satisfies SettingsTab}
              >
                {fe10SettingsBranchesShellText.settingsScreen_jsxText_99c433e6}</Tabs.Tab>
            ) : null}
            {canManageHeadCoachSettings ? (
              <Tabs.Tab
                leftSection={<IconSettings size={18} />}
                value={'branches' satisfies SettingsTab}
              >
                {fe10SettingsBranchesShellText.settingsScreen_jsxText_3e453a66}</Tabs.Tab>
            ) : null}
            {canManageAdministrators ? (
              <Tabs.Tab
                leftSection={<IconUserCog size={18} />}
                value={'administrators' satisfies SettingsTab}
              >
                {fe10SettingsBranchesShellText.settingsScreen_jsxText_0a3fd3c7}</Tabs.Tab>
            ) : null}
          </Tabs.List>
        </PageSection>

        <PageTabsPanel value={'catalog' satisfies SettingsTab}>
          <MembershipCatalogSettings
            assignedBranchId={user.branchId}
            canSelectBranch={user.branchId === null}
          />
        </PageTabsPanel>

        {canManageGroupTypes ? (
          <PageTabsPanel value={'group-types' satisfies SettingsTab}>
            <GroupTypesSettingsPanel />
          </PageTabsPanel>
        ) : null}

        {canManageHeadCoachSettings ? (
          <PageTabsPanel value={'branches' satisfies SettingsTab}>
            <BranchSettingsScreen embedded />
          </PageTabsPanel>
        ) : null}

        {canManageAdministrators ? <PageTabsPanel value={'administrators' satisfies SettingsTab}>
          <AdministratorsSettingsPanel
            onOpenBranches={
              canManageHeadCoachSettings ? () => setActiveTab('branches') : undefined
            }
          />
        </PageTabsPanel> : null}
      </Tabs>
    </PageLayout>
  )
}

type GroupTypeFormValues = {
  name: string
  description: string
}

type GroupTypeModalState =
  | { mode: 'create' }
  | { mode: 'edit'; groupType: GroupType }
  | null

function GroupTypesSettingsPanel() {
  const [groupTypes, setGroupTypes] = useState<GroupType[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [modalState, setModalState] = useState<GroupTypeModalState>(null)
  const [submitting, setSubmitting] = useState(false)
  const [groupTypeToDelete, setGroupTypeToDelete] = useState<GroupType | null>(null)
  const [deletePending, setDeletePending] = useState(false)
  const form = useForm<GroupTypeFormValues>({
    initialValues: {
      name: '',
      description: '',
    },
    validate: {
      name: (value) => (value.trim() ? null : fe10SettingsBranchesShellText.settingsScreen_string_2fea0015),
    },
  })

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setLoadError(null)

      try {
        setGroupTypes(await getGroupTypes(controller.signal))
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : fe10SettingsBranchesShellText.settingsScreen_string_aa06a031,
        )
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => controller.abort()
  }, [reloadKey])

  function openCreateModal() {
    form.setValues({ name: '', description: '' })
    form.clearErrors()
    setFormError(null)
    setModalState({ mode: 'create' })
  }

  function openEditModal(groupType: GroupType) {
    form.setValues({
      name: groupType.name,
      description: groupType.description ?? '',
    })
    form.clearErrors()
    setFormError(null)
    setModalState({ mode: 'edit', groupType })
  }

  async function submit(values: GroupTypeFormValues) {
    if (!modalState) {
      return
    }

    setSubmitting(true)
    setFormError(null)
    form.clearErrors()

    try {
      const payload = {
        name: values.name.trim(),
        description: values.description.trim() || null,
      }
      const savedGroupType =
        modalState.mode === 'create'
          ? await createGroupType(payload)
          : await updateGroupType(modalState.groupType.id, payload)

      setGroupTypes((current) =>
        modalState.mode === 'create'
          ? [...current, savedGroupType].sort(compareGroupTypes)
          : current
              .map((groupType) =>
                groupType.id === savedGroupType.id ? savedGroupType : groupType,
              )
              .sort(compareGroupTypes),
      )
      setModalState(null)

      showAppNotification({
        id: `settings-group-type-${modalState.mode}`,
        title: modalState.mode === 'create' ? fe10SettingsBranchesShellText.settingsScreen_string_33718ea5 : fe10SettingsBranchesShellText.settingsScreen_string_0b22e53e,
        message: fe10SettingsBranchesShellText.settingsScreen_message_eae6ee55(savedGroupType.name),
        color: 'teal',
      })
    } catch (error) {
      if (error instanceof ApiError) {
        form.setErrors(applyFieldErrors(error.fieldErrors))
        setFormError(error.message)
        return
      }

      setFormError(fe10SettingsBranchesShellText.settingsScreen_setFormError_a7a05224)
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmDeleteGroupType() {
    if (!groupTypeToDelete) {
      return
    }

    setDeletePending(true)

    try {
      await deleteGroupType(groupTypeToDelete.id)
      setGroupTypes((current) =>
        current.filter((groupType) => groupType.id !== groupTypeToDelete.id),
      )
      showAppNotification({
        id: 'settings-group-type-delete-success',
        title: fe10SettingsBranchesShellText.settingsScreen_title_a040ef93,
        message: fe10SettingsBranchesShellText.settingsScreen_message_7c4f3bca(groupTypeToDelete.name),
        color: 'teal',
      })
      setGroupTypeToDelete(null)
    } catch (error) {
      showAppNotification({
        id: 'settings-group-type-delete-error',
        title: fe10SettingsBranchesShellText.settingsScreen_title_cf16993b,
        message:
          error instanceof Error
            ? error.message
            : fe10SettingsBranchesShellText.settingsScreen_string_418d8149,
        color: 'red',
      })
    } finally {
      setDeletePending(false)
    }
  }

  return (
    <Stack gap="xl">
      <PageSection>
        <Stack gap="lg">
          <TaskToolbarActions
            frequentActions={<TaskToolbarRefreshAction loading={loading} onClick={() => setReloadKey((key) => key + 1)} />}
            primaryAction={(
              <TaskToolbarAction
                icon={<IconTags size={18} />}
                label={fe10SettingsBranchesShellText.settingsScreen_label_ead26ac8}
                onClick={openCreateModal}
                priority="primary"
              />
            )}
          />

          {loading ? <LoadingState label={fe10SettingsBranchesShellText.settingsScreen_label_81dcfe1a} /> : null}

          {!loading && loadError ? (
            <ErrorState message={loadError} title={fe10SettingsBranchesShellText.settingsScreen_title_d81794ff} />
          ) : null}

          {!loading && !loadError && groupTypes.length === 0 ? (
            <EmptyState
              icon={<IconTags size={24} />}
              title={fe10SettingsBranchesShellText.settingsScreen_title_534bb5ea}
            />
          ) : null}

          {!loading && !loadError && groupTypes.length > 0 ? (
            <Stack gap="md">
              {groupTypes.map((groupType) => (
                <Paper
                  className="list-row-card"
                  data-testid={`group-type-card-${groupType.id}`}
                  key={groupType.id}
                  radius="24px"
                  withBorder
                >
                  <Group justify="space-between" wrap="wrap">
                    <Stack gap={8}>
                      <Group gap="sm" wrap="wrap">
                        <Text fw={700}>{groupType.name}</Text>
                        <Badge color="var(--crm-brand-primary-soft)" radius="xl" variant="light">
                          {fe10SettingsBranchesShellText.settingsScreen_jsxText_c72164c0}{groupType.groupCount}
                        </Badge>
                      </Group>
                      {groupType.description ? (
                        <Text c="dimmed" size="sm">
                          {groupType.description}
                        </Text>
                      ) : null}
                    </Stack>

                    <ResponsiveButtonGroup justify="flex-end">
                      <Button
                        leftSection={<IconEdit size={18} />}
                        onClick={() => openEditModal(groupType)}
                        variant="pill"
                      >
                        {fe10SettingsBranchesShellText.settingsScreen_jsxText_59792556}</Button>
                      <Button
                        color="red"
                        disabled={groupType.groupCount > 0}
                        leftSection={<IconTrash size={18} />}
                        onClick={() => setGroupTypeToDelete(groupType)}
                        variant="pill"
                      >
                        {fe10SettingsBranchesShellText.settingsScreen_jsxText_be99b136}</Button>
                    </ResponsiveButtonGroup>
                  </Group>
                </Paper>
              ))}
            </Stack>
          ) : null}
        </Stack>
      </PageSection>

      <Modal
        centered
        onClose={() => setModalState(null)}
        opened={Boolean(modalState)}
        radius="24px"
        title={modalState?.mode === 'create' ? fe10SettingsBranchesShellText.settingsScreen_string_3459cccc : fe10SettingsBranchesShellText.settingsScreen_string_ed4e0fd4}
      >
        <form onSubmit={form.onSubmit((values) => void submit(values))}>
          <Stack gap="lg">
            {formError ? (
              <Alert
                color="red"
                icon={<IconAlertCircle size={18} />}
                title={fe10SettingsBranchesShellText.settingsScreen_title_09e1875e}
                variant="light"
              >
                {formError}
              </Alert>
            ) : null}
            <TextInput
              label={fe10SettingsBranchesShellText.settingsScreen_label_0918b4ba}
              placeholder={fe10SettingsBranchesShellText.settingsScreen_placeholder_070fa4aa}
              {...form.getInputProps('name')}
            />
            <Textarea
              autosize
              label={fe10SettingsBranchesShellText.settingsScreen_label_b3680f2c}
              minRows={3}
              placeholder={fe10SettingsBranchesShellText.settingsScreen_placeholder_00d135e4}
              {...form.getInputProps('description')}
            />

            <ResponsiveButtonGroup justify="flex-end">
              <Button onClick={() => setModalState(null)} variant="secondary">
                {fe10SettingsBranchesShellText.settingsScreen_jsxText_7c47f729}</Button>
              <Button
                leftSection={<IconDeviceFloppy size={18} />}
                loading={submitting}
                type="submit"
              >
                {fe10SettingsBranchesShellText.settingsScreen_jsxText_b4d30cae}</Button>
            </ResponsiveButtonGroup>
          </Stack>
        </form>
      </Modal>

      <ConfirmActionModal
        confirmColor="red"
        confirmLabel={fe10SettingsBranchesShellText.settingsScreen_jsxText_be99b136}
        description={fe10SettingsBranchesShellText.settingsScreen_template_2dd95e54(groupTypeToDelete?.name ?? '')}
        onClose={() => setGroupTypeToDelete(null)}
        onConfirm={() => void confirmDeleteGroupType()}
        opened={Boolean(groupTypeToDelete)}
        pending={deletePending}
        title={fe10SettingsBranchesShellText.settingsScreen_title_f99a8a6f}
      />
    </Stack>
  )
}

function compareGroupTypes(left: GroupType, right: GroupType) {
  return left.name.localeCompare(right.name, 'ru')
}
