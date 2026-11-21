import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Badge, Button, Group, Tabs, Title } from '@mantine/core'
import { IconArrowLeft } from '@tabler/icons-react'
import { ClientAvatar } from '../../../frontend/src/features/shared/ux'
import { statusLabelMap } from '../../../frontend/src/features/clients/ClientManagement.formatting'
import type { ClientDetails } from '../../../frontend/src/lib/api'

import { DraftState, type DraftArea } from './DraftState'

export const ChatTabAccess = createContext(false)

type Props = {
  client: ClientDetails
  canManage: boolean
  memberships: ReactNode
  groups: ReactNode
  attendance: ReactNode
  messages: ReactNode
  children: ReactNode
  onBack: () => void
  backLabel: string
}

export function ProfileTabs({ client, canManage, memberships, attendance, groups, messages, children, onBack, backLabel }: Props) {
  const canViewMessages = useContext(ChatTabAccess)
  const readTab = useCallback(() => {
    const requested = location.hash.slice(1)
    if (requested === 'messages' && canViewMessages) return 'messages'
    if (requested === 'groups' || requested === 'visits' || (canManage && requested === 'memberships')) return requested
    return 'info'
  }, [canManage, canViewMessages])
  const [tab, setTab] = useState(readTab)
  const [openedMessages, setOpenedMessages] = useState(false)
  useEffect(() => {
    if (tab === 'messages') setOpenedMessages(true)
  }, [tab])
  useEffect(() => {
    const sync = () => setTab(readTab())
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [readTab])
  const drafts = useRef(new Set<DraftArea>())
  const register = useCallback((area: DraftArea, dirty: boolean) => {
    if (dirty) drafts.current.add(area)
    else drafts.current.delete(area)
  }, [])
  function back() {
    if (!drafts.current.size || window.confirm('Выйти из карточки и отменить несохранённые изменения?')) onBack()
  }
  function select(value: string | null) {
    if (!value) return
    setTab(value)
    history.replaceState(null, '', '#' + value)
  }
  return <DraftState.Provider value={register}><article className="profile">
    <Button variant="subtle" onClick={back} leftSection={<IconArrowLeft size={17}/>}>{backLabel}</Button>
    <Group className="identity" wrap="nowrap">
      <ClientAvatar aria-hidden name={client.fullName} size={48} radius="xl" color="brand" />
      <div><Title order={1}>{client.fullName}</Title>
        {canManage && <Badge color={client.status === 'Active' ? 'teal' : 'gray'} variant="light">{statusLabelMap[client.status]}</Badge>}
      </div>
    </Group>
    <Tabs value={tab} onChange={select} keepMounted>
      <Tabs.List aria-label="Разделы карточки клиента" className={canViewMessages ? 'profile-tabs profile-tabs--with-chat' : 'profile-tabs'}>
        <Tabs.Tab value="info">Основная информация</Tabs.Tab>
        {canManage && <Tabs.Tab value="memberships">Абонементы</Tabs.Tab>}
        <Tabs.Tab value="visits">Посещения</Tabs.Tab>
        <Tabs.Tab value="groups">Группы</Tabs.Tab>
        {canViewMessages && <Tabs.Tab value="messages">Сообщения</Tabs.Tab>}
      </Tabs.List>
      <Tabs.Panel value="info">{children}</Tabs.Panel>
      {canManage && <Tabs.Panel value="memberships">{memberships}</Tabs.Panel>}
      <Tabs.Panel value="visits">{attendance}</Tabs.Panel>
      <Tabs.Panel value="groups">{groups}</Tabs.Panel>
      {canViewMessages && <Tabs.Panel value="messages">{openedMessages && messages}</Tabs.Panel>}
    </Tabs>
  </article></DraftState.Provider>
}
