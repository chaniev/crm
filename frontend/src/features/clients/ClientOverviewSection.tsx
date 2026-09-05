
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
import { fe6ClientProfileText } from '../../resources/fe-6-client-profile'


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
        ? fe6ClientProfileText.clientOverviewSection_string_28997f75
        : fe6ClientProfileText.clientOverviewSection_string_9edc2ad9
  const contactsValue =
    client.contacts.length > 0
      ? formatPreviewList(client.contacts.map((contact) => contact.fullName), 2)
      : fe6ClientProfileText.clientOverviewSection_string_39b10095
  const visitsValue = client.attendanceHistoryLoaded
    ? `${client.attendanceHistoryTotalCount ?? client.attendanceHistory.length}`
    : fe6ClientProfileText.clientOverviewSection_string_7c5ffdd7
  const birthDateValue = formatClientBirthDate(client.birthDate) ?? fe6ClientProfileText.clientOverviewSection_string_f16cbd32
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
                {canManage ? fe6ClientProfileText.clientOverviewSection_string_3e622aec : fe6ClientProfileText.clientOverviewSection_string_ed0b220c}
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
                  {fe6ClientProfileText.clientOverviewSection_jsxText_76fc7876}</Badge>
              ) : null}
            </Group>
          </Group>

          {!canManage ? (
            <Alert
              color="blue"
              icon={<IconCheck size={18} />}
              title={fe6ClientProfileText.clientOverviewSection_title_09f75b9f}
              variant="light"
            >
              {fe6ClientProfileText.clientOverviewSection_jsxText_8afc6d90}</Alert>
          ) : null}

          {client.isProfessional ? (
            <Alert
              color="blue"
              icon={<IconUserHeart size={18} />}
              title={fe6ClientProfileText.clientOverviewSection_jsxText_76fc7876}
              variant="light"
            >
              {client.professionalComment || fe6ClientProfileText.clientOverviewSection_string_81ee659f}
            </Alert>
          ) : null}

          <SimpleGrid cols={{ base: 1, sm: 2, xl: canManage ? 4 : 3 }}>
            {canManage ? (
              <>
                <CompactInfoItem label={fe6ClientProfileText.clientOverviewSection_label_822f9fd9} value={client.phone || fe6ClientProfileText.clientOverviewSection_string_0d836c15} />
                <CompactInfoItem label={fe6ClientProfileText.clientOverviewSection_label_2f17c4d2} value={client.branchName || fe6ClientProfileText.clientOverviewSection_string_0d836c15} />
                <CompactInfoItem label={fe6ClientProfileText.clientOverviewSection_label_353eafa3} value={client.lastName || fe6ClientProfileText.clientOverviewSection_string_f16cbd32} />
                <CompactInfoItem label={fe6ClientProfileText.clientOverviewSection_label_1da7e937} value={client.firstName || fe6ClientProfileText.clientOverviewSection_string_ba4d4bf6} />
                <CompactInfoItem label={fe6ClientProfileText.clientOverviewSection_label_e1739d0a} value={client.middleName || fe6ClientProfileText.clientOverviewSection_string_ba4d4bf6} />
              </>
            ) : null}
            <CompactInfoItem label={fe6ClientProfileText.clientOverviewSection_label_1ae72066} value={birthDateValue} />
            {ageValue ? <CompactInfoItem label={fe6ClientProfileText.clientOverviewSection_label_35c7d5b1} value={ageValue} /> : null}
            <CompactInfoItem label={fe6ClientProfileText.clientOverviewSection_label_cd8c5873} value={groupsValue} />
            {canManage ? <CompactInfoItem label={fe6ClientProfileText.clientOverviewSection_label_fca8d5aa} value={contactsValue} /> : null}
            <CompactInfoItem label={fe6ClientProfileText.clientOverviewSection_label_48df6512} value={visitsValue} />
            <CompactInfoItem
              label={fe6ClientProfileText.clientOverviewSection_label_894707a3}
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
