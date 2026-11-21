
import { Alert, Badge, Group, Stack, Text, Title } from '@mantine/core'
import { IconCheck, IconUserHeart } from '@tabler/icons-react'
import type { ClientDetails } from '../../lib/api'
import type { ReactNode } from 'react'
import { ClientAvatar, PageSection } from '../shared/ux'
import { statusLabelMap } from './ClientManagement.formatting'
import {
  formatClientBirthDate,
  getClientAgeDisplayValue,
} from './clientBirthDate'
import { ClientPhotoSection } from './ClientPhotoSection'
import { fe6ClientProfileText } from '../../resources/fe-6-client-profile'


type ClientOverviewSectionProps = {
  showIdentity?: boolean
  actions: ReactNode
  canManage: boolean
  client: ClientDetails
  onPhotoUpload?: (file: File) => Promise<void>
  photoVersion: number | null
}

export function ClientOverviewSection({
  showIdentity = true,
  actions,
  canManage,
  client,
  onPhotoUpload,
  photoVersion,
}: ClientOverviewSectionProps) {
  const birthDateValue = formatClientBirthDate(client.birthDate) ?? fe6ClientProfileText.clientOverviewSection_string_f16cbd32
  const ageValue = client.birthDate
    ? getClientAgeDisplayValue(client.birthDate, client.businessDate)
    : null

  return (
    <PageSection className="client-overview-card">
      <Stack gap="md">
        {showIdentity && <Group gap="sm" wrap="nowrap" className="client-profile-identity">
          <ClientAvatar aria-hidden name={client.fullName} size={54} radius="xl" color="brand" />
          <div>
            <Title order={1}>{client.fullName}</Title>
            {canManage && (
              <Badge color={client.status === 'Active' ? 'teal' : 'gray'} variant="light">
                {statusLabelMap[client.status]}
              </Badge>
            )}
          </div>
        </Group>}

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

        <dl className="client-overview-facts">
          {canManage && <>
            <Fact label={fe6ClientProfileText.clientOverviewSection_label_822f9fd9} value={client.phone || fe6ClientProfileText.clientOverviewSection_string_0d836c15} />
            <Fact label={fe6ClientProfileText.clientOverviewSection_label_2f17c4d2} value={client.branchName || fe6ClientProfileText.clientOverviewSection_string_0d836c15} />
          </>}
          <Fact label={fe6ClientProfileText.clientOverviewSection_label_1ae72066} value={birthDateValue}>
            {ageValue && <> · <span>{ageValue}</span></>}
          </Fact>
        </dl>
        <ClientPhotoSection
          canUpload={canManage}
          clientId={client.id}
          clientName={client.fullName}
          onUpload={onPhotoUpload}
          photo={client.photo}
          previewVersion={photoVersion ?? client.photo?.uploadedAt ?? client.updatedAt}
          variant="compact"
        />
        {actions}
      </Stack>
    </PageSection>
  )
}

function Fact({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  return (
    <div>
      <Text component="dt" c="dimmed" size="sm">{label}</Text>
      <Text component="dd" fw={600} m={0}><span>{value}</span>{children}</Text>
    </div>
  )
}
