import { Badge, Button, Group, Paper, SimpleGrid, Stack, Text, ThemeIcon } from '@mantine/core'
import { IconEdit, IconUserHeart, IconUsersGroup } from '@tabler/icons-react'
import type { ClientDetails } from '../../lib/api'
import { formatGroupSchedule } from '../../lib/groupSchedule'
import { PageSection } from '../shared/ux'
import { ClientNoteAttribution } from './ClientNoteAttribution'

type ClientNotesSectionProps = {
  client: ClientDetails
}

export function ClientNotesSection({ client }: ClientNotesSectionProps) {
  return (
    <PageSection className="client-section-card">
      <Stack gap="lg">
        <Group gap="xs">
          <ThemeIcon color="var(--crm-action-primary)" radius="xl" size={34} variant="light">
            <IconEdit size={18} />
          </ThemeIcon>
          <div>
            <Text fw={700}>Рабочая заметка</Text>
            <Text c="dimmed" size="sm">
              Внутренняя заметка по клиенту, которая сохраняется в карточке.
            </Text>
          </div>
        </Group>

        {client.notes ? (
          <Stack gap={4}>
            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
              {client.notes}
            </Text>
            {client.notesLastChangedByName && client.notesLastChangedAt ? (
              <ClientNoteAttribution
                authorName={client.notesLastChangedByName}
                changedAt={client.notesLastChangedAt}
              />
            ) : null}
          </Stack>
        ) : (
          <Text c="dimmed" size="sm">
            Рабочая заметка пока не добавлена.
          </Text>
        )}
      </Stack>
    </PageSection>
  )
}

type ClientRelatedSectionsProps = {
  canManage: boolean
  client: ClientDetails
  onEdit: (clientId: string) => void
}

export function ClientRelatedSections({
  canManage,
  client,
  onEdit,
}: ClientRelatedSectionsProps) {
  return (
    <SimpleGrid cols={{ base: 1, md: canManage ? 2 : 1 }}>
      {canManage ? <ClientContactsSection client={client} /> : null}
      <ClientGroupsSection canManage={canManage} client={client} onEdit={onEdit} />
    </SimpleGrid>
  )
}

function ClientContactsSection({ client }: ClientNotesSectionProps) {
  return (
    <PageSection className="client-section-card">
      <Stack gap="lg">
        <Group gap="xs">
          <ThemeIcon color="var(--crm-action-primary)" radius="xl" size={34} variant="light">
            <IconUserHeart size={18} />
          </ThemeIcon>
          <div>
            <Text fw={700}>Контактные лица</Text>
            <Text c="dimmed" size="sm">
              До двух контактных лиц для экстренной связи.
            </Text>
          </div>
        </Group>

        {client.contacts.length === 0 ? (
          <Text c="dimmed" size="sm">
            Контактные лица для клиента пока не добавлены.
          </Text>
        ) : (
          <Stack gap="sm">
            {client.contacts.map((contact, index) => (
              <Paper
                className="list-row-card"
                key={contact.id ?? `${contact.fullName}-${index}`}
                radius="8px"
                withBorder
              >
                <Stack gap={6}>
                  <Group gap="sm" wrap="wrap">
                    <Text fw={700}>{contact.fullName}</Text>
                    <Badge radius="xl" variant="light">
                      {contact.type}
                    </Badge>
                  </Group>
                  <Text c="dimmed" size="sm">
                    Телефон: {contact.phone}
                  </Text>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </Stack>
    </PageSection>
  )
}

function ClientGroupsSection({
  canManage,
  client,
  onEdit,
}: ClientRelatedSectionsProps) {
  return (
    <PageSection className="client-section-card">
      <Stack gap="lg">
        <Group justify="space-between" wrap="wrap">
          <Group gap="xs">
            <ThemeIcon color="var(--crm-action-primary)" radius="xl" size={34} variant="light">
              <IconUsersGroup size={18} />
            </ThemeIcon>
            <div>
              <Text fw={700}>Группы клиента</Text>
              <Text c="dimmed" size="sm">
                Блок показывает текущую привязку клиента к тренировочным группам.
              </Text>
            </div>
          </Group>

          {canManage ? (
            <Button
              leftSection={<IconEdit size={18} />}
              onClick={() => onEdit(client.id)}
              variant="light"
            >
              Изменить группы
            </Button>
          ) : null}
        </Group>

        {client.groups.length === 0 ? (
          <Text c="dimmed" size="sm">
            Клиент пока не включен ни в одну группу.
          </Text>
        ) : (
          <Stack gap="sm">
            {client.groups.map((group) => (
              <Paper
                className="list-row-card"
                key={group.id}
                radius="8px"
                withBorder
              >
                <Stack gap={6}>
                  <Group gap="sm" wrap="wrap">
                    <Text fw={700}>{group.name}</Text>
                    <Badge
                      color={group.isActive ? 'teal' : 'gray'}
                      radius="xl"
                      variant="light"
                    >
                      {group.isActive ? 'Активна' : 'Неактивна'}
                    </Badge>
                  </Group>
                  <Text c="dimmed" size="sm">
                    {group.trainingStartTime
                      ? `Старт: ${group.trainingStartTime}`
                      : 'Время начала не указано'}
                    {group.weekdays && typeof group.durationMinutes === 'number'
                      ? ` • ${formatGroupSchedule(group.weekdays, group.durationMinutes)}`
                      : ''}
                  </Text>
                  {group.branchName || group.hallName ? (
                    <Text c="dimmed" size="sm">
                      {[group.branchName, group.hallName].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </Stack>
    </PageSection>
  )
}
