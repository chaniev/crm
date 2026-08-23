
import { Alert, Badge, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import { IconCheck, IconUserHeart } from '@tabler/icons-react'
import type { ClientDetails } from '../../lib/api'
import { PageSection } from '../shared/ux'
import {
  formatDateValue,
  formatPreviewList,
  statusLabelMap,
} from './ClientManagement.formatting'
import {
  formatClientBirthDate,
  getClientAgeDisplayValue,
} from './clientBirthDate'
import { ClientPhotoSection } from './ClientPhotoSection'

type ClientOverviewSectionProps = {
  canManage: boolean
  client: ClientDetails
  onPhotoUpload?: (file: File) => Promise<void>
  photoVersion: number | null
}

export function ClientOverviewSection({
  canManage,
  client,
  onPhotoUpload,
  photoVersion,
}: ClientOverviewSectionProps) {
  const groupsValue =
    client.groups.length > 0
      ? formatPreviewList(client.groups.map((group) => group.name), 2)
      : canManage
        ? 'Не выбраны'
        : 'Нет доступных групп'
  const contactsValue =
    client.contacts.length > 0
      ? formatPreviewList(client.contacts.map((contact) => contact.fullName), 2)
      : 'Не добавлены'
  const visitsValue = client.attendanceHistoryLoaded
    ? `${client.attendanceHistoryTotalCount ?? client.attendanceHistory.length}`
    : 'Загружаются'
  const birthDateValue = formatClientBirthDate(client.birthDate) ?? 'Не указана'
  const ageValue = client.birthDate
    ? getClientAgeDisplayValue(client.birthDate, client.businessDate)
    : null

  return (
    <PageSection className="client-overview-card">
      <div className="client-overview-grid">
        <Stack className="client-overview-main" gap="md">
          <Group justify="space-between" wrap="wrap">
            <div>
              <Text className="client-overview-eyebrow" size="xs">
                {canManage ? 'Клиент' : 'Клиент тренера'}
              </Text>
              <Title order={2} className="client-overview-title">
                {client.fullName}
              </Title>
            </div>

            <Group gap="xs" justify="flex-end" wrap="wrap">
              {canManage ? (
                <Badge
                  color={client.status === 'Active' ? 'teal' : 'gray'}
                  radius="sm"
                  size="lg"
                  variant="light"
                >
                  {statusLabelMap[client.status]}
                </Badge>
              ) : null}
              {client.isProfessional ? (
                <Badge color="blue" radius="sm" size="lg" variant="light">
                  Профессионал
                </Badge>
              ) : null}
            </Group>
          </Group>

          {!canManage ? (
            <Alert
              color="blue"
              icon={<IconCheck size={18} />}
              title="Доступ тренера"
              variant="light"
            >
              Видны фото, ФИО, рабочая заметка, назначенные группы и история
              посещений.
            </Alert>
          ) : null}

          {client.isProfessional ? (
            <Alert
              color="blue"
              icon={<IconUserHeart size={18} />}
              title="Профессионал"
              variant="light"
            >
              {client.professionalComment || 'Профессиональный статус'}
            </Alert>
          ) : null}

          <SimpleGrid cols={{ base: 1, sm: 2, xl: canManage ? 4 : 3 }}>
            {canManage ? (
              <>
                <CompactInfoItem label="Телефон" value={client.phone || 'Не указан'} />
                <CompactInfoItem label="Филиал" value={client.branchName || 'Не указан'} />
                <CompactInfoItem label="Фамилия" value={client.lastName || 'Не указана'} />
                <CompactInfoItem label="Имя" value={client.firstName || 'Не указано'} />
                <CompactInfoItem label="Отчество" value={client.middleName || 'Не указано'} />
              </>
            ) : null}
            <CompactInfoItem label="Дата рождения" value={birthDateValue} />
            {ageValue ? <CompactInfoItem label="Возраст" value={ageValue} /> : null}
            <CompactInfoItem label="Группы" value={groupsValue} />
            {canManage ? <CompactInfoItem label="Контакты" value={contactsValue} /> : null}
            <CompactInfoItem label="Посещений" value={visitsValue} />
            <CompactInfoItem
              label="Последнее посещение"
              value={formatDateValue(client.lastVisitDate)}
            />
          </SimpleGrid>

        </Stack>

        <aside className="client-overview-rail">
          <ClientPhotoSection
            canUpload={canManage}
            clientId={client.id}
            clientName={client.fullName}
            onUpload={onPhotoUpload}
            photo={client.photo}
            previewVersion={photoVersion ?? client.photo?.uploadedAt ?? client.updatedAt}
            variant="compact"
          />
        </aside>
      </div>
    </PageSection>
  )
}

type CompactInfoItemProps = {
  label: string
  value: string
}

function CompactInfoItem({
  label,
  value,
}: CompactInfoItemProps) {
  return (
    <div className="compact-info-item">
      <Text c="dimmed" fw={600} size="xs">
        {label}
      </Text>
      <Text fw={700} size="sm">
        {value}
      </Text>
    </div>
  )
}
