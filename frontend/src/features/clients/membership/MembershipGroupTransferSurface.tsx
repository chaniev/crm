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
import { fe7ClientMembershipText } from '../../../resources/fe-7-client-membership'


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
          setError(loadError instanceof Error ? loadError.message : fe7ClientMembershipText.membershipGroupTransferSurface_string_46bd9402)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setGroupsLoading(false)
      })
    return () => controller.abort()
  }, [])

  async function loadPreview() {
    if (!sourceGroupId || !targetGroupId) {
      setError(fe7ClientMembershipText.membershipGroupTransferSurface_setError_265d66a7)
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
      setError(previewError instanceof Error ? previewError.message : fe7ClientMembershipText.membershipGroupTransferSurface_string_fb5e8413)
    } finally {
      setPreviewLoading(false)
    }
  }

  async function submitTransfer() {
    if (!sourceGroupId || !targetGroupId) {
      setError(fe7ClientMembershipText.membershipGroupTransferSurface_setError_265d66a7)
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
        : fe7ClientMembershipText.membershipGroupTransferSurface_string_8d75ef84)
    } finally {
      setSubmitLoading(false)
    }
  }

  return (
    <Paper className="membership-group-transfer-surface" radius="8px" withBorder>
      <Stack gap="md">
        <div>
          <Text fw={700}>{fe7ClientMembershipText.membershipGroupTransferSurface_jsxText_01c7a7e5}</Text>
          <Text c="dimmed" size="sm">
            {fe7ClientMembershipText.membershipGroupTransferSurface_jsxText_0d3bdb14}</Text>
        </div>
        {error ? <Alert color="red">{error}</Alert> : null}
        <Select
          data={sourceOptions}
          disabled={pending || previewLoading || submitLoading}
          label={fe7ClientMembershipText.membershipGroupTransferSurface_label_874977d3}
          onChange={(value) => {
            setSourceGroupId(value)
            setPreview(null)
          }}
          placeholder={fe7ClientMembershipText.membershipGroupTransferSurface_placeholder_298a07c0}
          searchable
          value={sourceGroupId}
        />
        <Select
          data={targetOptions}
          disabled={pending || groupsLoading || previewLoading || submitLoading}
          label={fe7ClientMembershipText.membershipGroupTransferSurface_label_1105fc2c}
          onChange={(value) => {
            setTargetGroupId(value)
            setPreview(null)
          }}
          placeholder={groupsLoading ? fe7ClientMembershipText.membershipGroupTransferSurface_string_f6f37b0e : fe7ClientMembershipText.membershipGroupTransferSurface_placeholder_298a07c0}
          searchable
          value={targetGroupId}
        />
        {preview ? (
          <Stack gap="sm">
            {preview.affectedMemberships.map((membership) => (
              <Paper key={membership.membershipId} p="sm" radius="8px" withBorder>
                <Stack gap="xs">
                  <Text fw={700} size="sm">{membership.membershipName}</Text>
                  <TargetLine label={fe7ClientMembershipText.membershipGroupTransferSurface_label_4fae346e} targets={membership.beforeTargetGroups} />
                  <TargetLine label={fe7ClientMembershipText.membershipGroupTransferSurface_label_66e855e0} targets={membership.afterTargetGroups} />
                </Stack>
              </Paper>
            ))}
            {preview.affectedMemberships.length === 0 ? (
              <Text c="dimmed" size="sm">{fe7ClientMembershipText.membershipGroupTransferSurface_jsxText_7c4fbae8}</Text>
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
            {fe7ClientMembershipText.membershipGroupTransferSurface_jsxText_4b8e058e}</Button>
          <Button
            disabled={pending || previewLoading || !preview}
            loading={submitLoading}
            onClick={() => void submitTransfer()}
            type="button"
          >
            {fe7ClientMembershipText.membershipGroupTransferSurface_jsxText_52992c28}</Button>
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
          {target.position + 1} {target.position === 0 ? fe7ClientMembershipText.membershipGroupTransferSurface_string_68f7b035 : ''}{target.groupName}
        </Text>
      ))}
    </Group>
  )
}
