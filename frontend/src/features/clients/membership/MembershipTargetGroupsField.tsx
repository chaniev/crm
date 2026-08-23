import { useMemo, useRef, useState } from 'react'
import { Badge, Button, Group, Select, Stack, Text } from '@mantine/core'
import { IconArrowDown, IconArrowUp, IconTrash } from '@tabler/icons-react'

import type { MembershipBehaviorKind, TrainingGroupListItem } from '../../../lib/api'

type MembershipTargetGroupsFieldProps = {
  behaviorKind: MembershipBehaviorKind
  error?: string
  groups: TrainingGroupListItem[]
  loading?: boolean
  targetGroupIds: string[]
  onChange: (targetGroupIds: string[]) => void
}

const maxTargetGroups = 5

export function MembershipTargetGroupsField({
  behaviorKind,
  error,
  groups,
  loading = false,
  targetGroupIds,
  onChange,
}: MembershipTargetGroupsFieldProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const addSelectRef = useRef<HTMLInputElement | null>(null)
  const removeButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const selectedGroups = useMemo(
    () =>
      targetGroupIds
        .map((groupId) => groups.find((group) => group.id === groupId))
        .filter((group): group is TrainingGroupListItem => group !== undefined),
    [groups, targetGroupIds],
  )
  const availableOptions = groups
    .filter((group) => group.isActive && !targetGroupIds.includes(group.id))
    .map((group) => ({
      value: group.id,
      label: formatTargetGroupOption(group),
    }))
  const isSingleVisit = behaviorKind === 'SingleVisit'
  const canAdd =
    !loading &&
    targetGroupIds.length < (isSingleVisit ? 1 : maxTargetGroups) &&
    availableOptions.length > 0

  function commit(nextIds: string[], message: string) {
    onChange(nextIds)
    setAnnouncement(message)
  }

  function addTarget(groupId: string | null) {
    if (!groupId || !canAdd) {
      return
    }

    const group = groups.find((candidate) => candidate.id === groupId)
    if (!group) {
      return
    }

    commit([...targetGroupIds, groupId], `Группа ${group.name} добавлена.`)
    setSelectedOption(null)
  }

  function moveTarget(index: number, direction: -1 | 1) {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= targetGroupIds.length) {
      return
    }

    const nextIds = [...targetGroupIds]
    const [moved] = nextIds.splice(index, 1)
    nextIds.splice(nextIndex, 0, moved)
    const group = selectedGroups[index]
    commit(nextIds, `Группа ${group?.name ?? ''} перемещена на позицию ${nextIndex + 1}.`)
  }

  function removeTarget(index: number) {
    const group = selectedGroups[index]
    const nextIds = targetGroupIds.filter((_, candidateIndex) => candidateIndex !== index)
    commit(nextIds, `Группа ${group?.name ?? ''} удалена.`)

    window.requestAnimationFrame(() => {
      const focusTarget =
        nextIds[index] ?? nextIds[index - 1] ?? null
      if (focusTarget) {
        removeButtonRefs.current[focusTarget]?.focus()
      } else {
        addSelectRef.current?.focus()
      }
    })
  }

  return (
    <fieldset className="membership-target-groups-field">
      <legend>Группы абонемента</legend>
      <Stack gap="sm">
        <Text c="dimmed" size="sm">
          {describeTargetRules(behaviorKind)}
        </Text>
        {behaviorKind === 'Professional' ? (
          <Text c="dimmed" size="sm">
            Доступ остаётся ко всем группам; выбранные группы нужны для отчётности.
          </Text>
        ) : null}
        <Select
          data={availableOptions}
          disabled={!canAdd}
          error={error}
          label="Добавить группу"
          ref={addSelectRef}
          onChange={addTarget}
          placeholder={
            loading
              ? 'Загружаем группы...'
              : targetGroupIds.length >= maxTargetGroups
                ? 'Выбрано 5 групп'
                : 'Найдите группу'
          }
          searchable
          value={selectedOption}
        />
        {selectedGroups.length === 0 ? (
          <Text c="dimmed" size="sm">
            Нет выбранных групп.
          </Text>
        ) : (
          <Stack gap="xs">
            {selectedGroups.map((group, index) => (
              <div className="membership-target-group-row" key={group.id}>
                <Badge className="membership-target-group-row__position" radius="sm" variant="light">
                  {index + 1}
                </Badge>
                <div className="membership-target-group-row__main">
                  <Text fw={700} lineClamp={2} title={group.name}>
                    {group.name}
                  </Text>
                  <Text c="dimmed" size="xs">
                    {[group.branchName, group.hallName, group.trainingStartTime].filter(Boolean).join(' • ')}
                  </Text>
                  {index === 0 ? (
                    <Badge color="teal" radius="sm" size="sm" variant="light">
                      Отчётность
                    </Badge>
                  ) : null}
                </div>
                {isSingleVisit ? null : (
                  <Group className="membership-target-group-row__actions" gap={8} wrap="nowrap">
                    <Button
                      aria-label={`Поднять группу ${group.name}`}
                      disabled={index === 0}
                      onClick={() => moveTarget(index, -1)}
                      variant="subtle"
                    >
                      <IconArrowUp aria-hidden size={18} />
                    </Button>
                    <Button
                      aria-label={`Опустить группу ${group.name}`}
                      disabled={index === selectedGroups.length - 1}
                      onClick={() => moveTarget(index, 1)}
                      variant="subtle"
                    >
                      <IconArrowDown aria-hidden size={18} />
                    </Button>
                  </Group>
                )}
                <Button
                  ref={(node) => {
                    removeButtonRefs.current[group.id] = node
                  }}
                  aria-label={`Удалить группу ${group.name}`}
                  onClick={() => removeTarget(index)}
                  variant="subtle"
                >
                  <IconTrash aria-hidden size={18} />
                </Button>
              </div>
            ))}
          </Stack>
        )}
        <Text aria-live="polite" className="visually-hidden">
          {announcement}
        </Text>
      </Stack>
    </fieldset>
  )
}

function describeTargetRules(behaviorKind: MembershipBehaviorKind) {
  if (behaviorKind === 'SingleVisit') {
    return 'Разовое посещение действует только в выбранной группе.'
  }

  return 'Выберите от 1 до 5 групп одного филиала. Первая группа используется в финансовой разбивке.'
}

function formatTargetGroupOption(group: TrainingGroupListItem) {
  return [group.name, group.branchName, group.hallName, group.trainingStartTime]
    .filter(Boolean)
    .join(' • ')
}
