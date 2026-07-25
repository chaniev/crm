import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Badge,
  Checkbox,
  Group,
  Modal,
  Paper,
  ScrollArea,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import {
  IconAlertCircle,
  IconDeviceFloppy,
  IconRefresh,
  IconSearch,
  IconUsersGroup,
} from '@tabler/icons-react'
import {
  ApiError,
  applyFieldErrors,
  getAdministratorAttendanceScope,
  replaceAdministratorAttendanceScope,
  type AdministratorAttendanceScopeGroup,
  type AdministratorAttendanceScopeResponse,
  type UserListItem,
} from '../../lib/api'
import { formatGroupSchedule } from '../../lib/groupSchedule'
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  ResponsiveButtonGroup,
} from '../shared/ux'

type AdministratorAttendanceScopeModalProps = {
  administrator: UserListItem | null
  onClose: () => void
  onSaved: (administratorId: string, grantedGroupCount: number) => void
}

export function AdministratorAttendanceScopeModal({
  administrator,
  onClose,
  onSaved,
}: AdministratorAttendanceScopeModalProps) {
  const isMobile = useMediaQuery('(max-width: 48em)')
  const [scope, setScope] = useState<AdministratorAttendanceScopeResponse | null>(null)
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [reloading, setReloading] = useState(false)
  const [query, setQuery] = useState('')
  const [confirmRevokeOpen, setConfirmRevokeOpen] = useState(false)

  useEffect(() => {
    if (!administrator) {
      setScope(null)
      setSelectedGroupIds([])
      setQuery('')
      setLoadError(null)
      setSaveError(null)
      setConfirmRevokeOpen(false)
      return
    }

    const controller = new AbortController()

    async function loadScope() {
      setLoading(true)
      setLoadError(null)
      setSaveError(null)
      setFieldErrors({})
      setConfirmRevokeOpen(false)

      try {
        const response = await getAdministratorAttendanceScope(
          administrator!.id,
          controller.signal,
        )
        if (controller.signal.aborted) {
          return
        }

        setScope(response)
        setSelectedGroupIds(response.grantedGroupIds)
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить группы посещений.',
        )
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadScope()

    return () => controller.abort()
  }, [administrator])

  useEffect(() => {
    if (confirmRevokeOpen) {
      window.setTimeout(() => {
        document
          .querySelector<HTMLButtonElement>('.administrator-attendance-scope-modal__revoke-back')
          ?.focus()
      }, 0)
    }
  }, [confirmRevokeOpen])

  const selectedSet = useMemo(() => new Set(selectedGroupIds), [selectedGroupIds])
  const expectedSet = useMemo(
    () => new Set(scope?.grantedGroupIds ?? []),
    [scope?.grantedGroupIds],
  )
  const revokedGroupIds = useMemo(
    () => (scope?.grantedGroupIds ?? []).filter((groupId) => !selectedSet.has(groupId)),
    [scope?.grantedGroupIds, selectedSet],
  )
  const visibleGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const groups = scope?.groups ?? []

    if (!normalizedQuery) {
      return groups
    }

    return groups.filter((group) => group.name.toLowerCase().includes(normalizedQuery))
  }, [query, scope?.groups])

  if (!administrator) {
    return null
  }
  const activeAdministrator = administrator

  async function submit() {
    if (!scope || saving) {
      return
    }

    if (revokedGroupIds.length > 0 && !confirmRevokeOpen) {
      setConfirmRevokeOpen(true)
      return
    }

    setSaving(true)
    setSaveError(null)
    setFieldErrors({})

    try {
      const response = await replaceAdministratorAttendanceScope(activeAdministrator.id, {
        expectedGroupIds: scope.grantedGroupIds,
        groupIds: selectedGroupIds,
      })
      setScope(response)
      setSelectedGroupIds(response.grantedGroupIds)
      setConfirmRevokeOpen(false)
      onSaved(activeAdministrator.id, response.grantedGroupIds.length)
      onClose()
    } catch (error) {
      if (error instanceof ApiError) {
        setSaveError(error.message)
        setFieldErrors(applyFieldErrors(error.fieldErrors))
        return
      }

      setSaveError('Не удалось сохранить группы посещений.')
    } finally {
      setSaving(false)
    }
  }

  async function reloadScopeFromBackend() {
    setReloading(true)

    try {
      const response = await getAdministratorAttendanceScope(activeAdministrator.id)
      setScope(response)
      setSelectedGroupIds(response.grantedGroupIds)
      setSaveError(null)
      setFieldErrors({})
    } catch {
      // The visible error from the failed save remains actionable.
    } finally {
      setReloading(false)
    }
  }

  function toggleGroup(group: AdministratorAttendanceScopeGroup, checked: boolean) {
    setSaveError(null)
    setFieldErrors({})
    setConfirmRevokeOpen(false)
    setSelectedGroupIds((current) => {
      if (checked) {
        return current.includes(group.id) ? current : [...current, group.id]
      }

      return current.filter((groupId) => groupId !== group.id)
    })
  }

  const changed =
    selectedGroupIds.length !== expectedSet.size ||
    selectedGroupIds.some((groupId) => !expectedSet.has(groupId))
  const selectedCount = selectedGroupIds.length
  const showSearchEmpty =
    query.trim().length > 0 &&
    visibleGroups.length === 0 &&
    scope !== null &&
    scope.groups.length > 0

  return (
    <Modal
      centered={!isMobile}
      classNames={{
        body: 'administrator-attendance-scope-modal__body',
        content: 'administrator-attendance-scope-modal__content',
      }}
      fullScreen={isMobile}
      onClose={() => {
        if (!saving) {
          onClose()
        }
      }}
      opened
      radius={isMobile ? 0 : '16px'}
      size="720px"
      title="Группы посещений"
      withCloseButton={!saving}
      yOffset={isMobile ? 0 : '2dvh'}
      zIndex={320}
    >
      <Stack className="administrator-attendance-scope-modal" gap="lg">
          <Stack gap={4}>
            <Text fw={700}>{activeAdministrator.fullName}</Text>
            <Text c="dimmed" size="sm">
              Филиал: {scope?.branch?.name ?? activeAdministrator.branchName ?? 'не назначен'}
            </Text>
          </Stack>

          {loading ? <LoadingState label="Загружаем группы посещений..." /> : null}
          {!loading && loadError ? (
            <ErrorState message={loadError} title="Группы не загрузились" />
          ) : null}

          {!loading && !loadError && scope ? (
            <Stack gap="md">
              <Group justify="space-between" wrap="wrap">
                <Badge aria-live="polite" color="teal" radius="xl" role="status" variant="light">
                  Выбрано: {selectedCount}
                </Badge>
                {revokedGroupIds.length > 0 ? (
                  <Badge color="red" radius="xl" variant="light">
                    К отзыву: {revokedGroupIds.length}
                  </Badge>
                ) : null}
              </Group>

              {saveError ? (
                <Alert
                  color="red"
                  icon={<IconAlertCircle size={18} />}
                  title="Сохранение не выполнено"
                  variant="light"
                >
                  {saveError}
                  {fieldErrors.groupIds ? (
                    <Text mt={6} size="sm">{fieldErrors.groupIds}</Text>
                  ) : null}
                  {fieldErrors.expectedGroupIds ? (
                    <Text mt={6} size="sm">{fieldErrors.expectedGroupIds}</Text>
                  ) : null}
                  <Button
                    leftSection={<IconRefresh size={18} />}
                    loading={reloading}
                    mt="sm"
                    onClick={() => void reloadScopeFromBackend()}
                    variant="secondary"
                  >
                    Обновить данные
                  </Button>
                </Alert>
              ) : null}

              <TextInput
                leftSection={<IconSearch size={18} />}
                label="Поиск группы"
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder="Название группы"
                value={query}
              />

              {scope.groups.length === 0 && scope.unavailableGrants.length === 0 ? (
                <EmptyState
                  icon={<IconUsersGroup size={24} />}
                  title="В филиале нет групп для назначения"
                />
              ) : null}

              {showSearchEmpty ? (
                <EmptyState
                  icon={<IconSearch size={24} />}
                  title="По совпадению ничего не найдено"
                />
              ) : null}

              <ScrollArea.Autosize mah="52vh" type="auto">
                <Stack gap="sm" role="group" aria-label="Группы посещений администратора">
                  {visibleGroups.map((group) => (
                    <GroupGrantRow
                      checked={selectedSet.has(group.id)}
                      group={group}
                      key={group.id}
                      onChange={(checked) => toggleGroup(group, checked)}
                      originallyGranted={expectedSet.has(group.id)}
                    />
                  ))}
                  {scope.unavailableGrants.map((grant) => (
                    <UnavailableGrantRow
                      checked={selectedSet.has(grant.groupId)}
                      disabled={!grant.canRevoke}
                      groupId={grant.groupId}
                      key={grant.groupId}
                      onChange={(checked) =>
                        setSelectedGroupIds((current) =>
                          checked
                            ? current.includes(grant.groupId)
                              ? current
                              : [...current, grant.groupId]
                            : current.filter((groupId) => groupId !== grant.groupId),
                        )
                      }
                      reason={grant.disabledReason}
                    />
                  ))}
                </Stack>
              </ScrollArea.Autosize>

              <Stack
                aria-live="polite"
                className="administrator-attendance-scope-modal__footer"
                gap="sm"
                role="status"
              >
                {confirmRevokeOpen ? (
                  <Alert color="red" title="Отозвать доступ к группам?" variant="light">
                    Будет отозван доступ к {formatGroupCount(revokedGroupIds.length)}. Доступ администратора к этим группам для посещений прекратится сразу после сохранения.
                  </Alert>
                ) : null}
                {saving ? (
                  <Text c="dimmed" size="sm">
                    Сохраняем изменения...
                  </Text>
                ) : null}
                {confirmRevokeOpen ? (
                  <ResponsiveButtonGroup justify="flex-end">
                    <Button
                      className="administrator-attendance-scope-modal__revoke-back"
                      disabled={saving}
                      onClick={() => setConfirmRevokeOpen(false)}
                      variant="secondary"
                    >
                      Вернуться
                    </Button>
                    <Button color="red" loading={saving} onClick={() => void submit()}>
                      Отозвать и сохранить
                    </Button>
                  </ResponsiveButtonGroup>
                ) : (
                  <ResponsiveButtonGroup justify="flex-end">
                    <Button disabled={saving} onClick={onClose} variant="secondary">
                      Отменить
                    </Button>
                    <Button
                      disabled={!changed}
                      leftSection={<IconDeviceFloppy size={18} />}
                      loading={saving}
                      onClick={() => void submit()}
                    >
                      Сохранить
                    </Button>
                  </ResponsiveButtonGroup>
                )}
              </Stack>
            </Stack>
          ) : null}
        </Stack>
      </Modal>
  )
}

function GroupGrantRow({
  checked,
  group,
  onChange,
  originallyGranted,
}: {
  checked: boolean
  group: AdministratorAttendanceScopeGroup
  onChange: (checked: boolean) => void
  originallyGranted: boolean
}) {
  const disabled = checked ? originallyGranted && !group.canRevoke : !group.canGrant

  return (
    <Paper className="list-row-card" radius="16px" withBorder>
      <Checkbox
        checked={checked}
        disabled={disabled}
        label={(
          <Stack gap={4}>
            <Group gap="xs" wrap="wrap">
              <Text fw={700}>{group.name}</Text>
              {!group.isActive ? (
                <Badge color="gray" radius="xl" variant="light">
                  Неактивна
                </Badge>
              ) : null}
            </Group>
            <Text c="dimmed" size="sm">
              {formatScopeGroupDescription(group)}
            </Text>
            {disabled && group.disabledReason ? (
              <Text c="dimmed" size="sm">
                {formatDisabledReason(group.disabledReason)}
              </Text>
            ) : null}
          </Stack>
        )}
        onChange={(event) => onChange(event.currentTarget.checked)}
        size="md"
      />
    </Paper>
  )
}

function UnavailableGrantRow({
  checked,
  disabled,
  groupId,
  onChange,
  reason,
}: {
  checked: boolean
  disabled: boolean
  groupId: string
  onChange: (checked: boolean) => void
  reason: string
}) {
  return (
    <Paper className="list-row-card" radius="16px" withBorder>
      <Checkbox
        checked={checked}
        disabled={disabled}
        label={(
          <Stack gap={4}>
            <Text fw={700}>Недоступное сохраненное назначение</Text>
            <Text c="dimmed" size="sm">
              ID группы: {groupId}
            </Text>
            <Text c="dimmed" size="sm">
              {formatDisabledReason(reason)}
            </Text>
          </Stack>
        )}
        onChange={(event) => onChange(event.currentTarget.checked)}
        size="md"
      />
    </Paper>
  )
}

function formatScopeGroupDescription(group: AdministratorAttendanceScopeGroup) {
  const details: string[] = []
  if (group.trainingStartTime) {
    details.push(`Старт ${group.trainingStartTime}`)
  }
  if (group.weekdays && typeof group.durationMinutes === 'number') {
    details.push(formatGroupSchedule(group.weekdays, group.durationMinutes))
  }

  return details.join(', ') || 'Расписание не указано'
}

function formatDisabledReason(reason: string) {
  if (reason === 'inactive_group' || reason === 'group_inactive') {
    return 'Группа отключена'
  }

  if (reason === 'inactive_administrator') {
    return 'Администратор отключен.'
  }

  if (reason === 'archived_branch') {
    return 'Филиал в архиве.'
  }

  if (reason === 'grant_scope_invalid') {
    return 'Назначение больше не входит в допустимую область.'
  }

  return 'Назначение недоступно.'
}

function formatGroupCount(count: number) {
  if (count === 1) {
    return '1 группе'
  }

  return `${count} группам`
}
