import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Tabs } from '@mantine/core'
import { clientDetailText } from '../../resources/client-detail-tabs'
import './ClientDetailTabs.css'

type Tab = keyof typeof clientDetailText.tabs
const tabs: Tab[] = ['info', 'memberships', 'visits', 'groups', 'messages']

type Props = {
  info: ReactNode
  memberships?: ReactNode
  visits: ReactNode
  groups: ReactNode
  messages?: (active: boolean) => ReactNode
}

export function ClientDetailTabs({ info, memberships, visits, groups, messages }: Props) {
  const canManage = Boolean(memberships)
  const canViewMessages = Boolean(messages)
  const resolve = useCallback((value: string): Tab => {
    if (value === 'messages' && canViewMessages) return value
    if (value === 'memberships' && canManage) return value
    return value === 'visits' || value === 'groups' ? value : 'info'
  }, [canManage, canViewMessages])

  const [tab, setTab] = useState(() => resolve(location.hash.slice(1)))
  const [opened, setOpened] = useState<Set<Tab>>(() => new Set([tab]))
  const activate = useCallback((value: string) => {
    const next = resolve(value)
    setTab(next)
    setOpened(previous => previous.has(next) ? previous : new Set([...previous, next]))
  }, [resolve])

  useEffect(() => {
    const sync = () => activate(location.hash.slice(1))
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [activate])

  const panels = { info, memberships, visits, groups, messages: messages?.(tab === 'messages') }
  const available = tabs.filter(key => panels[key])
  return (
    <Tabs className="client-detail-tabs" value={tab} onChange={value => {
      if (!value) return
      history.replaceState(history.state, '', '#' + value)
      activate(value)
    }}>
      <Tabs.List aria-label={clientDetailText.tabList} data-count={available.length}>
        {available.map(key => <Tabs.Tab value={key} key={key}>{clientDetailText.tabs[key]}</Tabs.Tab>)}
      </Tabs.List>
      {available.map(key => (
        <Tabs.Panel key={key} value={key}>
          {opened.has(key) && panels[key]}
        </Tabs.Panel>
      ))}
    </Tabs>
  )
}
