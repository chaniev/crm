import { useEffect, useState } from 'react'
import { Alert, Button, Group, Stack, Text, Textarea } from '@mantine/core'

import { updateClientMembershipComment, type ClientMembership } from '../../../lib/api'
import { formatDateValue } from '../ClientManagement.formatting'
import { formatNoteAttributionDate } from '../noteAttribution'

type MembershipSaleCommentProps = {
  clientId: string
  membership: ClientMembership
  onMembershipCommentChange: (membership: ClientMembership) => void
}

export function MembershipSaleComment({
  clientId,
  membership,
  onMembershipCommentChange,
}: MembershipSaleCommentProps) {
  const [editing, setEditing] = useState(false)
  const [comment, setComment] = useState(membership.comment ?? '')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const attribution =
    membership.commentLastChangedByName && membership.commentLastChangedAt
      ? formatNoteAttributionDate(membership.commentLastChangedAt)
      : null

  useEffect(() => {
    if (!editing) setComment(membership.comment ?? '')
  }, [editing, membership.comment])

  function toggleEditing() {
    if (pending) return
    if (editing) {
      setComment(membership.comment ?? '')
      setError(null)
    }
    setEditing((value) => !value)
  }

  async function save() {
    setPending(true)
    setError(null)
    try {
      const updatedClient = await updateClientMembershipComment(
        clientId,
        membership.saleId,
        comment,
      )
      const updatedMembership = updatedClient.membershipHistory.find(
        (candidate) => candidate.saleId === membership.saleId,
      )
      if (!updatedMembership) {
        throw new Error('Сервер не вернул обновлённый комментарий покупки.')
      }
      onMembershipCommentChange(updatedMembership)
      setEditing(false)
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Не удалось сохранить комментарий.',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <Stack
      className="membership-sale-comment"
      data-testid={`membership-sale-comment-${membership.saleId}`}
      gap="xs"
    >
      <Group justify="space-between" wrap="wrap">
        <Text fw={700} size="sm">
          Комментарий к покупке
        </Text>
        <Button
          aria-label={`${editing ? 'Отменить редактирование' : 'Редактировать комментарий'} к покупке от ${formatDateValue(membership.purchaseDate)}`}
          disabled={pending}
          onClick={toggleEditing}
          size="compact-sm"
          variant="subtle"
        >
          {editing ? 'Отмена' : 'Редактировать'}
        </Button>
      </Group>
      {editing ? (
        <Stack gap="xs">
          <Textarea
            aria-label="Комментарий к покупке"
            disabled={pending}
            maxLength={2000}
            minRows={3}
            onChange={(event) => setComment(event.currentTarget.value)}
            value={comment}
          />
          {error ? (
            <Alert color="red" variant="light">
              {error}
            </Alert>
          ) : null}
          <Group justify="flex-end">
            <Button loading={pending} onClick={() => void save()} size="sm">
              Сохранить
            </Button>
          </Group>
        </Stack>
      ) : (
        <Stack gap={4}>
          {membership.comment ? (
            <Text className="membership-sale-comment__text" size="sm">
              {membership.comment}
            </Text>
          ) : (
            <Text c="dimmed" size="sm">
              Комментарий пока не добавлен.
            </Text>
          )}
          {attribution ? (
            <Text
              className="membership-sale-comment__attribution"
              c="dimmed"
              size="xs"
            >
              {membership.commentLastChangedByName} · {attribution}
            </Text>
          ) : null}
        </Stack>
      )}
    </Stack>
  )
}
