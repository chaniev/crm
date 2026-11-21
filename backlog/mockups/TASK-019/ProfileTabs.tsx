import { useState, type ReactNode } from 'react'
import { Badge, Button, Group, Tabs, Title } from '@mantine/core'
import { IconArrowLeft } from '@tabler/icons-react'
import { ClientAvatar } from '../../../frontend/src/features/shared/ux'
import { statusLabelMap } from '../../../frontend/src/features/clients/ClientManagement.formatting'
import type { ClientDetails } from '../../../frontend/src/lib/api'

type Props = {
  client: ClientDetails
  canManage: boolean
  memberships: ReactNode
  attendance: ReactNode
  children: ReactNode
  onBack: () => void
  backLabel: string
}

export function ProfileTabs({ client, canManage, memberships, attendance, children, onBack, backLabel }: Props) {
  const [tab, setTab] = useState(() => {
    const requested = location.hash.slice(1)
    if (requested === 'visits' || (canManage && requested === 'memberships')) return requested
    return 'info'
  })
  function select(value: string | null) {
    if (!value) return
    setTab(value)
    history.replaceState(null, '', '#' + value)
  }
  return <article className="profile">
    <Button variant="subtle" onClick={onBack} leftSection={<IconArrowLeft size={17}/>}>{backLabel}</Button>
    <Group className="identity" wrap="nowrap">
      <ClientAvatar aria-hidden name={client.fullName} size={48} radius="xl" color="brand" />
      <div><Title order={1}>{client.fullName}</Title>
        {canManage && <Badge color={client.status === 'Active' ? 'teal' : 'gray'} variant="light">{statusLabelMap[client.status]}</Badge>}
      </div>
    </Group>
    <Tabs value={tab} onChange={select} keepMounted>
      <Tabs.List aria-label="Разделы карточки клиента" className="profile-tabs">
        <Tabs.Tab value="info">Основная информация</Tabs.Tab>
        {canManage && <Tabs.Tab value="memberships">Абонементы</Tabs.Tab>}
        <Tabs.Tab value="visits">Посещения</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="info">{children}</Tabs.Panel>
      {canManage && <Tabs.Panel value="memberships">{memberships}</Tabs.Panel>}
      <Tabs.Panel value="visits">{attendance}</Tabs.Panel>
    </Tabs>
  </article>
}
