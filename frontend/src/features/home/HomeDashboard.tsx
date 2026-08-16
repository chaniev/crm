import { useCallback, useState, type KeyboardEvent } from 'react'
import { Badge, Tabs } from '@mantine/core'
import type { AuthenticatedUser } from '../../lib/api'
import { resources } from '../../lib/resources'
import { AttendanceWorkspace } from '../attendance/AttendanceScreen'
import type {
  ClientProfileOriginInput,
  ClientProfileReturnContext,
} from '../clients/clientProfileReturnState'
import { ErrorState, PageLayout, PageSection } from '../shared/ux'
import { AttentionPanel } from './AttentionPanel'

type HomeDashboardProps = {
  initialReturnContext?: ClientProfileReturnContext | null
  user: AuthenticatedUser
  onOpenClient?: (clientId: string, origin?: ClientProfileOriginInput | null) => void
}

type HomeTab = 'attendance' | 'memberships'

export function HomeDashboard({
  initialReturnContext = null,
  user,
  onOpenClient,
}: HomeDashboardProps) {
  const canViewMemberships = user.permissions.canManageClients
  const canWorkWithAttendance = user.permissions.canMarkAttendance
  const [activeTab, setActiveTab] = useState<HomeTab>(() =>
    canWorkWithAttendance ? 'attendance' : 'memberships',
  )
  const [membershipCount, setMembershipCount] = useState<number | null>(null)
  const handleMembershipCount = useCallback((count: number | null) => setMembershipCount(count), [])

  function handleTabBoundaryKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault()
    const nextTab = event.key === 'Home' ? 'attendance' : 'memberships'
    setActiveTab(nextTab)
    document.getElementById(`home-tabs-tab-${nextTab}`)?.focus()
  }

  if (!canViewMemberships && !canWorkWithAttendance) {
    return (
      <PageLayout data-testid="home-screen" showHeader={false} title="Главная">
        <PageSection><ErrorState message={resources.home.accessDenied.message} title={resources.home.accessDenied.title} /></PageSection>
      </PageLayout>
    )
  }

  const attendancePanel = canWorkWithAttendance ? (
    <div aria-labelledby={canViewMemberships ? 'home-tabs-tab-attendance' : undefined} className="home-tab-panel" data-testid="attendance-screen" id="home-tabs-panel-attendance" role={canViewMemberships ? 'tabpanel' : undefined}>
      <AttendanceWorkspace
        initialReturnContext={initialReturnContext}
        onOpenClient={onOpenClient}
        user={user}
      />
    </div>
  ) : null
  const membershipsPanel = canViewMemberships ? (
    <div aria-labelledby={canWorkWithAttendance ? 'home-tabs-tab-memberships' : undefined} className="home-tab-panel" data-testid="memberships-panel" id="home-tabs-panel-memberships" role={canWorkWithAttendance ? 'tabpanel' : undefined}>
      <AttentionPanel onCountChange={handleMembershipCount} onOpenClient={onOpenClient} />
    </div>
  ) : null

  return (
    <PageLayout className="home-dashboard" data-testid="home-screen" showHeader={false} title="Главная">
      {canWorkWithAttendance && canViewMemberships ? (
        <Tabs className="home-tabs" data-testid="home-tabs" id="home-tabs" onChange={(value) => value && setActiveTab(value as HomeTab)} value={activeTab}>
          <Tabs.List aria-label="Разделы главной">
            <Tabs.Tab onKeyDown={handleTabBoundaryKey} value="attendance">Посещения</Tabs.Tab>
            <Tabs.Tab onKeyDown={handleTabBoundaryKey} rightSection={<Badge aria-label={membershipCount === null ? 'Счетчик загружается' : `${membershipCount} клиентов требуют внимания`} circle color={membershipCount ? 'red' : 'gray'}>{membershipCount ?? '…'}</Badge>} value="memberships">Требуют внимания</Tabs.Tab>
          </Tabs.List>
          <div hidden={activeTab !== 'attendance'}>{attendancePanel}</div>
          <div hidden={activeTab !== 'memberships'}>{membershipsPanel}</div>
        </Tabs>
      ) : attendancePanel ?? membershipsPanel}
    </PageLayout>
  )
}
