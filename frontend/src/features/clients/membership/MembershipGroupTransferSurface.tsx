import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Group, Paper, Select, Stack, Text } from '@mantine/core'

import {
  ApiError,
  previewClientMembershipTargetTransfer,
  transferClientMembershipTargets,
  type ClientDetails,
  type ClientMembershipTargetGroup,
  type MembershipTargetTransferPreview,
  type TrainingGroupListItem,
} from '../../../lib/api'
import { ResponsiveButtonGroup } from '../../shared/ux'
import { useClientActionSubmissionKey } from '../useClientActionSubmissionKey'
import {
  isMembershipTargetLoadAbort,
  loadAllActiveMembershipTargetGroups,
} from './membershipTargetGroups'

type MembershipGroupTransferSurfaceProps = {
  client: ClientDetails
  pending?: boolean
  onTransferred: (client: ClientDetails) => void
}

export function MembershipGroupTransferSurface({
  client,
  pending = false,
  onTransferred,
}: MembershipGroupTransferSurfaceProps) {
  const [groups, setGroups] = useState<TrainingGroupListItem[]>([])
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [sourceGroupId, setSourceGroupId] = useState<string | null>(null)
  const [targetGroupId, setTargetGroupId] = useState<string | null>(null)
  const [preview, setPreview] = useState<MembershipTargetTransferPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const getSubmissionKey = useClientActionSubmissionKey()
  const expectedMembershipIds = client.currentMemberships.map((membership) => membership.id)
  const sourceOptions = useMemo(() => {
    const sourceGroups = new Map<string, ClientMembershipTargetGroup>()
    for (const membership of client.currentMemberships) {
      for (const target of membership.targetGroups) {
        sourceGroups.set(target.groupId, target)
      }
    }
    return [...sourceGroups.values()].map((group) => ({
      value: group.groupId,
      label: [group.groupName, group.branchName].filter(Boolean).join(' • '),
    }))
  }, [client.currentMemberships])
  const targetOptions = groups
    .filter((group) => group.isActive && group.id !== sourceGroupId)
    .map((group) => ({
      value: group.id,
      label: [group.name, group.branchName, group.hallName, group.trainingStartTime].filter(Boolean).join(' • '),
    }))

  useEffect(() => {
    const controller = new AbortController()
    setGroupsLoading(true)
    void loadAllActiveMembershipTargetGroups(controller.signal)
      .then(setGroups)
      .catch((loadError) => {
        if (!isMembershipTargetLoadAbort(loadError)) {
          setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить группы.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setGroupsLoading(false)
      })
    return () => controller.abort()
  }, [])

  async function loadPreview() {
    if (!sourceGroupId || !targetGroupId) {
      setError('Выберите исходную и целевую группу.')
      return
    }

    setPreviewLoading(true)
    setError(null)
    try {
      setPreview(await previewClientMembershipTargetTransfer(client.id, {
        sourceGroupId,
        targetGroupId,
        expectedMembershipIds,
      }))
    } catch (previewError) {
      setPreview(null)
      setError(previewError instanceof Error ? previewError.message : 'Не удалось построить предпросмотр.')
    } finally {
      setPreviewLoading(false)
    }
  }

  async function submitTransfer() {
    if (!sourceGroupId || !targetGroupId) {
      setError('Выберите исходную и целевую группу.')
      return
    }

    const payload = {
      sourceGroupId,
      targetGroupId,
      expectedMembershipIds: preview?.affectedMemberships.map((membership) => membership.membershipId) ?? [],
    }
    setSubmitLoading(true)
    setError(null)
    try {
      const updatedClient = await transferClientMembershipTargets(
        client.id,
        payload,
        { idempotencyKey: getSubmissionKey('transfer', payload) },
      )
      if (updatedClient) {
        onTransferred(updatedClient)
      }
      setPreview(null)
    } catch (submitError) {
      setError(submitError instanceof ApiError || submitError instanceof Error
        ? submitError.message
        : 'Не удалось перенести группу.')
    } finally {
      setSubmitLoading(false)
    }
  }

  return (
    <Paper className="membership-group-transfer-surface" radius="8px" withBorder>
      <Stack gap="md">
        <div>
          <Text fw={700}>Перенести группу в абонементах</Text>
          <Text c="dimmed" size="sm">
            Операция не создаёт продажу и не меняет цену или оплату.
          </Text>
        </div>
        {error ? <Alert color="red">{error}</Alert> : null}
        <Select
          data={sourceOptions}
          disabled={pending || previewLoading || submitLoading}
          label="Исходная группа"
          onChange={(value) => {
            setSourceGroupId(value)
            setPreview(null)
          }}
          placeholder="Выберите группу"
          searchable
          value={sourceGroupId}
        />
        <Select
          data={targetOptions}
          disabled={pending || groupsLoading || previewLoading || submitLoading}
          label="Целевая группа"
          onChange={(value) => {
            setTargetGroupId(value)
            setPreview(null)
          }}
          placeholder={groupsLoading ? 'Загружаем группы...' : 'Выберите группу'}
          searchable
          value={targetGroupId}
        />
        {preview ? (
          <Stack gap="sm">
            {preview.affectedMemberships.map((membership) => (
              <Paper key={membership.membershipId} p="sm" radius="8px" withBorder>
                <Stack gap="xs">
                  <Text fw={700} size="sm">{membership.membershipName}</Text>
                  <TargetLine label="Было" targets={membership.beforeTargetGroups} />
                  <TargetLine label="Станет" targets={membership.afterTargetGroups} />
                </Stack>
              </Paper>
            ))}
            {preview.affectedMemberships.length === 0 ? (
              <Text c="dimmed" size="sm">Нет затронутых абонементов.</Text>
            ) : null}
          </Stack>
        ) : null}
        <ResponsiveButtonGroup justify="flex-end">
          <Button
            disabled={pending || previewLoading || submitLoading}
            loading={previewLoading}
            onClick={() => void loadPreview()}
            type="button"
            variant="light"
          >
            Показать предпросмотр
          </Button>
          <Button
            disabled={pending || previewLoading || !preview}
            loading={submitLoading}
            onClick={() => void submitTransfer()}
            type="button"
          >
            Перенести группу
          </Button>
        </ResponsiveButtonGroup>
      </Stack>
    </Paper>
  )
}

function TargetLine({
  label,
  targets,
}: {
  label: string
  targets: ClientMembershipTargetGroup[]
}) {
  return (
    <Group align="flex-start" gap="xs" wrap="wrap">
      <Text c="dimmed" fw={600} size="xs">{label}</Text>
      {targets.map((target) => (
        <Text key={`${label}-${target.groupId}`} size="sm">
          {target.position + 1} {target.position === 0 ? 'Отчётность · ' : ''}{target.groupName}
        </Text>
      ))}
    </Group>
  )
}
